import {
  AccountCreateTransaction,
  Hbar,
  PrivateKey,
} from '@hashgraph/sdk';
import { getHederaClient } from './client';
import { withRetry } from './retry';

export interface CreateAccountResult {
  accountId: string;
  privateKey: string;
  publicKey: string;
}

/**
 * Create a new Hedera account with an initial HBAR balance.
 * Generates a new key pair for the account.
 */
export async function createAccount(
  initialBalanceHbar: number = 10
): Promise<CreateAccountResult> {
  return withRetry(async () => {
    const client = getHederaClient();
    const newKey = PrivateKey.generateED25519();

    const tx = new AccountCreateTransaction()
      .setKey(newKey.publicKey)
      .setInitialBalance(new Hbar(initialBalanceHbar));

    const response = await tx.execute(client);
    const receipt = await response.getReceipt(client);

    return {
      accountId: receipt.accountId!.toString(),
      privateKey: newKey.toStringDer(),
      publicKey: newKey.publicKey.toStringDer(),
    };
  }, 'createAccount');
}
