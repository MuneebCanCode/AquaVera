import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes with clsx for conditional class names */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number with commas (e.g., 1234567 → "1,234,567") */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

/** Format HBAR amount with 2 decimal places */
export function formatHbar(value: number): string {
  return `${formatNumber(Number(value.toFixed(2)))} HBAR`;
}

/** Format liters with appropriate unit (L, kL, ML) */
export function formatLiters(liters: number): string {
  if (liters >= 1_000_000) return `${(liters / 1_000_000).toFixed(1)}M L`;
  if (liters >= 1_000) return `${(liters / 1_000).toFixed(1)}k L`;
  return `${formatNumber(liters)} L`;
}

/** Build a HashScan URL for a Hedera entity */
export function hashScanUrl(
  entityType: 'transaction' | 'topic' | 'token' | 'account' | 'contract' | 'file',
  entityId: string,
  network: string = 'testnet'
): string {
  // Link to our styled Guardian policy page on the frontend
  if (entityType === 'file') {
    return `/guardian/policy`;
  }
  return `https://hashscan.io/${network}/${entityType}/${entityId}`;
}

/** Truncate a string in the middle (e.g., "0.0.1234567" → "0.0.12...567") */
export function truncateMiddle(str: string, maxLen: number = 16): string {
  if (str.length <= maxLen) return str;
  const start = Math.ceil(maxLen / 2);
  const end = Math.floor(maxLen / 2) - 3;
  return `${str.slice(0, start)}...${str.slice(-end)}`;
}
