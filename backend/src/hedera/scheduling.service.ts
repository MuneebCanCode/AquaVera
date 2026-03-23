import {
  ScheduleCreateTransaction,
  TransferTransaction,
  AccountId,
  Hbar,
  ScheduleInfoQuery,
  ScheduleId,
} from '@hashgraph/sdk';
import { getHederaClient } from './client';
import { withRetry } from './retry';

export interface ScheduleResult {
  scheduleId: string;
  transactionId: string;
}

/**
 * Create a scheduled transfer transaction.
 * Used for deferred community reward distributions and other timed operations.
 */
export async function scheduleTransfer(
  fromAccountId: string,
  toAccountId: string,
  amountHbar: number,
  memo?: string
): Promise<ScheduleResult> {
  return withRetry(async () => {
    const client = getHederaClient();

    const innerTx = new TransferTransaction()
      .addHbarTransfer(AccountId.fromString(fromAccountId), new Hbar(-amountHbar))
      .addHbarTransfer(AccountId.fromString(toAccountId), new Hbar(amountHbar));

    const tx = new ScheduleCreateTransaction()
      .setScheduledTransaction(innerTx)
      .setAdminKey(client.operatorPublicKey!);

    if (memo) tx.setScheduleMemo(memo);

    const response = await tx.execute(client);
    const receipt = await response.getReceipt(client);

    return {
      scheduleId: receipt.scheduleId!.toString(),
      transactionId: response.transactionId.toString(),
    };
  }, 'scheduleTransfer');
}

/**
 * Query the status of a scheduled transaction.
 */
export async function getScheduleInfo(
  scheduleId: string
): Promise<{
  scheduleId: string;
  executed: boolean;
  deleted: boolean;
  memo: string;
  expirationTime: string | null;
}> {
  return withRetry(async () => {
    const client = getHederaClient();

    const info = await new ScheduleInfoQuery()
      .setScheduleId(ScheduleId.fromString(scheduleId))
      .execute(client);

    return {
      scheduleId: info.scheduleId.toString(),
      executed: info.executed != null,
      deleted: info.deleted != null,
      memo: info.scheduleMemo ?? '',
      expirationTime: info.expirationTime?.toDate().toISOString() ?? null,
    };
  }, 'getScheduleInfo');
}
