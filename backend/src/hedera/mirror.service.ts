const MIRROR_BASE_URL = 'https://testnet.mirrornode.hedera.com';

export interface TokenBalance {
  token_id: string;
  balance: number;
  decimals: number;
}

export interface HbarBalance {
  balance: number;
  tokens: TokenBalance[];
}

export interface TransactionRecord {
  transaction_id: string;
  consensus_timestamp: string;
  name: string;
  result: string;
  transfers: Array<{ account: string; amount: number }>;
}

export interface HcsMessage {
  sequence_number: number;
  consensus_timestamp: string;
  message: string;
  payer_account_id: string;
}

export interface NftInfo {
  token_id: string;
  serial_number: number;
  account_id: string;
  metadata: string;
}

/**
 * Fetch account balances (HBAR + tokens) from Mirror Node.
 */
export async function getAccountBalance(
  accountId: string
): Promise<HbarBalance> {
  const res = await fetch(`${MIRROR_BASE_URL}/api/v1/balances?account.id=${accountId}`);
  if (!res.ok) throw new Error(`Mirror Node error: ${res.status} ${res.statusText}`);

  const data = (await res.json()) as { balances?: Array<{ balance: number; tokens?: Array<{ token_id: string; balance: number }> }> };
  const account = data.balances?.[0];

  if (!account) {
    return { balance: 0, tokens: [] };
  }

  return {
    balance: account.balance,
    tokens: (account.tokens || []).map((t: { token_id: string; balance: number }) => ({
      token_id: t.token_id,
      balance: t.balance,
      decimals: 0,
    })),
  };
}

/**
 * Fetch token-specific balance for an account.
 */
export async function getTokenBalance(
  accountId: string,
  tokenId: string
): Promise<number> {
  const balances = await getAccountBalance(accountId);
  const token = balances.tokens.find((t) => t.token_id === tokenId);
  return token?.balance ?? 0;
}

/**
 * Fetch transaction history for an account.
 */
export async function getTransactions(
  accountId: string,
  limit: number = 25
): Promise<TransactionRecord[]> {
  const res = await fetch(
    `${MIRROR_BASE_URL}/api/v1/transactions?account.id=${accountId}&limit=${limit}&order=desc`
  );
  if (!res.ok) throw new Error(`Mirror Node error: ${res.status} ${res.statusText}`);

  const data = (await res.json()) as { transactions?: Array<{ transaction_id: string; consensus_timestamp: string; name: string; result: string; transfers: Array<{ account: string; amount: number }> }> };
  return (data.transactions || []).map(
    (tx) => ({
      transaction_id: tx.transaction_id,
      consensus_timestamp: tx.consensus_timestamp,
      name: tx.name,
      result: tx.result,
      transfers: tx.transfers || [],
    })
  );
}

/**
 * Fetch HCS messages for a topic.
 */
export async function getTopicMessages(
  topicId: string,
  limit: number = 100
): Promise<HcsMessage[]> {
  const res = await fetch(
    `${MIRROR_BASE_URL}/api/v1/topics/${topicId}/messages?limit=${limit}&order=desc`
  );
  if (!res.ok) throw new Error(`Mirror Node error: ${res.status} ${res.statusText}`);

  const data = (await res.json()) as { messages?: Array<{ sequence_number: number; consensus_timestamp: string; message: string; payer_account_id: string }> };
  return (data.messages || []).map(
    (msg) => ({
      sequence_number: msg.sequence_number,
      consensus_timestamp: msg.consensus_timestamp,
      message: msg.message,
      payer_account_id: msg.payer_account_id,
    })
  );
}

/**
 * Fetch NFTs owned by an account for a specific token collection.
 */
export async function getAccountNFTs(
  accountId: string,
  tokenId: string
): Promise<NftInfo[]> {
  const res = await fetch(
    `${MIRROR_BASE_URL}/api/v1/tokens/${tokenId}/nfts?account.id=${accountId}`
  );
  if (!res.ok) throw new Error(`Mirror Node error: ${res.status} ${res.statusText}`);

  const data = (await res.json()) as { nfts?: Array<{ token_id: string; serial_number: number; account_id: string; metadata: string }> };
  return (data.nfts || []).map(
    (nft) => ({
      token_id: nft.token_id,
      serial_number: nft.serial_number,
      account_id: nft.account_id,
      metadata: nft.metadata,
    })
  );
}

/**
 * Fetch a specific NFT by token ID and serial number.
 */
export async function getNFTInfo(
  tokenId: string,
  serialNumber: number
): Promise<NftInfo | null> {
  const res = await fetch(
    `${MIRROR_BASE_URL}/api/v1/tokens/${tokenId}/nfts/${serialNumber}`
  );
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Mirror Node error: ${res.status} ${res.statusText}`);
  }

  const nft = (await res.json()) as { token_id: string; serial_number: number; account_id: string; metadata: string };
  return {
    token_id: nft.token_id,
    serial_number: nft.serial_number,
    account_id: nft.account_id,
    metadata: nft.metadata,
  };
}


/**
 * Resolve an EVM address to a Hedera Account ID via Mirror Node.
 */
export async function getAccountByEvmAddress(
  evmAddress: string
): Promise<{ accountId: string; evmAddress: string } | null> {
  try {
    const res = await fetch(`${MIRROR_BASE_URL}/api/v1/accounts/${evmAddress}`);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Mirror Node error: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as { account: string; evm_address: string };
    return { accountId: data.account, evmAddress: data.evm_address || evmAddress };
  } catch (err) {
    console.error('[Mirror] getAccountByEvmAddress failed:', err);
    return null;
  }
}

/**
 * Check if a token is associated with an account via Mirror Node.
 */
export async function isTokenAssociated(
  accountId: string,
  tokenId: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `${MIRROR_BASE_URL}/api/v1/accounts/${accountId}/tokens?token.id=${tokenId}`
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { tokens?: unknown[] };
    return (data.tokens?.length ?? 0) > 0;
  } catch {
    return false;
  }
}
