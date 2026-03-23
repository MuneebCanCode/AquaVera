'use client';

/**
 * WalletProvider — React context managing all MetaMask interaction state.
 * Handles connection, disconnection, chain enforcement, HTS precompile calls,
 * and localStorage persistence for the AquaVera platform.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { BrowserProvider, Contract } from 'ethers';
import { tokenIdToEvmAddress } from '@/lib/wallet-utils';
import { api } from '@/lib/api';

// ─── Constants ───────────────────────────────────────────────────────────────

const HEDERA_TESTNET_CHAIN_ID = 296;
const HEDERA_TESTNET_CHAIN_ID_HEX = '0x128';

const HEDERA_TESTNET_CONFIG = {
  chainId: HEDERA_TESTNET_CHAIN_ID_HEX,
  chainName: 'Hedera Testnet',
  nativeCurrency: { name: 'HBAR', symbol: 'HBAR', decimals: 18 },
  rpcUrls: ['https://testnet.hashio.io/api'],
  blockExplorerUrls: ['https://hashscan.io/testnet'],
};

const HTS_PRECOMPILE_ADDRESS = '0x0000000000000000000000000000000000000167';

const HTS_PRECOMPILE_ABI = [
  'function associateToken(address account, address token) external returns (int64)',
  'function transferToken(address token, address sender, address receiver, int64 amount) external returns (int64)',
];

const STORAGE_KEY = 'aquavera_wallet';

// ─── Types ───────────────────────────────────────────────────────────────────

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface TransferTokenParams {
  tokenAddress: string;
  from: string;
  to: string;
  amount: bigint;
}

interface WalletContextValue {
  status: ConnectionStatus;
  evmAddress: string | null;
  hederaAccountId: string | null;
  chainId: number | null;
  tokenAssociated: boolean;
  connect: () => Promise<{ evmAddress: string } | { error: string }>;
  disconnect: () => Promise<void>;
  associateToken: (tokenId: string) => Promise<{ txHash: string } | { error: string }>;
  transferToken: (params: TransferTokenParams) => Promise<{ txHash: string } | { error: string }>;
  isMetaMaskInstalled: boolean;
  getProvider: () => BrowserProvider | null;
}

const WalletContext = createContext<WalletContextValue | null>(null);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getEthereum(): (typeof window)['ethereum'] | undefined {
  if (typeof window !== 'undefined') return window.ethereum;
  return undefined;
}

function parseChainId(raw: string | number): number {
  if (typeof raw === 'number') return raw;
  return parseInt(raw, 16);
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function WalletProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [evmAddress, setEvmAddress] = useState<string | null>(null);
  const [hederaAccountId, setHederaAccountId] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [tokenAssociated, setTokenAssociated] = useState(false);
  const mountedRef = useRef(true);

  const isMetaMaskInstalled = typeof window !== 'undefined' && !!window.ethereum;

  // ── getProvider ──────────────────────────────────────────────────────────

  const getProvider = useCallback((): BrowserProvider | null => {
    const ethereum = getEthereum();
    if (!ethereum) return null;
    return new BrowserProvider(ethereum);
  }, []);

  // ── Chain enforcement ────────────────────────────────────────────────────

  const ensureHederaTestnet = useCallback(async () => {
    const ethereum = getEthereum();
    if (!ethereum) return;

    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: HEDERA_TESTNET_CHAIN_ID_HEX }],
      });
    } catch (err: unknown) {
      const switchError = err as { code?: number };
      // 4902 = chain not added yet
      if (switchError.code === 4902) {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [HEDERA_TESTNET_CONFIG],
        });
      } else {
        throw err;
      }
    }
  }, []);

  // ── Connect ────────────────────────────────────────────────────────────

  const connect = useCallback(async (): Promise<{ evmAddress: string } | { error: string }> => {
    const ethereum = getEthereum();
    if (!ethereum) {
      return { error: 'MetaMask is not installed' };
    }

    setStatus('connecting');

    try {
      // Request accounts (triggers MetaMask popup)
      const accounts = (await ethereum.request({
        method: 'eth_requestAccounts',
      })) as string[];

      if (!accounts.length) {
        setStatus('disconnected');
        return { error: 'No accounts returned from MetaMask' };
      }

      const address = accounts[0].toLowerCase();

      // Enforce Hedera Testnet
      await ensureHederaTestnet();

      // Get current chain ID
      const rawChainId = (await ethereum.request({ method: 'eth_chainId' })) as string;
      if (mountedRef.current) {
        setChainId(parseChainId(rawChainId));
      }

      // Resolve Hedera account ID via backend
      let resolvedAccountId: string | null = null;
      let isTokenAssociated = false;
      try {
        const res = await api.post<{ hederaAccountId: string; tokenAssociated: boolean }>(
          '/wallet/connect',
          { evmAddress: address }
        );
        if (res.success && res.data) {
          resolvedAccountId = res.data.hederaAccountId;
          isTokenAssociated = res.data.tokenAssociated;
        }
      } catch (err) {
        console.warn('[Wallet] Backend connect call failed, continuing without Hedera account ID:', err);
      }

      if (mountedRef.current) {
        setEvmAddress(address);
        setHederaAccountId(resolvedAccountId);
        setTokenAssociated(isTokenAssociated);
        setStatus('connected');
      }

      // Persist to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, address);
      }

      console.log('[Wallet] Connected:', address, 'Hedera:', resolvedAccountId);
      return { evmAddress: address };
    } catch (err: unknown) {
      console.error('[Wallet] Connection failed:', err);
      if (mountedRef.current) {
        setStatus('disconnected');
      }
      const message = err instanceof Error ? err.message : 'Connection failed';
      return { error: message };
    }
  }, [ensureHederaTestnet]);

  // ── Disconnect ─────────────────────────────────────────────────────────

  const disconnect = useCallback(async () => {
    setEvmAddress(null);
    setHederaAccountId(null);
    setChainId(null);
    setTokenAssociated(false);
    setStatus('disconnected');

    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }

    // Notify backend
    try {
      await api.post('/wallet/disconnect');
    } catch (err) {
      console.warn('[Wallet] Backend disconnect call failed:', err);
    }

    console.log('[Wallet] Disconnected');
  }, []);

  // ── Associate Token ────────────────────────────────────────────────────

  const associateToken = useCallback(
    async (tokenId: string): Promise<{ txHash: string } | { error: string }> => {
      const provider = getProvider();
      if (!provider || !evmAddress) {
        return { error: 'Wallet not connected' };
      }

      try {
        const signer = await provider.getSigner();
        const contract = new Contract(HTS_PRECOMPILE_ADDRESS, HTS_PRECOMPILE_ABI, signer);

        const tokenEvmAddress = tokenIdToEvmAddress(tokenId);
        console.log('[Wallet] Associating token:', tokenId, '→', tokenEvmAddress);

        const tx = await contract.associateToken(evmAddress, tokenEvmAddress, {
          gasLimit: 1_000_000,
        });
        const receipt = await tx.wait();

        console.log('[Wallet] Token associated, tx:', receipt.hash);
        setTokenAssociated(true);
        return { txHash: receipt.hash };
      } catch (err: unknown) {
        console.error('[Wallet] Token association failed:', err);
        const message = err instanceof Error ? err.message : 'Token association failed';
        return { error: message };
      }
    },
    [getProvider, evmAddress]
  );

  // ── Transfer Token ─────────────────────────────────────────────────────

  const transferToken = useCallback(
    async (params: TransferTokenParams): Promise<{ txHash: string } | { error: string }> => {
      const provider = getProvider();
      if (!provider) {
        return { error: 'Wallet not connected' };
      }

      try {
        const signer = await provider.getSigner();
        const contract = new Contract(HTS_PRECOMPILE_ADDRESS, HTS_PRECOMPILE_ABI, signer);

        console.log('[Wallet] Transferring token:', params);

        const tx = await contract.transferToken(
          params.tokenAddress,
          params.from,
          params.to,
          params.amount
        );
        const receipt = await tx.wait();

        console.log('[Wallet] Transfer complete, tx:', receipt.hash);
        return { txHash: receipt.hash };
      } catch (err: unknown) {
        console.error('[Wallet] Transfer failed:', err);
        const message = err instanceof Error ? err.message : 'Token transfer failed';
        return { error: message };
      }
    },
    [getProvider]
  );

  // ── MetaMask event listeners & localStorage restore ────────────────────

  useEffect(() => {
    mountedRef.current = true;
    const ethereum = getEthereum();

    // Restore from localStorage (passive check, no popup)
    const restoreSession = async () => {
      if (!ethereum) return;

      const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (!stored) return;

      try {
        // Passive check — eth_accounts does NOT trigger a popup
        const accounts = (await ethereum.request({ method: 'eth_accounts' })) as string[];
        const stillConnected = accounts.some((a) => a.toLowerCase() === stored.toLowerCase());

        if (stillConnected && mountedRef.current) {
          setEvmAddress(stored.toLowerCase());
          setStatus('connected');

          // Get chain ID
          const rawChainId = (await ethereum.request({ method: 'eth_chainId' })) as string;
          if (mountedRef.current) {
            setChainId(parseChainId(rawChainId));
          }

          // Resolve Hedera account ID from backend
          try {
            const res = await api.post<{ hederaAccountId: string; tokenAssociated: boolean }>(
              '/wallet/connect',
              { evmAddress: stored.toLowerCase() }
            );
            if (res.success && res.data && mountedRef.current) {
              setHederaAccountId(res.data.hederaAccountId);
            }
          } catch {
            console.warn('[Wallet] Could not resolve Hedera account on restore');
          }

          console.log('[Wallet] Session restored for:', stored);
        } else {
          // MetaMask no longer has this account connected — clean up
          if (typeof window !== 'undefined') {
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch (err) {
        console.warn('[Wallet] Session restore failed:', err);
        if (typeof window !== 'undefined') {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    };

    restoreSession();

    // Event handlers
    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = (args[0] ?? []) as string[];
      if (!mountedRef.current) return;

      if (accounts.length === 0) {
        // User disconnected from MetaMask
        setEvmAddress(null);
        setHederaAccountId(null);
        setStatus('disconnected');
        if (typeof window !== 'undefined') {
          localStorage.removeItem(STORAGE_KEY);
        }
        console.log('[Wallet] Account disconnected via MetaMask');
      } else {
        const newAddress = accounts[0].toLowerCase();
        setEvmAddress(newAddress);
        setStatus('connected');
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, newAddress);
        }

        // Re-resolve Hedera account for new address
        api
          .post<{ hederaAccountId: string; tokenAssociated: boolean }>('/wallet/connect', {
            evmAddress: newAddress,
          })
          .then((res) => {
            if (res.success && res.data && mountedRef.current) {
              setHederaAccountId(res.data.hederaAccountId);
            }
          })
          .catch(() => {
            console.warn('[Wallet] Could not resolve Hedera account after account change');
          });

        console.log('[Wallet] Account changed to:', newAddress);
      }
    };

    const handleChainChanged = (...args: unknown[]) => {
      const rawChainId = args[0] as string;
      if (!mountedRef.current) return;

      const newChainId = parseChainId(rawChainId);
      setChainId(newChainId);

      console.log('[Wallet] Chain changed to:', newChainId);

      if (newChainId !== HEDERA_TESTNET_CHAIN_ID) {
        // Prompt switch back to Hedera Testnet
        ensureHederaTestnet().catch((err) => {
          console.error('[Wallet] Failed to switch back to Hedera Testnet:', err);
        });
      }
    };

    if (ethereum) {
      ethereum.on('accountsChanged', handleAccountsChanged);
      ethereum.on('chainChanged', handleChainChanged);
    }

    return () => {
      mountedRef.current = false;
      if (ethereum) {
        ethereum.removeListener('accountsChanged', handleAccountsChanged);
        ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [ensureHederaTestnet]);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <WalletContext.Provider
      value={{
        status,
        evmAddress,
        hederaAccountId,
        chainId,
        tokenAssociated,
        connect,
        disconnect,
        associateToken,
        transferToken,
        isMetaMaskInstalled,
        getProvider,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
