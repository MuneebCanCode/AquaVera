// Revenue split on every trade (must sum to 1.0)
export const REVENUE_SPLIT = {
  SELLER: 0.70,
  COMMUNITY: 0.15,
  VERIFIER: 0.05,
  PLATFORM: 0.07,
  NETWORK: 0.03,
} as const;

// Quality tier multipliers for WSC minting
export const QUALITY_MULTIPLIERS = {
  tier_1: 1.0,  // IoT sensor only
  tier_2: 1.2,  // sensor + lab
  tier_3: 1.5,  // sensor + lab + site audit
} as const;

// Water stress zone multipliers for WSC minting
export const STRESS_MULTIPLIERS = {
  low: 1.0,
  medium: 1.3,
  high: 1.5,
  extreme: 2.0,
} as const;

// Stewardship score thresholds (offset percentage ranges)
export const STEWARDSHIP_THRESHOLDS = {
  Bronze: { min: 0, max: 25 },
  Silver: { min: 25, max: 50 },
  Gold: { min: 50, max: 75 },
  Platinum: { min: 75, max: Infinity },
} as const;

// Anomaly detection thresholds for sensor readings
export const ANOMALY_THRESHOLDS = {
  flow_rate_deviation_factor: 3,
  ph_min: 5.0,
  ph_max: 9.5,
  tds_max: 2000,
  turbidity_max: 10.0,
} as const;

// Sensor reading realistic ranges (for mock data generation)
export const SENSOR_RANGES = {
  ph: { min: 6.5, max: 8.0 },
  tds: { min: 200, max: 500 },
  turbidity: { min: 0.5, max: 3.0 },
  reservoir_level: { min: 60, max: 95 },
} as const;

// 1 WSC = 1,000 liters of verified water impact
export const LITERS_PER_WSC = 1000;

// Rate limiting defaults (generous for development; tighten for production)
export const RATE_LIMITS = {
  DEFAULT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  DEFAULT_MAX_REQUESTS: 1000,
  HEDERA_MAX_REQUESTS: 100,
} as const;

// Hedera retry configuration
export const HEDERA_RETRY = {
  MAX_ATTEMPTS: 3,
  INITIAL_DELAY_MS: 1000,
  TIMEOUT_MS: 30000,
} as const;

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
} as const;
