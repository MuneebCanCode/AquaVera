import { HEDERA_RETRY } from '../utils/constants';

/**
 * Execute a Hedera SDK operation with retry logic.
 * 3 attempts, exponential backoff, 30s timeout per attempt.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  label: string = 'Hedera operation'
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= HEDERA_RETRY.MAX_ATTEMPTS; attempt++) {
    try {
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`${label} timed out after ${HEDERA_RETRY.TIMEOUT_MS}ms`)),
            HEDERA_RETRY.TIMEOUT_MS
          )
        ),
      ]);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry validation or balance errors — only transient/network errors
      const msg = lastError.message.toLowerCase();
      if (
        msg.includes('invalid') ||
        msg.includes('insufficient') ||
        msg.includes('unauthorized') ||
        msg.includes('payer_account_not_found')
      ) {
        throw lastError;
      }

      if (attempt < HEDERA_RETRY.MAX_ATTEMPTS) {
        const delay = HEDERA_RETRY.INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError ?? new Error(`${label} failed after ${HEDERA_RETRY.MAX_ATTEMPTS} attempts`);
}
