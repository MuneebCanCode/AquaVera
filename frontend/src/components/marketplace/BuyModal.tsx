'use client';

import { useState } from 'react';
import { ShoppingCart, Wallet, ExternalLink, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { formatNumber, formatHbar } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useWallet } from '@/lib/wallet';
import { getHashScanTxUrl } from '@/lib/wallet-utils';
import { toast } from 'sonner';
import type { MarketplaceListing, Trade } from '@/types';

interface Props {
  listing: MarketplaceListing;
  onClose: () => void;
  onSuccess: () => void;
}

type TxStatus = 'idle' | 'processing' | 'confirming' | 'success' | 'error' | 'cancelled';

const SPLIT = { seller: 0.70, community: 0.15, verifier: 0.05, platform: 0.07, network: 0.03 };

export function BuyModal({ listing, onClose, onSuccess }: Props) {
  const [quantity, setQuantity] = useState(listing.quantity_remaining);
  const [paymentMethod, setPaymentMethod] = useState<'hbar' | 'avusd'>('hbar');
  const [loading, setLoading] = useState(false);

  // MetaMask transaction state
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const wallet = useWallet();
  const isWalletConnected = wallet.status === 'connected';

  const total = quantity * listing.price_per_wsc_hbar;
  const breakdown = {
    seller: total * SPLIT.seller,
    community: total * SPLIT.community,
    verifier: total * SPLIT.verifier,
    platform: total * SPLIT.platform,
    network: total * SPLIT.network,
  };

  /** Original server-side buy flow for non-wallet users */
  async function handleBuy() {
    if (quantity <= 0 || quantity > listing.quantity_remaining) return;
    setLoading(true);
    const res = await api.post<Trade>('/marketplace/buy', {
      listing_id: listing.id,
      quantity_wsc: quantity,
      payment_method: paymentMethod,
    });
    setLoading(false);
    if (res.success) {
      toast.success(`Purchased ${formatNumber(quantity)} WSC`);
      onSuccess();
    } else {
      toast.error(res.error?.message || 'Purchase failed');
    }
  }

  /** MetaMask-identified buy flow: backend executes the trade server-side */
  async function handleMetaMaskBuy() {
    if (quantity <= 0 || quantity > listing.quantity_remaining) return;

    setTxStatus('processing');
    setTxError(null);
    setTxHash(null);

    try {
      console.log('[BuyModal] Initiating MetaMask buy:', {
        listingId: listing.id,
        quantityWsc: quantity,
        buyerEvmAddress: wallet.evmAddress,
      });

      // Call buy-confirm endpoint — backend handles the actual token transfer
      const res = await api.post<Trade & { txHash?: string }>('/marketplace/buy-confirm', {
        listingId: listing.id,
        quantityWsc: quantity,
        buyerEvmAddress: wallet.evmAddress,
      });

      if (!res.success) {
        const errorMsg = res.error?.message || 'Purchase failed';
        console.error('[BuyModal] Buy-confirm failed:', errorMsg);
        setTxStatus('error');
        setTxError(errorMsg);
        return;
      }

      // Extract transaction hash from the response
      const resultTxHash =
        res.data?.txHash ||
        res.data?.hedera_transaction_id ||
        res.data?.settlement_tx_hash ||
        null;

      setTxStatus('confirming');

      if (resultTxHash) {
        setTxHash(resultTxHash);
        console.log('[BuyModal] Trade confirmed, tx:', resultTxHash);
      }

      setTxStatus('success');
      toast.success(`Purchased ${formatNumber(quantity)} WSC via MetaMask wallet`);
    } catch (err) {
      console.error('[BuyModal] MetaMask buy error:', err);
      const message = err instanceof Error ? err.message : 'Transaction failed';

      // Check if user rejected in MetaMask
      const errAny = err as { code?: number };
      if (errAny.code === 4001) {
        setTxStatus('cancelled');
        setTxError('Transaction cancelled by user');
      } else {
        setTxStatus('error');
        setTxError(message);
      }
    }
  }

  function handleRetry() {
    setTxStatus('idle');
    setTxError(null);
    setTxHash(null);
  }

  /** Render the transaction status overlay when a MetaMask buy is in progress */
  function renderTxStatus() {
    if (txStatus === 'processing') {
      return (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal" />
          <p className="text-sm font-medium text-gray-700">Processing purchase...</p>
          <p className="text-xs text-gray-500">The server is executing the trade on Hedera Testnet.</p>
        </div>
      );
    }

    if (txStatus === 'confirming') {
      return (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal" />
          <p className="text-sm font-medium text-gray-700">Confirming transaction...</p>
          {txHash && (
            <a
              href={getHashScanTxUrl(txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-teal hover:text-teal-600"
            >
              View on HashScan <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      );
    }

    if (txStatus === 'success') {
      return (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
          <p className="text-sm font-medium text-gray-700">Purchase successful!</p>
          <p className="text-xs text-gray-500">
            {formatNumber(quantity)} WSC credits have been transferred to your account.
          </p>
          {txHash && (
            <a
              href={getHashScanTxUrl(txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-teal hover:text-teal-600 font-medium"
            >
              View transaction on HashScan <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <Button onClick={onSuccess} className="mt-2">
            Done
          </Button>
        </div>
      );
    }

    if (txStatus === 'cancelled') {
      return (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <AlertCircle className="h-8 w-8 text-yellow-500" />
          <p className="text-sm font-medium text-gray-700">Transaction cancelled</p>
          <p className="text-xs text-gray-500">{txError || 'The transaction was cancelled.'}</p>
          <Button onClick={handleRetry} variant="outline" className="mt-2">
            Try Again
          </Button>
        </div>
      );
    }

    if (txStatus === 'error') {
      return (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <AlertCircle className="h-8 w-8 text-red-500" />
          <p className="text-sm font-medium text-gray-700">Transaction failed</p>
          <p className="text-xs text-gray-500">{txError || 'An unexpected error occurred.'}</p>
          <Button onClick={handleRetry} variant="outline" className="mt-2">
            Retry
          </Button>
        </div>
      );
    }

    return null;
  }

  return (
    <Modal open onClose={onClose} title="Buy Water Credits">
      <div className="space-y-4">
        {/* Transaction status overlay — shown when MetaMask buy is in progress */}
        {txStatus !== 'idle' ? (
          renderTxStatus()
        ) : (
          <>
            {/* Listing Info */}
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={listing.credit_type} />
              <StatusBadge status={listing.quality_tier} />
              <StatusBadge status={listing.water_stress_zone} />
            </div>
            <p className="text-sm text-gray-500">{listing.watershed_name}</p>

            {/* Quantity */}
            <Input
              label={`Quantity (max ${formatNumber(listing.quantity_remaining)} WSC)`}
              type="number"
              min={1}
              max={listing.quantity_remaining}
              value={quantity}
              onChange={(e) => setQuantity(Math.min(listing.quantity_remaining, Math.max(0, parseInt(e.target.value) || 0)))}
            />

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
              <div className="flex gap-2">
                {(['hbar', 'avusd'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      paymentMethod === m ? 'bg-teal text-white border-teal' : 'bg-white text-gray-600 border-gray-300 hover:border-teal'
                    }`}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Cost Breakdown */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between font-medium text-gray-900">
                <span>Total Cost</span>
                <span>{formatHbar(total)}</span>
              </div>
              <hr className="border-gray-200" />
              <div className="flex justify-between text-gray-500"><span>Seller receives (70%)</span><span>{formatHbar(breakdown.seller)}</span></div>
              <div className="flex justify-between text-gray-500"><span>Community fund (15%)</span><span>{formatHbar(breakdown.community)}</span></div>
              <div className="flex justify-between text-gray-500"><span>Verifier share (5%)</span><span>{formatHbar(breakdown.verifier)}</span></div>
              <div className="flex justify-between text-gray-500"><span>Platform fee (7%)</span><span>{formatHbar(breakdown.platform)}</span></div>
              <div className="flex justify-between text-gray-500"><span>Network fees (3%)</span><span>{formatHbar(breakdown.network)}</span></div>
            </div>

            {/* Buy Buttons */}
            {isWalletConnected ? (
              <Button onClick={handleMetaMaskBuy} className="w-full" disabled={quantity <= 0}>
                <Wallet className="h-4 w-4" /> Confirm Purchase with MetaMask
              </Button>
            ) : (
              <Button loading={loading} onClick={handleBuy} className="w-full" disabled={quantity <= 0}>
                <ShoppingCart className="h-4 w-4" /> Confirm Purchase
              </Button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
