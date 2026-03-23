import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from './supabase';
import { createFile } from '../hedera/hfs.service';
import { submitMessage } from '../hedera/hcs.service';
import { hashData } from '../utils/hashing';
import { LITERS_PER_WSC } from '../utils/constants';
import type { ComplianceReport } from '../types';
import type { ReportFramework } from '../types/enums';

/**
 * Generate a compliance report for a buyer.
 */
export async function generateReport(
  buyerId: string,
  buyerOrgName: string,
  buyerWaterFootprint: number | null,
  framework: ReportFramework,
  periodStart: string,
  periodEnd: string
): Promise<ComplianceReport> {
  const supabase = getSupabase();

  // Fetch retirements in period
  const { data: retirements } = await supabase
    .from('retirements')
    .select('*')
    .eq('buyer_id', buyerId)
    .gte('created_at', periodStart)
    .lte('created_at', periodEnd);

  // Fetch trades in period
  const { data: trades } = await supabase
    .from('trades')
    .select('*')
    .eq('buyer_id', buyerId)
    .gte('created_at', periodStart)
    .lte('created_at', periodEnd);

  const totalWscPurchased = (trades || []).reduce((sum: number, t: { quantity_wsc: number }) => sum + t.quantity_wsc, 0);
  const totalWscRetired = (retirements || []).reduce((sum: number, r: { quantity_wsc_retired: number }) => sum + r.quantity_wsc_retired, 0);
  const equivalentLiters = totalWscRetired * LITERS_PER_WSC;
  const offsetPercent = buyerWaterFootprint ? (equivalentLiters / buyerWaterFootprint) * 100 : 0;

  // Build report data based on framework
  const reportData = buildReportData(framework, {
    companyName: buyerOrgName,
    totalWaterUsage: buyerWaterFootprint || 0,
    totalWscPurchased,
    totalWscRetired,
    equivalentLiters,
    offsetPercent,
    retirements: retirements || [],
    trades: trades || [],
    periodStart,
    periodEnd,
  });

  // Store on HFS
  let hfsFileId: string | null = null;
  try {
    const { fileId } = await createFile(JSON.stringify(reportData));
    hfsFileId = fileId;
  } catch {
    // HFS storage is optional — continue without it
  }

  // Log to HCS
  const now = new Date().toISOString();
  const mainTopicId = process.env.HCS_MAIN_TOPIC_ID;
  if (mainTopicId) {
    await submitMessage(mainTopicId, {
      event_type: 'compliance_report_generated',
      timestamp: now,
      entity_id: buyerId,
      actor_did: '',
      data_hash: hashData(reportData),
      metadata: { framework, period_start: periodStart, period_end: periodEnd, hfs_file_id: hfsFileId },
    });
  }

  const report: ComplianceReport = {
    id: uuidv4(),
    buyer_id: buyerId,
    framework,
    period_start: periodStart,
    period_end: periodEnd,
    report_data: reportData,
    hfs_file_id: hfsFileId,
    created_at: now,
  };

  const { error } = await supabase.from('compliance_reports').insert(report);
  if (error) throw new Error(error.message);

  return report;
}


interface ReportInput {
  companyName: string;
  totalWaterUsage: number;
  totalWscPurchased: number;
  totalWscRetired: number;
  equivalentLiters: number;
  offsetPercent: number;
  retirements: Array<Record<string, unknown>>;
  trades: Array<Record<string, unknown>>;
  periodStart: string;
  periodEnd: string;
}

function buildReportData(framework: ReportFramework, input: ReportInput): Record<string, unknown> {
  const base = {
    framework,
    generatedAt: new Date().toISOString(),
    reportingPeriod: { start: input.periodStart, end: input.periodEnd },
    companyInformation: { name: input.companyName, totalAnnualWaterUsage: input.totalWaterUsage },
    waterStewardshipSummary: {
      totalWscPurchased: input.totalWscPurchased,
      totalWscRetired: input.totalWscRetired,
      equivalentLitersOffset: input.equivalentLiters,
      netWaterOffsetPercent: parseFloat(input.offsetPercent.toFixed(2)),
    },
    retirementDetails: input.retirements.map((r) => ({
      id: r.id,
      quantity: r.quantity_wsc_retired,
      equivalentLiters: r.equivalent_liters,
      purpose: r.purpose,
      sourceProject: r.source_project_id,
      watershed: r.source_watershed,
      burnTransactionId: r.hedera_burn_transaction_id,
      hcsMessageId: r.hcs_retirement_message_id,
      nftSerial: r.nft_certificate_serial,
      vcId: r.verifiable_credential_id,
    })),
    tradeDetails: input.trades.map((t) => ({
      id: t.id,
      quantity: t.quantity_wsc,
      totalHbar: t.total_hbar,
      transactionId: t.hedera_transaction_id,
      hcsMessageId: t.hcs_message_id,
    })),
  };

  // Framework-specific sections
  switch (framework) {
    case 'gri_303':
      return { ...base, frameworkSections: { standard: 'GRI 303: Water and Effluents', disclosures: ['303-1', '303-2', '303-3', '303-4', '303-5'] } };
    case 'cdp_water':
      return { ...base, frameworkSections: { standard: 'CDP Water Security', modules: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'] } };
    case 'csrd':
      return { ...base, frameworkSections: { standard: 'CSRD Water Disclosure', topics: ['E3-1', 'E3-2', 'E3-3', 'E3-4', 'E3-5'] } };
    case 'issb_s2':
      return { ...base, frameworkSections: { standard: 'ISSB S2 Water', sections: ['Governance', 'Strategy', 'Risk Management', 'Metrics and Targets'] } };
    case 'full_esg':
      return { ...base, frameworkSections: { standard: 'Full ESG Water Report', frameworks: ['GRI 303', 'CDP Water', 'CSRD', 'ISSB S2'] } };
    default:
      return base;
  }
}


/**
 * Get report data for preview (without creating a record).
 */
export async function getReportData(
  buyerId: string,
  buyerOrgName: string,
  buyerWaterFootprint: number | null,
  framework: ReportFramework,
  periodStart: string,
  periodEnd: string
): Promise<Record<string, unknown>> {
  const supabase = getSupabase();

  const { data: retirements } = await supabase
    .from('retirements')
    .select('*')
    .eq('buyer_id', buyerId)
    .gte('created_at', periodStart)
    .lte('created_at', periodEnd);

  const { data: trades } = await supabase
    .from('trades')
    .select('*')
    .eq('buyer_id', buyerId)
    .gte('created_at', periodStart)
    .lte('created_at', periodEnd);

  const totalWscPurchased = (trades || []).reduce((sum: number, t: { quantity_wsc: number }) => sum + t.quantity_wsc, 0);
  const totalWscRetired = (retirements || []).reduce((sum: number, r: { quantity_wsc_retired: number }) => sum + r.quantity_wsc_retired, 0);
  const equivalentLiters = totalWscRetired * LITERS_PER_WSC;
  const offsetPercent = buyerWaterFootprint ? (equivalentLiters / buyerWaterFootprint) * 100 : 0;

  return buildReportData(framework, {
    companyName: buyerOrgName,
    totalWaterUsage: buyerWaterFootprint || 0,
    totalWscPurchased,
    totalWscRetired,
    equivalentLiters,
    offsetPercent,
    retirements: retirements || [],
    trades: trades || [],
    periodStart,
    periodEnd,
  });
}
