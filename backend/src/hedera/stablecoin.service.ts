import { AccountId, PrivateKey } from '@hashgraph/sdk';
import { getOperatorAccountId } from './client';
import { createFungibleToken, mintFungibleTokens, transferTokens } from './hts.service';

/**
 * Create the AVUSD stablecoin token on Hedera.
 * AVUSD is a demo stablecoin pegged 1:1 to USD for marketplace payments.
 */
export async function createAVUSD(): Promise<{ tokenId: string }> {
  return createFungibleToken({
    name: 'AquaVera USD',
    symbol: 'AVUSD',
    decimals: 2,
    initialSupply: 0,
    treasuryAccountId: getOperatorAccountId(),
  });
}

/**
 * Mint AVUSD tokens to the treasury (operator) account.
 */
export async function mintAVUSD(
  tokenId: string,
  amount: number
): Promise<{ transactionId: string }> {
  return mintFungibleTokens(tokenId, amount);
}

/**
 * Distribute AVUSD from treasury to a user account.
 */
export async function distributeAVUSD(
  tokenId: string,
  toAccountId: string,
  amount: number,
  treasuryKey: PrivateKey
): Promise<{ transactionId: string }> {
  return transferTokens(
    tokenId,
    getOperatorAccountId().toString(),
    toAccountId,
    amount,
    treasuryKey
  );
}
