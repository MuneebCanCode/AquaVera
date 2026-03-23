import {
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  TopicId,
} from '@hashgraph/sdk';
import { getHederaClient } from './client';
import { withRetry } from './retry';

// ─── Create Topic ────────────────────────────────────────────────────────────

export async function createTopic(
  memo?: string
): Promise<{ topicId: string }> {
  return withRetry(async () => {
    const client = getHederaClient();

    const tx = new TopicCreateTransaction();
    if (memo) tx.setTopicMemo(memo);

    const response = await tx.execute(client);
    const receipt = await response.getReceipt(client);

    return { topicId: receipt.topicId!.toString() };
  }, 'createTopic');
}

// ─── Submit Message ──────────────────────────────────────────────────────────

/**
 * Submit a message to an HCS topic.
 * Uses deterministic JSON serialization (sorted keys) for consistency.
 */
export async function submitMessage(
  topicId: string,
  message: Record<string, unknown>
): Promise<{ messageId: string; consensusTimestamp: string }> {
  return withRetry(async () => {
    const client = getHederaClient();

    const serialized = deterministicJsonSerialize(message);

    const tx = new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(topicId))
      .setMessage(serialized);

    const response = await tx.execute(client);
    const receipt = await response.getReceipt(client);

    return {
      messageId: receipt.topicSequenceNumber!.toString(),
      consensusTimestamp: receipt.topicRunningHash
        ? response.transactionId.toString()
        : response.transactionId.toString(),
    };
  }, 'submitMessage');
}

// ─── Deterministic JSON Serialization ────────────────────────────────────────

/**
 * Serialize an object to JSON with sorted keys for deterministic output.
 * This ensures the same data always produces the same string representation,
 * which is critical for hash verification.
 */
export function deterministicJsonSerialize(obj: unknown): string {
  return JSON.stringify(obj, (_, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value)
        .sort()
        .reduce<Record<string, unknown>>((sorted, key) => {
          sorted[key] = (value as Record<string, unknown>)[key];
          return sorted;
        }, {});
    }
    return value;
  });
}
