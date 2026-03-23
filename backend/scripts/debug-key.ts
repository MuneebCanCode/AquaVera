/**
 * Debug script to diagnose HEDERA_OPERATOR_KEY issues.
 * Run: npx ts-node scripts/debug-key.ts
 */
import 'dotenv/config';
import { Client, AccountId, PrivateKey, AccountBalanceQuery, Hbar } from '@hashgraph/sdk';

async function main() {
  const operatorId = process.env.HEDERA_OPERATOR_ID;
  const operatorKey = process.env.HEDERA_OPERATOR_KEY;

  console.log('=== Key Diagnostics ===\n');
  console.log(`HEDERA_OPERATOR_ID: ${operatorId}`);
  console.log(`HEDERA_OPERATOR_KEY length: ${operatorKey?.length ?? 'MISSING'}`);
  console.log(`HEDERA_OPERATOR_KEY first 20 chars: ${operatorKey?.substring(0, 20)}...`);
  console.log(`HEDERA_OPERATOR_KEY last 10 chars: ...${operatorKey?.slice(-10)}`);
  console.log();

  if (!operatorId || !operatorKey) {
    console.error('Missing env vars!');
    return;
  }

  const cleaned = operatorKey.trim().replace(/^0x/, '');

  // Try each key format
  const attempts: { name: string; fn: () => PrivateKey }[] = [
    { name: 'fromStringDer', fn: () => PrivateKey.fromStringDer(cleaned) },
    { name: 'fromStringED25519', fn: () => PrivateKey.fromStringED25519(cleaned) },
    { name: 'fromStringECDSA', fn: () => PrivateKey.fromStringECDSA(cleaned) },
    { name: 'fromString', fn: () => PrivateKey.fromString(cleaned) },
  ];

  let workingKey: PrivateKey | null = null;
  let workingMethod = '';

  for (const attempt of attempts) {
    try {
      const key = attempt.fn();
      console.log(`✓ ${attempt.name} succeeded`);
      console.log(`  Type: ${key.publicKey.toString().startsWith('302a') ? 'ED25519' : 'ECDSA'}`);
      console.log(`  Public key: ${key.publicKey.toString().substring(0, 40)}...`);
      if (!workingKey) {
        workingKey = key;
        workingMethod = attempt.name;
      }
    } catch (e: any) {
      console.log(`✗ ${attempt.name} failed: ${e.message?.substring(0, 80)}`);
    }
  }

  if (!workingKey) {
    console.error('\nNo key parsing method worked! The key in .env is invalid.');
    return;
  }

  console.log(`\nUsing: ${workingMethod}`);
  console.log('\n=== Testing Connection ===\n');

  // Try a simple balance query (doesn't need token creation)
  try {
    const client = Client.forTestnet();
    client.setOperator(AccountId.fromString(operatorId), workingKey);
    client.setDefaultMaxTransactionFee(new Hbar(100));

    const balance = await new AccountBalanceQuery()
      .setAccountId(AccountId.fromString(operatorId))
      .execute(client);

    console.log(`✓ Balance query succeeded!`);
    console.log(`  HBAR balance: ${balance.hbars.toString()}`);
    console.log(`\nKey is valid and matches account ${operatorId}`);
  } catch (e: any) {
    console.error(`✗ Balance query failed: ${e.message?.substring(0, 200)}`);
    console.error('\nThe key does NOT match this account.');
  }
}

main().catch(console.error);
