'use client';

import { useState } from 'react';
import { LazyBarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from '@/components/ui/LazyChart';
import { FileText, Download, Eye, FileDown } from 'lucide-react';
import { api } from '@/lib/api';
import { formatNumber, formatLiters, formatHbar } from '@/lib/utils';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { ChartWrapper } from '@/components/ui/ChartWrapper';
import { HashScanLink } from '@/components/ui/HashScanLink';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { toast } from 'sonner';
import type { ComplianceReport } from '@/types';

const frameworkOptions = [
  { value: 'gri_303', label: 'GRI 303 — Water & Effluents' },
  { value: 'cdp_water', label: 'CDP Water Security' },
  { value: 'csrd', label: 'CSRD Water Disclosure' },
  { value: 'issb_s2', label: 'ISSB S2 Water' },
  { value: 'full_esg', label: 'Full ESG Water Report' },
];

interface ReportData {
  companyName: string;
  framework: string;
  periodStart: string;
  periodEnd: string;
  totalWaterUsage: number;
  totalWscPurchased: number;
  totalWscRetired: number;
  equivalentLitersOffset: number;
  netOffsetPercentage: number;
  retirements: { id: string; quantity: number; liters: number; date: string; burnTxId: string; nftSerial: number }[];
  projectBreakdown: { projectName: string; watershed: string; creditType: string; quantity: number }[];
}

export default function ReportsPage() {
  const [framework, setFramework] = useState('gri_303');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [preview, setPreview] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  async function handlePreview() {
    if (!periodStart || !periodEnd) { toast.error('Select a date range'); return; }
    setLoading(true);
    const res = await api.get<ReportData>(`/reports/data?framework=${framework}&period_start=${new Date(periodStart).toISOString()}&period_end=${new Date(periodEnd).toISOString()}`);
    setLoading(false);
    if (res.success && res.data) {
      setPreview(res.data);
    } else {
      toast.error(res.error?.message || 'Failed to load report data');
    }
  }

  async function handleGenerate() {
    if (!periodStart || !periodEnd) return;
    setGenerating(true);
    const res = await api.post<ComplianceReport>('/reports/generate', {
      framework,
      period_start: new Date(periodStart).toISOString(),
      period_end: new Date(periodEnd).toISOString(),
    });
    setGenerating(false);
    if (res.success && res.data) {
      toast.success('Report generated and stored on HFS');
      // Download JSON
      const blob = new Blob([JSON.stringify(res.data.report_data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aquavera-${framework}-report.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      toast.error(res.error?.message || 'Report generation failed');
    }
  }

  function downloadJson() {
    if (!preview) return;
    const blob = new Blob([JSON.stringify(preview, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aquavera-${framework}-report.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadPdf() {
    if (!preview) return;
    // Generate a printable HTML and trigger browser print-to-PDF
    const printWindow = window.open('', '_blank');
    if (!printWindow) { toast.error('Please allow popups to download PDF'); return; }
    const fw = frameworkOptions.find((f) => f.value === framework)?.label || framework;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${fw} Report</title><style>body{font-family:system-ui,sans-serif;padding:40px;max-width:800px;margin:0 auto}h1{color:#1E3A5F}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f3f4f6}.stat{display:inline-block;margin:8px 16px 8px 0;padding:12px;background:#f3f4f6;border-radius:8px;min-width:120px;text-align:center}.stat-label{font-size:12px;color:#666}.stat-value{font-size:18px;font-weight:bold;color:#1E3A5F}</style></head><body>`);
    printWindow.document.write(`<h1>AquaVera — ${fw}</h1>`);
    printWindow.document.write(`<p>${preview.companyName} · ${new Date(preview.periodStart).toLocaleDateString()} — ${new Date(preview.periodEnd).toLocaleDateString()}</p>`);
    printWindow.document.write(`<div class="stat"><div class="stat-label">Water Usage</div><div class="stat-value">${preview.totalWaterUsage.toLocaleString()} L</div></div>`);
    printWindow.document.write(`<div class="stat"><div class="stat-label">WSC Retired</div><div class="stat-value">${preview.totalWscRetired.toLocaleString()}</div></div>`);
    printWindow.document.write(`<div class="stat"><div class="stat-label">Liters Offset</div><div class="stat-value">${preview.equivalentLitersOffset.toLocaleString()} L</div></div>`);
    printWindow.document.write(`<div class="stat"><div class="stat-label">Net Offset</div><div class="stat-value">${preview.netOffsetPercentage}%</div></div>`);
    if (preview.retirements.length > 0) {
      printWindow.document.write(`<h2>Retirement Records</h2><table><tr><th>WSC</th><th>Liters</th><th>Date</th><th>NFT #</th><th>Burn Tx</th></tr>`);
      preview.retirements.forEach((r) => { printWindow.document.write(`<tr><td>${r.quantity}</td><td>${r.liters.toLocaleString()}</td><td>${new Date(r.date).toLocaleDateString()}</td><td>#${r.nftSerial}</td><td>${r.burnTxId}</td></tr>`); });
      printWindow.document.write(`</table>`);
    }
    printWindow.document.write(`<p style="margin-top:24px;font-size:11px;color:#999">Generated by AquaVera — Tokenized Water Stewardship Credits on Hedera</p></body></html>`);
    printWindow.document.close();
    printWindow.print();
  }

  const retirementColumns: Column<ReportData['retirements'][0]>[] = [
    { key: 'quantity', header: 'WSC Retired', render: (r) => formatNumber(r.quantity) },
    { key: 'liters', header: 'Liters Offset', render: (r) => formatLiters(r.liters) },
    { key: 'date', header: 'Date', render: (r) => new Date(r.date).toLocaleDateString() },
    { key: 'nftSerial', header: 'NFT #', render: (r) => `#${r.nftSerial}` },
    { key: 'burnTxId', header: 'Burn Tx', render: (r) => r.burnTxId ? <HashScanLink entityType="transaction" entityId={r.burnTxId} /> : <span className="text-gray-400">—</span> },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Compliance Reports</h2>

      {/* Controls */}
      <Card>
        <CardTitle>Generate Report</CardTitle>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-4">
          <Select
            label="Framework"
            value={framework}
            onChange={(e) => setFramework(e.target.value)}
            options={frameworkOptions}
          />
          <Input label="Period Start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          <Input label="Period End" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          <div className="flex items-end gap-2">
            <Button onClick={handlePreview} loading={loading} variant="outline" className="flex-1">
              <Eye className="h-4 w-4" /> Preview
            </Button>
            <Button onClick={handleGenerate} loading={generating} className="flex-1">
              <Download className="h-4 w-4" /> Generate
            </Button>
          </div>
        </div>
      </Card>

      {/* Preview */}
      {loading && <LoadingSpinner size="lg" label="Loading report data..." />}

      {preview && (
        <div className="space-y-6">
          {/* Summary */}
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{frameworkOptions.find((f) => f.value === framework)?.label || framework} Report</CardTitle>
                <p className="text-xs text-gray-500 mt-1">{preview.companyName} · {new Date(preview.periodStart).toLocaleDateString()} — {new Date(preview.periodEnd).toLocaleDateString()}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={downloadPdf}><FileDown className="h-4 w-4" /> PDF</Button>
                <Button size="sm" variant="outline" onClick={downloadJson}><Download className="h-4 w-4" /> JSON</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Water Usage</p>
                <p className="font-bold text-gray-900">{formatLiters(preview.totalWaterUsage)}</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">WSC Retired</p>
                <p className="font-bold text-gray-900">{formatNumber(preview.totalWscRetired)}</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Liters Offset</p>
                <p className="font-bold text-teal">{formatLiters(preview.equivalentLitersOffset)}</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Net Offset</p>
                <p className="font-bold text-teal">{preview.netOffsetPercentage}%</p>
              </div>
            </div>
          </Card>

          {/* Project Breakdown Chart */}
          {preview.projectBreakdown && preview.projectBreakdown.length > 0 && (
            <Card>
              <CardTitle>Breakdown by Source Project</CardTitle>
              <ChartWrapper height={250}>
                <LazyBarChart data={preview.projectBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="projectName" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="quantity" fill="#0D9488" radius={[4, 4, 0, 0]} name="WSC" />
                </LazyBarChart>
              </ChartWrapper>
            </Card>
          )}

          {/* Retirements Table */}
          {preview.retirements && preview.retirements.length > 0 && (
            <Card>
              <CardTitle>Retirement Records</CardTitle>
              <DataTable columns={retirementColumns} data={preview.retirements} keyExtractor={(r) => r.id} />
            </Card>
          )}
        </div>
      )}

      {!preview && !loading && (
        <Card>
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">Select a framework and date range, then click Preview to see your report.</p>
          </div>
        </Card>
      )}
    </div>
  );
}
