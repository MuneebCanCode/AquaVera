import { getDB, getTable, getPasswordStore, getTokenStore } from './store';
import { createAccount } from '../hedera/has.service';
import { createDID } from '../hedera/did.service';
import { associateTokens } from '../hedera/hts.service';
import { encrypt } from '../utils/encryption';
import { PrivateKey } from '@hashgraph/sdk';
import { parsePrivateKey } from '../hedera/client';
import { v4 as uuidv4 } from 'uuid';
import { createHash, randomBytes } from 'crypto';
import type { User } from '../types';
import type { RegisterInput } from '../utils/validation';

function simpleHash(str: string): string {
  return createHash('sha256').update(str).digest('hex');
}

/**
 * Register a new user: in-memory store → HAS account → DID → token association.
 * Rolls back on failure at any step.
 */
export async function register(input: RegisterInput): Promise<User> {
  const users = getTable<Record<string, unknown>>('users');
  const passwords = getPasswordStore();

  // Check if email already exists
  if (users.find(u => u.email === input.email)) {
    throw new Error('User with this email already exists');
  }

  const userId = uuidv4();
  let dbRowCreated = false;

  try {
    // Step 1: Store password
    passwords.set(input.email, simpleHash(input.password));

    // Step 2: Create row in users table
    const now = new Date().toISOString();
    const userRecord: Record<string, unknown> = {
      id: userId,
      email: input.email,
      full_name: input.full_name,
      organization_name: input.organization_name,
      role: input.role,
      industry: input.role === 'corporate_buyer' ? input.industry : null,
      water_footprint_liters_annual: input.role === 'corporate_buyer' ? input.water_footprint_liters_annual : null,
      hedera_account_id: null,
      hedera_private_key_encrypted: null,
      hedera_public_key: null,
      hedera_did: null,
      evm_address: input.evm_address || null,
      profile_image_url: null,
      created_at: now,
      updated_at: now,
    };
    users.push(userRecord);
    dbRowCreated = true;

    // Step 3: Create Hedera Testnet account via HAS
    const hederaAccount = await createAccount(100);

    // Step 4: Create DID
    const did = createDID(hederaAccount.accountId);

    // Step 5: Associate tokens (WSC, AVIC, AVUSD)
    const tokenIds = [
      process.env.WSC_TOKEN_ID,
      process.env.NFT_CERTIFICATE_TOKEN_ID,
      process.env.AVUSD_TOKEN_ID,
    ].filter(Boolean) as string[];

    if (tokenIds.length > 0) {
      const accountKey = parsePrivateKey(hederaAccount.privateKey);
      await associateTokens(hederaAccount.accountId, tokenIds, accountKey);
    }

    // Step 6: Update user record with Hedera fields
    const encryptedKey = encrypt(hederaAccount.privateKey);
    Object.assign(userRecord, {
      hedera_account_id: hederaAccount.accountId,
      hedera_private_key_encrypted: encryptedKey,
      hedera_public_key: hederaAccount.publicKey,
      hedera_did: did,
      updated_at: new Date().toISOString(),
    });

    return userRecord as unknown as User;
  } catch (error) {
    // Rollback
    if (dbRowCreated) {
      const idx = users.findIndex(u => u.id === userId);
      if (idx >= 0) users.splice(idx, 1);
    }
    passwords.delete(input.email);
    throw error;
  }
}


/**
 * Login — verify password, return user + access token.
 */
export async function login(email: string, password: string): Promise<{ user: User; accessToken: string }> {
  const passwords = getPasswordStore();
  const tokens = getTokenStore();
  const users = getTable<Record<string, unknown>>('users');

  const hashed = simpleHash(password);
  const stored = passwords.get(email);
  if (!stored || stored !== hashed) {
    throw new Error('Invalid credentials');
  }

  const user = users.find(u => u.email === email);
  if (!user) throw new Error('User profile not found');

  const token = randomBytes(32).toString('hex');
  tokens.set(token, user.id as string);

  return { user: user as unknown as User, accessToken: token };
}

/**
 * Get user profile by ID.
 */
export async function getProfile(userId: string): Promise<User> {
  const users = getTable<Record<string, unknown>>('users');
  const user = users.find(u => u.id === userId);
  if (!user) throw new Error('User not found');
  return user as unknown as User;
}
