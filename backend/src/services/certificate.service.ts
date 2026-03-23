import { getSupabase } from './supabase';
import { readFile } from '../hedera/hfs.service';
import { getAccountNFTs } from '../hedera/mirror.service';
import type { Retirement, NftCertificateMetadata } from '../types';

export interface CertificateDetail {
  retirement: Retirement;
  metadata: NftCertificateMetadata | null;
  project: { project_name: string; watershed_name: string } | null;
}

/**
 * List all AVIC NFT certificates for a buyer.
 */
export async function listCertificates(buyerId: string): Promise<Retirement[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('retirements')
    .select('*')
    .eq('buyer_id', buyerId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as Retirement[];
}

/**
 * Get certificate detail with metadata from HFS.
 */
export async function getCertificateDetail(retirementId: string): Promise<CertificateDetail> {
  const supabase = getSupabase();

  const { data: retirement, error } = await supabase
    .from('retirements')
    .select('*')
    .eq('id', retirementId)
    .single();
  if (error || !retirement) throw new Error('Certificate not found');

  // Fetch metadata from HFS
  let metadata: NftCertificateMetadata | null = null;
  if (retirement.nft_metadata_hfs_file_id) {
    try {
      const content = await readFile(retirement.nft_metadata_hfs_file_id);
      metadata = JSON.parse(content) as NftCertificateMetadata;
    } catch {
      // HFS read failed — metadata unavailable
    }
  }

  // Fetch project info
  const { data: project } = await supabase
    .from('water_projects')
    .select('project_name, watershed_name')
    .eq('id', retirement.source_project_id)
    .single();

  return {
    retirement: retirement as Retirement,
    metadata,
    project: project || null,
  };
}
