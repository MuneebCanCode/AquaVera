/**
 * Debug: try both ED25519 and ECDSA key types for token creation.
 * Run: npx ts-node scripts/debug-token.ts
 */
import 'dotenv/config';
import {
  Client,
  AccountId,
  PrivateKey,
  Hbar,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  AccountBalanceQuery,
} from '@hashgraph/sdk';

async function tryWithKey(label: string, operatorId: AccountId, key: PrivateKey) {
  console.log(`\n--- Trying ${label} ---`);
  console.log(`  Public key: ${key.publicKey.toString().substring(0, 50)}...`);

  const client = Client.forTestnet();
  client.setOperator(operatorId, key);
  client.setDefaultMaxTransactionFee(new Hbar(100));
  client.setDefaultMaxQueryPayment(new Hbar(50));

  // Test balance query first
  try {
    const balance = await new AccountBalanceQuery()
      .setAccountId(operatorId)
      .execute(client);
    console.log(`  Balance query: ✓ (${balance.hbars})`);
  } catch (e: any) {
    console.log(`  Balance query: ✗ ${e.message?.substring(0, 80)}`);
    return;
  }

  // Test token creation
  try {
    const tx = new TokenCreateTransaction()
      .setTokenName(`Test ${label}`)
      .setTokenSymbol('TST')
      .setDecimals(2)
      .setInitialSupply(0)
      .setTreasuryAccountId(operatorId)
      .setTokenType(TokenType.FungibleCommon)
      .setSupplyType(TokenSupplyType.Infinite);

    const response = await tx.execute(client);
    const receipt = await response.getReceipt(client);
    console.log(`  Token creation: ✓ Token ID: ${receipt.tokenId}`);
  } catch (e: any) {
    console.log(`  Token creation: ✗ ${e.message?.substring(0, 100)}`);
  }
}

async function main() {
  const operatorId = AccountId.fromString(process.env.HEDERA_OPERATOR_ID!);
  const rawKey = process.env.HEDERA_OPERATOR_KEY!.trim().replace(/^0x/, '');

  console.log(`Account: ${operatorId}`);
  console.log(`Key length: ${rawKey.length} chars`);

  // Try as ED25519 DER
  try {
    const ed25519Key = PrivateKey.fromStringDer(rawKey);
    await tryWithKey('ED25519 (fromStringDer)', operatorId, ed25519Key);
  } catch (e: any) {
    console.log(`ED25519 DER parse failed: ${e.message}`);
  }

  // Try as ECDSA DER
  try {
    const ecdsaKey = PrivateKey.fromStringECDSA(rawKey);
    await tryWithKey('ECDSA (fromStringECDSA)', operatorId, ecdsaKey);
  } catch (e: any) {
    console.log(`ECDSA parse failed: ${e.message}`);
  }

  // Try fromString (auto-detect)
  try {
    const autoKey = PrivateKey.fromString(rawKey);
    await tryWithKey('Auto-detect (fromString)', operatorId, autoKey);
  } catch (e: any) {
    console.log(`Auto-detect parse failed: ${e.message}`);
  }
}

main().catch(console.error);
