// ─── Enum Types ──────────────────────────────────────────────────────────────

export type UserRole = 'project_operator' | 'corporate_buyer' | 'verifier' | 'admin';
export type ProjectType = 'conservation' | 'restoration' | 'recycling' | 'access' | 'efficiency';
export type WaterStressZone = 'low' | 'medium' | 'high' | 'extreme';
export type QualityTier = 'tier_1' | 'tier_2' | 'tier_3';
export type ListingStatus = 'active' | 'partially_filled' | 'sold' | 'cancelled';
export type TradeStatus = 'completed' | 'failed' | 'pending';
export type ProjectStatus = 'registered' | 'pending_verification' | 'active' | 'suspended';
export type ComplianceFramework = 'gri_303' | 'cdp_water' | 'csrd' | 'issb_s2' | 'full_esg';
export type NotificationType = 'trade' | 'verification' | 'minting' | 'retirement' | 'reward' | 'system';
export type PaymentMethod = 'hbar' | 'avusd';
export type SettlementMethod = 'atomic_transfer' | 'smart_contract';
export type StewardshipLevel = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

// ─── Data Models ─────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  full_name: string;
  organization_name: string;
  role: UserRole;
  industry: string | null;
  water_footprint_liters_annual: number | null;
  hedera_account_id: string | null;
  hedera_public_key: string | null;
  hedera_did: string | null;
  evm_address: string | null;
  profile_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface WaterProject {
  id: string;
  owner_id: string;
  project_name: string;
  project_type: ProjectType;
  description: string;
  location_name: string;
  latitude: number;
  longitude: number;
  watershed_name: string;
  water_stress_zone: WaterStressZone;
  baseline_daily_liters: number;
  sensor_types: string[];
  status: ProjectStatus;
  guardian_policy_id: string | null;
  verifier_id: string | null;
  verification_date: string | null;
  verification_notes: string | null;
  hcs_topic_id: string;
  total_wsc_minted: number;
  supporting_documents: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}


export interface SensorReading {
  id: string;
  project_id: string;
  flow_rate_liters_per_min: number;
  total_volume_liters: number;
  water_quality_ph: number;
  water_quality_tds: number;
  water_quality_turbidity: number;
  reservoir_level_percent: number;
  gps_latitude: number;
  gps_longitude: number;
  data_hash: string;
  is_anomaly: boolean;
  is_verified: boolean;
  hcs_message_id: string | null;
  hcs_consensus_timestamp: string | null;
  reading_timestamp: string;
  created_at: string;
}

export interface WscMintingEvent {
  id: string;
  project_id: string;
  verification_period_start: string;
  verification_period_end: string;
  net_water_impact_liters: number;
  base_credits: number;
  quality_tier: QualityTier;
  quality_multiplier: number;
  stress_multiplier: number;
  final_wsc_minted: number;
  hedera_transaction_id: string;
  hcs_message_id: string;
  guardian_verification_ref: string;
  created_at: string;
}

export interface MarketplaceListing {
  id: string;
  seller_id: string;
  project_id: string;
  quantity_wsc: number;
  price_per_wsc_hbar: number;
  credit_type: string;
  quality_tier: QualityTier;
  watershed_name: string;
  water_stress_zone: WaterStressZone;
  quantity_remaining: number;
  status: ListingStatus;
  created_at: string;
  updated_at: string;
  // Joined fields
  seller_organization?: string;
  project_name?: string;
}

export interface Trade {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  project_id: string;
  quantity_wsc: number;
  price_per_wsc_hbar: number;
  total_hbar: number;
  platform_fee_hbar: number;
  community_fund_hbar: number;
  verifier_fee_hbar: number;
  seller_receives_hbar: number;
  payment_method: PaymentMethod;
  settlement_method: SettlementMethod;
  hedera_transaction_id: string;
  hcs_message_id: string;
  settlement_tx_hash: string | null;
  status: TradeStatus;
  created_at: string;
}

export interface Retirement {
  id: string;
  buyer_id: string;
  quantity_wsc_retired: number;
  equivalent_liters: number;
  purpose: string;
  facility_name: string | null;
  source_project_id: string;
  source_watershed: string;
  compliance_framework: string;
  hedera_burn_transaction_id: string;
  hcs_retirement_message_id: string;
  nft_certificate_token_id: string;
  nft_certificate_serial: number;
  nft_metadata_hfs_file_id: string;
  verifiable_credential_id: string;
  created_at: string;
}

export interface CommunityReward {
  id: string;
  project_id: string;
  trade_id: string;
  reward_amount_hbar: number;
  recipient_hedera_account_id: string;
  hedera_transaction_id: string;
  hcs_message_id: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

export interface ComplianceReport {
  id: string;
  buyer_id: string;
  framework: ComplianceFramework;
  period_start: string;
  period_end: string;
  report_data: Record<string, unknown>;
  hfs_file_id: string | null;
  created_at: string;
}

export interface ScheduledTransaction {
  id: string;
  schedule_id: string;
  transaction_type: string;
  transaction_data: Record<string, unknown>;
  status: 'pending' | 'executed' | 'expired';
  expected_execution: string;
  executed_transaction_id: string | null;
  hcs_message_id: string | null;
  created_at: string;
  updated_at: string;
}

// ─── API Response Types ──────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    requestId: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

export interface DashboardStats {
  totalUsers?: number;
  totalProjects?: number;
  totalWscMinted?: number;
  totalTradesCompleted?: number;
  totalRetirements?: number;
  totalCommunityRewards?: number;
  totalLitersVerified?: number;
  wscBalance?: number;
  wscRetired?: number;
  netOffsetPercentage?: number;
  stewardshipLevel?: StewardshipLevel;
}

export interface PlatformStats {
  totalWscMinted: number;
  totalLitersVerified: number;
  totalActiveProjects: number;
  totalCorporateBuyers: number;
  totalCreditsRetired: number;
}
