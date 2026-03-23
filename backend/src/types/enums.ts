// User roles
export const USER_ROLES = ['project_operator', 'corporate_buyer', 'verifier', 'admin'] as const;
export type UserRole = typeof USER_ROLES[number];

// Water project types
export const PROJECT_TYPES = ['conservation', 'restoration', 'recycling', 'access', 'efficiency'] as const;
export type ProjectType = typeof PROJECT_TYPES[number];

// Water stress zones
export const WATER_STRESS_ZONES = ['low', 'medium', 'high', 'extreme'] as const;
export type WaterStressZone = typeof WATER_STRESS_ZONES[number];

// Quality tiers
export const QUALITY_TIERS = ['tier_1', 'tier_2', 'tier_3'] as const;
export type QualityTier = typeof QUALITY_TIERS[number];

// Project statuses
export const PROJECT_STATUSES = ['registered', 'pending_verification', 'active', 'suspended'] as const;
export type ProjectStatus = typeof PROJECT_STATUSES[number];

// Marketplace listing statuses
export const LISTING_STATUSES = ['active', 'partially_filled', 'sold', 'cancelled'] as const;
export type ListingStatus = typeof LISTING_STATUSES[number];

// Trade statuses
export const TRADE_STATUSES = ['completed', 'failed', 'pending'] as const;
export type TradeStatus = typeof TRADE_STATUSES[number];

// Notification types
export const NOTIFICATION_TYPES = ['trade', 'verification', 'minting', 'retirement', 'reward', 'system'] as const;
export type NotificationType = typeof NOTIFICATION_TYPES[number];

// Compliance frameworks
export const COMPLIANCE_FRAMEWORKS = ['GRI 303', 'CDP Water Security', 'CSRD', 'ISSB S2', 'Custom'] as const;
export type ComplianceFramework = typeof COMPLIANCE_FRAMEWORKS[number];

// Report frameworks (for generation)
export const REPORT_FRAMEWORKS = ['gri_303', 'cdp_water', 'csrd', 'issb_s2', 'full_esg'] as const;
export type ReportFramework = typeof REPORT_FRAMEWORKS[number];

// Payment methods
export const PAYMENT_METHODS = ['hbar', 'avusd'] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];

// Settlement methods
export const SETTLEMENT_METHODS = ['atomic_transfer', 'smart_contract'] as const;
export type SettlementMethod = typeof SETTLEMENT_METHODS[number];

// Scheduled transaction statuses
export const SCHEDULED_STATUSES = ['pending', 'executed', 'expired'] as const;
export type ScheduledStatus = typeof SCHEDULED_STATUSES[number];

// Sensor types
export const SENSOR_TYPES = ['flow_meter', 'quality_sensor', 'level_sensor'] as const;
export type SensorType = typeof SENSOR_TYPES[number];

// Stewardship score levels
export const STEWARDSHIP_LEVELS = ['Bronze', 'Silver', 'Gold', 'Platinum'] as const;
export type StewardshipLevel = typeof STEWARDSHIP_LEVELS[number];
