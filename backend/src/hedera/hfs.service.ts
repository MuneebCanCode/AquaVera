import {
  FileCreateTransaction,
  FileContentsQuery,
  FileId,
  Hbar,
} from '@hashgraph/sdk';
import { getHederaClient } from './client';
import { withRetry } from './retry';

/**
 * Create a file on Hedera File Service.
 * Used for: Guardian MRV policy schemas, NFT metadata, compliance reports.
 */
export async function createFile(
  contents: string | Uint8Array
): Promise<{ fileId: string }> {
  return withRetry(async () => {
    const client = getHederaClient();

    const fileData =
      typeof contents === 'string' ? new TextEncoder().encode(contents) : contents;

    const tx = new FileCreateTransaction()
      .setContents(fileData)
      .setMaxTransactionFee(new Hbar(5));

    const response = await tx.execute(client);
    const receipt = await response.getReceipt(client);

    return { fileId: receipt.fileId!.toString() };
  }, 'createFile');
}

/**
 * Read a file from Hedera File Service.
 */
export async function readFile(fileId: string): Promise<string> {
  return withRetry(async () => {
    const client = getHederaClient();

    const query = new FileContentsQuery().setFileId(
      FileId.fromString(fileId)
    );

    const contents = await query.execute(client);
    return new TextDecoder().decode(contents);
  }, 'readFile');
}
