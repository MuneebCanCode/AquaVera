import { createHash } from 'crypto';
import { deterministicJsonSerialize } from '../hedera/hcs.service';

/**
 * Compute the SHA-256 hash of an object using deterministic JSON serialization (sorted keys).
 * The same data always produces the same hash, regardless of property insertion order.
 */
export function hashData(data: unknown): string {
  const serialized = deterministicJsonSerialize(data);
  return createHash('sha256').update(serialized, 'utf8').digest('hex');
}
