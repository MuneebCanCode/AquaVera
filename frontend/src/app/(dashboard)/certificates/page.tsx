'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Award, Droplets, ExternalLink, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { formatNumber, formatLiters } from '@/lib/utils';
import { Card, CardTitle } from '@/components/ui/Card';
import { HashScanLink } from '@/components/ui/HashScanLink';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { toast } from 'sonner';
import type { Retirement } from '@/types';

export default function CertificatesPage() {
  const [certificates, setCertificates] = useState<Retirement[]>([]);
  const [selected, setSelected] = useState<Retirement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Retirement[]>('/certificates').then((res) => {
      if (res.success && res.data) setCertificates(res.data);
      else toast.error(res.error?.message || 'Failed to load certificates');
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner size="lg" label="Loading certificates..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Impact Certificates (AVIC NFTs)</h2>
          <p className="text-sm text-gray-500 mt-1">{certificates.length} certificate{certificates.length !== 1 ? 's' : ''} issued</p>
        </div>
        <Link href="/retire">
          <Button size="sm"><Award className="h-4 w-4" /> Retire Credits</Button>
        </Link>
      </div>

      {certificates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {certificates.map((cert) => (
            <div key={cert.id} className="card border-teal/20 bg-gradient-to-br from-white to-teal-50/30 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelected(cert)}>
              {/* Header */}
              <div className="flex items-center gap-2 mb-3">
                <div className="h-10 w-10 rounded-full bg-teal/10 flex items-center justify-center">
                  <Award className="h-5 w-5 text-teal" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">AVIC #{cert.nft_certificate_serial}</p>
                  <p className="text-xs text-gray-500">AquaVera Impact Certificate</p>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-500">Quantity Retired</span>
                  <span className="font-medium">{formatNumber(cert.quantity_wsc_retired)} WSC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Equivalent Liters</span>
                  <span className="font-medium">{formatLiters(cert.equivalent_liters)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Watershed</span>
                  <span className="font-medium">{cert.source_watershed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Framework</span>
                  <StatusBadge status={cert.compliance_framework} />
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Date</span>
                  <span className="font-medium">{new Date(cert.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Links */}
              <div className="flex flex-col gap-2">
                {cert.nft_certificate_token_id && (
                  <HashScanLink entityType="token" entityId={cert.nft_certificate_token_id} label="View NFT on HashScan" />
                )}
                {cert.hedera_burn_transaction_id && (
                  <HashScanLink entityType="transaction" entityId={cert.hedera_burn_transaction_id} label="View Burn Tx" />
                )}
                <Link href={`/verify/${cert.id}`} className="text-sm text-teal hover:underline flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> Public Verification Page
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <div className="text-center py-12">
            <Award className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">No certificates yet. Retire credits to earn AVIC NFTs.</p>
            <Link href="/retire" className="mt-3 inline-block">
              <Button size="sm" variant="outline">Retire Credits</Button>
            </Link>
          </div>
        </Card>
      )}
      {/* Detail Modal */}
      {selected && (
        <Modal open={!!selected} onClose={() => setSelected(null)} title={`AVIC #${selected.nft_certificate_serial}`}>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Quantity Retired</span><span className="font-medium">{formatNumber(selected.quantity_wsc_retired)} WSC</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Equivalent Liters</span><span className="font-medium">{formatLiters(selected.equivalent_liters)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Watershed</span><span className="font-medium">{selected.source_watershed}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Framework</span><span className="font-medium">{selected.compliance_framework}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Purpose</span><span className="font-medium text-right max-w-[200px]">{selected.purpose}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Date</span><span className="font-medium">{new Date(selected.created_at).toLocaleDateString()}</span></div>
            <hr className="border-gray-200" />
            <p className="text-xs font-semibold text-gray-700 uppercase">Hedera References</p>
            <div className="flex justify-between items-center"><span className="text-gray-500">Burn Tx</span>{selected.hedera_burn_transaction_id ? <HashScanLink entityType="transaction" entityId={selected.hedera_burn_transaction_id} /> : <span className="text-gray-400">—</span>}</div>
            <div className="flex justify-between items-center"><span className="text-gray-500">HCS Message</span>{selected.hcs_retirement_message_id ? <HashScanLink entityType="topic" entityId={selected.hcs_retirement_message_id} /> : <span className="text-gray-400">—</span>}</div>
            <div className="flex justify-between items-center"><span className="text-gray-500">NFT Token</span>{selected.nft_certificate_token_id ? <HashScanLink entityType="token" entityId={selected.nft_certificate_token_id} /> : <span className="text-gray-400">—</span>}</div>
            <div className="flex justify-between"><span className="text-gray-500">NFT Serial</span><span className="font-medium">#{selected.nft_certificate_serial}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Metadata HFS</span><span className="font-mono text-xs">{selected.nft_metadata_hfs_file_id}</span></div>
            <div><span className="text-gray-500">VC ID</span><p className="font-mono text-xs break-all mt-1">{selected.verifiable_credential_id}</p></div>
            <hr className="border-gray-200" />
            <Link href={`/verify/${selected.id}`} className="text-sm text-teal hover:underline flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Open Public Verification Page
            </Link>
          </div>
        </Modal>
      )}
    </div>
  );
}
