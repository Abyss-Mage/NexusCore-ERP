"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { 
  Receipt, Download, FileSpreadsheet, FileCode, Filter, 
  Calendar, Building2, CheckCircle2, RefreshCw, FileText, Search
} from "lucide-react";
import { useToast } from "@/components/ui/toast-context";
import { AVAILABLE_CURRENCIES } from "@/lib/currencies";

interface B2BInvoiceRecord {
  invoice_id: number;
  invoice_number: string;
  issue_date: string;
  client_name: string;
  client_gstin: string;
  state_code: string;
  place_of_supply: string;
  reverse_charge: string;
  taxable_value: number;
  igst_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  total_invoice_value: number;
  currency: string;
  status: string;
}

interface HSNSACSummaryRecord {
  code: string;
  description: string;
  uqc: string;
  total_qty: number;
  total_value: number;
  taxable_value: number;
  igst_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  tax_rate: number;
}

interface GSTReportData {
  company_gstin: string;
  company_name: string;
  fiscal_year: string;
  total_b2b_count: number;
  total_taxable_value: number;
  total_igst: number;
  total_cgst: number;
  total_sgst: number;
  total_tax: number;
  total_invoice_value: number;
  b2b_invoices: B2BInvoiceRecord[];
  hsn_sac_summary: HSNSACSummaryRecord[];
}

export default function GSTTaxReportsPage() {
  const [data, setData] = useState<GSTReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"b2b" | "hsn">("b2b");
  const [baseCurrency, setBaseCurrency] = useState("₹");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { toast } = useToast();

  const fetchReport = async () => {
    setLoading(true);
    try {
      let url = '/reports/gst';
      const params = new URLSearchParams();
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      if (params.toString()) url += `?${params.toString()}`;

      const [res, locRes] = await Promise.all([
        api.get(url),
        api.get('/settings/LOCALIZATION').catch(() => ({ data: null }))
      ]);

      setData(res.data.data || null);

      if (locRes.data && locRes.data.value) {
        try {
          const parsed = typeof locRes.data.value === 'string' ? JSON.parse(locRes.data.value) : locRes.data.value;
          if (parsed.base_currency) {
            const symbolMatch = AVAILABLE_CURRENCIES?.find((c: any) => c.code === parsed.base_currency);
            setBaseCurrency(symbolMatch ? symbolMatch.symbol : parsed.base_currency);
          }
        } catch (e) {}
      }
    } catch (err) {
      console.error(err);
      toast("Failed to load GST tax report", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const handleDownloadCSV = () => {
    let url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api'}/reports/gst/export-csv`;
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    if (params.toString()) url += `?${params.toString()}`;

    window.open(url, '_blank');
    toast("Exporting GSTR-1 B2B CSV...", "success");
  };

  const handleDownloadJSON = () => {
    let url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api'}/reports/gst/export-json`;
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    if (params.toString()) url += `?${params.toString()}`;

    window.open(url, '_blank');
    toast("Exporting GSTR-1 JSON...", "success");
  };

  const filteredInvoices = (data?.b2b_invoices || []).filter(inv =>
    inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    inv.client_name.toLowerCase().includes(search.toLowerCase()) ||
    inv.client_gstin.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 flex flex-col p-8 min-h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-on-surface flex items-center gap-3">
            <Receipt className="h-8 w-8 text-primary" />
            Tax Compliance &amp; GST Reports
          </h2>
          <p className="text-muted-foreground mt-1">
            GSTR-1 compliant sales register, B2B invoice tables, and HSN/SAC classification exports
          </p>
        </div>

        <div className="flex gap-2.5">
          <button
            onClick={handleDownloadCSV}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm transition-colors text-xs"
          >
            <FileSpreadsheet className="w-4 h-4" /> Export GSTR-1 CSV
          </button>
          <button
            onClick={handleDownloadJSON}
            className="bg-secondary hover:bg-muted text-foreground font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm transition-colors text-xs border border-border"
          >
            <FileCode className="w-4 h-4 text-primary" /> Export JSON
          </button>
        </div>
      </div>

      {/* Date Filter Toolbar */}
      <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">From:</span>
            <input 
              type="date"
              className="px-2.5 py-1.5 rounded-lg bg-background border border-border text-xs outline-none text-foreground"
              value={from}
              onChange={e => setFrom(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">To:</span>
            <input 
              type="date"
              className="px-2.5 py-1.5 rounded-lg bg-background border border-border text-xs outline-none text-foreground"
              value={to}
              onChange={e => setTo(e.target.value)}
            />
          </div>

          <button
            onClick={fetchReport}
            className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
          >
            Apply Filter
          </button>
          
          {(from || to) && (
            <button
              onClick={() => { setFrom(""); setTo(""); fetchReport(); }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Building2 className="w-4 h-4 text-primary" />
          <span>Filer GSTIN: <strong className="text-foreground font-mono">{data?.company_gstin || 'Unregistered'}</strong></span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 shrink-0">
        <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">B2B Invoices</span>
          <span className="text-2xl font-bold text-foreground">{data?.total_b2b_count || 0}</span>
          <span className="text-[11px] text-muted-foreground">Active vouchers</span>
        </div>

        <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Taxable Turnover</span>
          <span className="text-2xl font-bold text-foreground">{baseCurrency}{data?.total_taxable_value?.toLocaleString() || "0"}</span>
          <span className="text-[11px] text-muted-foreground">Net sales base</span>
        </div>

        <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Integrated Tax (IGST)</span>
          <span className="text-2xl font-bold text-purple-500">{baseCurrency}{data?.total_igst?.toLocaleString() || "0"}</span>
          <span className="text-[11px] text-purple-600 font-medium">Interstate sales</span>
        </div>

        <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CGST + SGST</span>
          <span className="text-2xl font-bold text-blue-500">{baseCurrency}{((data?.total_cgst || 0) + (data?.total_sgst || 0)).toLocaleString()}</span>
          <span className="text-[11px] text-blue-600 font-medium">Intrastate sales</span>
        </div>

        <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Invoice Value</span>
          <span className="text-2xl font-bold text-emerald-500">{baseCurrency}{data?.total_invoice_value?.toLocaleString() || "0"}</span>
          <span className="text-[11px] text-emerald-600 font-medium">Gross collections</span>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex gap-2 bg-muted/40 p-1 rounded-xl border border-border self-start">
        <button
          onClick={() => setActiveTab("b2b")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "b2b" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="w-3.5 h-3.5" /> GSTR-1 B2B Invoices ({data?.b2b_invoices?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("hsn")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "hsn" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Receipt className="w-3.5 h-3.5" /> HSN / SAC Summary ({data?.hsn_sac_summary?.length || 0})
        </button>
      </div>

      {/* Tab 1: B2B Invoices Table */}
      {activeTab === "b2b" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-card border border-border p-3 rounded-xl">
            <Search className="w-4 h-4 text-muted-foreground ml-1" />
            <input 
              type="text" 
              placeholder="Search by invoice number, client company, or GSTIN..." 
              className="bg-transparent text-sm text-foreground outline-none flex-1 placeholder:text-muted-foreground"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                  <tr>
                    <th className="p-4">Invoice # &amp; Date</th>
                    <th className="p-4">Recipient Name</th>
                    <th className="p-4">Recipient GSTIN</th>
                    <th className="p-4">Place of Supply</th>
                    <th className="p-4 text-right">Taxable Value</th>
                    <th className="p-4 text-right">IGST</th>
                    <th className="p-4 text-right">CGST</th>
                    <th className="p-4 text-right">SGST</th>
                    <th className="p-4 text-right">Invoice Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-border">
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.invoice_id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-foreground">{inv.invoice_number}</div>
                        <div className="text-xs text-muted-foreground">{inv.issue_date}</div>
                      </td>
                      <td className="p-4 font-semibold text-foreground">{inv.client_name}</td>
                      <td className="p-4">
                        <code className="text-xs font-mono bg-muted/60 px-2 py-0.5 rounded text-foreground">
                          {inv.client_gstin}
                        </code>
                      </td>
                      <td className="p-4 text-xs text-muted-foreground">{inv.place_of_supply}</td>
                      <td className="p-4 text-right font-semibold text-foreground">
                        {baseCurrency}{inv.taxable_value.toFixed(2)}
                      </td>
                      <td className="p-4 text-right text-xs text-purple-500 font-semibold">
                        {inv.igst_amount > 0 ? `${baseCurrency}${inv.igst_amount.toFixed(2)}` : '—'}
                      </td>
                      <td className="p-4 text-right text-xs text-blue-500 font-semibold">
                        {inv.cgst_amount > 0 ? `${baseCurrency}${inv.cgst_amount.toFixed(2)}` : '—'}
                      </td>
                      <td className="p-4 text-right text-xs text-blue-500 font-semibold">
                        {inv.sgst_amount > 0 ? `${baseCurrency}${inv.sgst_amount.toFixed(2)}` : '—'}
                      </td>
                      <td className="p-4 text-right font-bold text-emerald-500">
                        {baseCurrency}{inv.total_invoice_value.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: HSN / SAC Summary Table */}
      {activeTab === "hsn" && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                <tr>
                  <th className="p-4">SAC / HSN Code</th>
                  <th className="p-4">Description of Service / Goods</th>
                  <th className="p-4">UQC</th>
                  <th className="p-4 text-right">Total Qty</th>
                  <th className="p-4 text-right">Taxable Value</th>
                  <th className="p-4 text-right">Rate</th>
                  <th className="p-4 text-right">IGST</th>
                  <th className="p-4 text-right">CGST</th>
                  <th className="p-4 text-right">SGST</th>
                  <th className="p-4 text-right">Total Value</th>
                </tr>
              </thead>
              <tbody className="divide-y border-border">
                {(data?.hsn_sac_summary || []).map((h) => (
                  <tr key={h.code} className="hover:bg-muted/20 transition-colors">
                    <td className="p-4 font-mono font-bold text-primary">{h.code}</td>
                    <td className="p-4 font-semibold text-foreground">{h.description}</td>
                    <td className="p-4 text-xs font-mono text-muted-foreground">{h.uqc}</td>
                    <td className="p-4 text-right font-semibold text-foreground">{h.total_qty}</td>
                    <td className="p-4 text-right font-bold text-foreground">
                      {baseCurrency}{h.taxable_value.toFixed(2)}
                    </td>
                    <td className="p-4 text-right text-xs font-semibold text-muted-foreground">{h.tax_rate}%</td>
                    <td className="p-4 text-right text-xs text-purple-500 font-semibold">
                      {h.igst_amount > 0 ? `${baseCurrency}${h.igst_amount.toFixed(2)}` : '—'}
                    </td>
                    <td className="p-4 text-right text-xs text-blue-500 font-semibold">
                      {h.cgst_amount > 0 ? `${baseCurrency}${h.cgst_amount.toFixed(2)}` : '—'}
                    </td>
                    <td className="p-4 text-right text-xs text-blue-500 font-semibold">
                      {h.sgst_amount > 0 ? `${baseCurrency}${h.sgst_amount.toFixed(2)}` : '—'}
                    </td>
                    <td className="p-4 text-right font-bold text-emerald-500">
                      {baseCurrency}{h.total_value.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
