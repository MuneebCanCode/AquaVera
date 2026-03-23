import { Client, AccountId, PrivateKey, Hbar } from '@hashgraph/sdk';

let client: Client | null = null;

/**
 * Initialize and return the Hedera Testnet client.
 * Uses operator credentials from environment variables.
 * Singleton — returns the same client instance on subsequent calls.
 */
export function getHederaClient(): Client {
  if (client) return client;

  const operatorId = process.env.HEDERA_OPERATOR_ID;
  const operatorKey = process.env.HEDERA_OPERATOR_KEY;

  if (!operatorId || !operatorKey) {
    throw new Error(
      'Missing HEDERA_OPERATOR_ID or HEDERA_OPERATOR_KEY environment variables'
    );
  }

  client = Client.forTestnet();
  client.setOperator(
    AccountId.fromString(operatorId),
    parsePrivateKey(operatorKey)
  );
  client.setDefaultMaxTransactionFee(new Hbar(100));
  client.setDefaultMaxQueryPayment(new Hbar(50));

  return client;
}

/**
 * Get the operator account ID from environment.
 */
export function getOperatorAccountId(): AccountId {
  const operatorId = process.env.HEDERA_OPERATOR_ID;
  if (!operatorId) throw new Error('Missing HEDERA_OPERATOR_ID');
  return AccountId.fromString(operatorId);
}

/**
 * Get the operator private key from environment.
 */
export function getOperatorPrivateKey(): PrivateKey {
  const operatorKey = process.env.HEDERA_OPERATOR_KEY;
  if (!operatorKey) throw new Error('Missing HEDERA_OPERATOR_KEY');
  return parsePrivateKey(operatorKey);
}

/**
 * Parse a private key from any format: DER-encoded, raw ED25519 hex, or raw ECDSA hex.
 * Tries multiple parsing strategies to handle different Hedera portal key formats.
 */
export function parsePrivateKey(key: string): PrivateKey {
  const cleaned = key.trim().replace(/^0x/, '');

  // Try DER-encoded first (starts with 302e or 3030)
  try { return PrivateKey.fromStringDer(cleaned); } catch {}

  // Try ED25519 raw hex (64 hex chars = 32 bytes)
  try { return PrivateKey.fromStringED25519(cleaned); } catch {}

  // Try ECDSA raw hex
  try { return PrivateKey.fromStringECDSA(cleaned); } catch {}

  // Final fallback — let the SDK figure it out
  return PrivateKey.fromString(cleaned);
}
