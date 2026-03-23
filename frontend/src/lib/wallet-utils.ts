/**
 * Wallet utility functions for Hedera EVM address handling.
 */

/**
 * Truncate an EVM address for display: 0x1234...abcd
 */
export function truncateAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Convert a Hedera token ID (0.0.X) to an EVM address.
 * Takes the last number, converts to hex, left-pads to 40 chars, prefixes with 0x.
 */
export function tokenIdToEvmAddress(tokenId: string): string {
  const parts = tokenId.split('.');
  const num = parseInt(parts[parts.length - 1], 10);
  return '0x' + num.toString(16).padStart(40, '0');
}

/**
 * Convert a Hedera account ID (0.0.X) to an EVM address.
 * Same conversion logic as tokenIdToEvmAddress.
 */
export function accountIdToEvmAddress(accountId: string): string {
  const parts = accountId.split('.');
  const num = parseInt(parts[parts.length - 1], 10);
  return '0x' + num.toString(16).padStart(40, '0');
}

/**
 * Validate an EVM address: must be 0x-prefixed with exactly 40 hex characters.
 */
export function isValidEvmAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

/**
 * Build a HashScan transaction URL for Hedera Testnet.
 */
export function getHashScanTxUrl(txHash: string): string {
  return `https://hashscan.io/testnet/transaction/${txHash}`;
}
