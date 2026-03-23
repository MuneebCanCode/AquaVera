import {
  UserRole,
  ProjectType,
  WaterStressZone,
  QualityTier,
  ProjectStatus,
  ListingStatus,
  TradeStatus,
  NotificationType,
  ComplianceFramework,
  ReportFramework,
  PaymentMethod,
  SettlementMethod,
  ScheduledStatus,
  SensorType,
  StewardshipLevel,
} from './enums';

// ─── Users ───────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  full_name: string;
  organization_name: string;
  role: UserRole;
  industry: string | null;
  water_footprint_liters_annual: number | null;
  hedera_account_id: string | null;
  hedera_private_key_encrypted: string | null;
  hedera_public_key: string | null;
  hedera_did: string | null;
  evm_address: string | null;
  profile_image_url: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Water Projects ──────────────────────────────────────────────────────────

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
  sensor_types: SensorType[];
  status: ProjectStatus;
  guardian_policy_id: string | null;
  verifier_id: string | null;
  verification_date: string | null;
  verification_notes: string | null;
  hcs_topic_id: string | null;
  total_wsc_minted: number;
  supporting_documents: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// ─── Sensor Readings ─────────────────────────────────────────────────────────

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

// ─── WSC Minting Events ─────────────────────────────────────────────────────

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

// ─── Marketplace Listings ────────────────────────────────────────────────────

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
}

// ─── Trades ──────────────────────────────────────────────────────────────────

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

// ─── Retirements ─────────────────────────────────────────────────────────────

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

// ─── Community Rewards ───────────────────────────────────────────────────────

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

// ─── Notifications ───────────────────────────────────────────────────────────

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

// ─── Compliance Reports ──────────────────────────────────────────────────────

export interface ComplianceReport {
  id: string;
  buyer_id: string;
  framework: ReportFramework;
  period_start: string;
  period_end: string;
  report_data: Record<string, unknown>;
  hfs_file_id: string | null;
  created_at: string;
}

// ─── Scheduled Transactions ──────────────────────────────────────────────────

export interface ScheduledTransaction {
  id: string;
  schedule_id: string;
  transaction_type: string;
  transaction_data: Record<string, unknown>;
  status: ScheduledStatus;
  expected_execution: string;
  executed_transaction_id: string | null;
  hcs_message_id: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Minting Calculation ─────────────────────────────────────────────────────

export interface MintingCalculation {
  net_water_impact_liters: number;
  base_credits: number;
  quality_tier: QualityTier;
  quality_multiplier: number;
  stress_zone: WaterStressZone;
  stress_multiplier: number;
  final_wsc_minted: number;
}

// ─── API Response Types ──────────────────────────────────────────────────────

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ─── HCS Message Types ───────────────────────────────────────────────────────

export interface HcsAuditMessage {
  event_type: string;
  timestamp: string;
  entity_id: string;
  actor_did: string;
  data_hash: string;
  metadata: Record<string, unknown>;
}

// ─── NFT Certificate Metadata ────────────────────────────────────────────────

export interface NftCertificateMetadata {
  certificateId: string;
  issuedTo: string;
  issuedToDID: string;
  quantityRetired: number;
  equivalentLiters: number;
  sourceProject: string;
  sourceProjectId: string;
  watershed: string;
  qualityTier: QualityTier;
  waterStressZone: WaterStressZone;
  retirementDate: string;
  purpose: string;
  complianceFramework: string;
  guardianVerificationRef: string;
  hcsRetirementMessageId: string;
  verificationURL: string;
}
