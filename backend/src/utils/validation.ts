import { z } from 'zod';
import {
  USER_ROLES,
  PROJECT_TYPES,
  WATER_STRESS_ZONES,
  SENSOR_TYPES,
  COMPLIANCE_FRAMEWORKS,
  REPORT_FRAMEWORKS,
  PAYMENT_METHODS,
  SETTLEMENT_METHODS,
} from '../types/enums';

// ─── Shared Validators ───────────────────────────────────────────────────────

const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);

// ─── Auth Schemas ────────────────────────────────────────────────────────────

export const registerSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
    full_name: z.string().min(1).max(200),
    organization_name: z.string().min(1).max(200),
    role: z.enum(USER_ROLES),
    industry: z.string().min(1).max(200).optional().nullable(),
    water_footprint_liters_annual: z.number().positive().optional().nullable(),
    evm_address: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.role === 'corporate_buyer') {
        return !!data.industry && data.water_footprint_liters_annual != null;
      }
      return true;
    },
    {
      message: 'Corporate buyers must provide industry and water_footprint_liters_annual',
      path: ['industry'],
    }
  );

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ─── Project Schemas ─────────────────────────────────────────────────────────

export const createProjectSchema = z.object({
  project_name: z.string().min(1).max(300),
  project_type: z.enum(PROJECT_TYPES),
  description: z.string().min(1).max(5000),
  location_name: z.string().min(1).max(300),
  latitude,
  longitude,
  watershed_name: z.string().min(1).max(300),
  water_stress_zone: z.enum(WATER_STRESS_ZONES),
  baseline_daily_liters: z.number().positive().int(),
  sensor_types: z.array(z.enum(SENSOR_TYPES)).min(1),
});

// ─── Sensor Schemas ──────────────────────────────────────────────────────────

export const sensorReadingSchema = z.object({
  project_id: z.string().uuid(),
  flow_rate_liters_per_min: z.number().nonnegative(),
  total_volume_liters: z.number().nonnegative(),
  water_quality_ph: z.number().min(0).max(14),
  water_quality_tds: z.number().nonnegative(),
  water_quality_turbidity: z.number().nonnegative(),
  reservoir_level_percent: z.number().min(0).max(100),
  gps_latitude: latitude,
  gps_longitude: longitude,
});

// ─── Marketplace Schemas ─────────────────────────────────────────────────────

export const createListingSchema = z.object({
  project_id: z.string().uuid(),
  quantity_wsc: z.number().positive(),
  price_per_wsc_hbar: z.number().positive(),
});

export const buyRequestSchema = z.object({
  listing_id: z.string().uuid(),
  quantity_wsc: z.number().positive(),
  payment_method: z.enum(PAYMENT_METHODS),
  settlement_method: z.enum(SETTLEMENT_METHODS).optional().default('atomic_transfer'),
});

// ─── Retirement Schemas ──────────────────────────────────────────────────────

export const retirementRequestSchema = z.object({
  quantity_wsc: z.number().positive(),
  purpose: z.string().min(1).max(2000),
  facility_name: z.string().max(300).optional().nullable(),
  compliance_framework: z.enum(COMPLIANCE_FRAMEWORKS),
  source_project_id: z.string().uuid(),
});

// ─── Report Schemas ──────────────────────────────────────────────────────────

export const reportGenerationSchema = z.object({
  framework: z.enum(REPORT_FRAMEWORKS),
  period_start: z.string().datetime(),
  period_end: z.string().datetime(),
});

// ─── Notification Schemas ────────────────────────────────────────────────────

export const markNotificationReadSchema = z.object({
  id: z.string().uuid(),
});

// ─── Pagination Schema ───────────────────────────────────────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(1000).optional().default(10),
});

// ─── Project Verification Schema ─────────────────────────────────────────────

export const verifyProjectSchema = z.object({
  approved: z.boolean(),
  verification_notes: z.string().max(2000).optional(),
});

// ─── Type Exports ────────────────────────────────────────────────────────────

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type SensorReadingInput = z.infer<typeof sensorReadingSchema>;
export type CreateListingInput = z.infer<typeof createListingSchema>;
export type BuyRequestInput = z.infer<typeof buyRequestSchema>;
export type RetirementRequestInput = z.infer<typeof retirementRequestSchema>;
export type ReportGenerationInput = z.infer<typeof reportGenerationSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type VerifyProjectInput = z.infer<typeof verifyProjectSchema>;
