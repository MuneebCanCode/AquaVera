/**
 * Check the actual on-chain key for the account via Mirror Node.
 * Run: npx ts-node scripts/debug-mirror.ts
 */
import 'dotenv/config';

async function main() {
  const accountId = process.env.HEDERA_OPERATOR_ID!;
  console.log(`Checking account ${accountId} on Mirror Node...\n`);

  const url = `https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}`;
  const res = await fetch(url);
  const data = await res.json() as any;

  console.log(`Account: ${data.account}`);
  console.log(`Balance: ${data.balance?.balance / 100_000_000} HBAR`);
  console.log(`Key type: ${data.key?.type ?? data.key?._type}`);
  console.log(`Key (on-chain): ${data.key?.key}`);
  console.log();

  // Compare with our .env key
  const { PrivateKey } = await import('@hashgraph/sdk');
  const envKey = process.env.HEDERA_OPERATOR_KEY!.trim();
  
  try {
    const ed25519 = PrivateKey.fromStringDer(envKey);
    console.log(`ENV key (ED25519 public): ${ed25519.publicKey.toStringRaw()}`);
  } catch {}
  
  try {
    const ecdsa = PrivateKey.fromStringECDSA(envKey);
    console.log(`ENV key (ECDSA public):   ${ecdsa.publicKey.toStringRaw()}`);
  } catch {}

  console.log(`\nOn-chain key:             ${data.key?.key}`);
  console.log('\nIf the on-chain key matches one of the above, use that key type.');
  console.log('If NONE match, the .env key is wrong for this account.');
}

main().catch(console.error);
