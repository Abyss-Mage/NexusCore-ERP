"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Scale, 
  BookOpen, 
  Calendar, 
  Download, 
  RefreshCw, 
  Building2, 
  CheckCircle2, 
  AlertCircle,
  FileSpreadsheet,
  PieChart,
  Layers,
  ArrowRight
} from "lucide-react";
import { useToast } from "@/components/ui/toast-context";
import { useBusiness } from "@/contexts/business-context";
import FXRatesWidget from "@/components/FXRatesWidget";

interface AccountBalance {
  code: string;
  name: string;
  type: string;
  debit_total: number;
  credit_total: number;
  net_balance: number;
}

interface ProfitAndLossData {
  business_unit_id: string;
  from_date: string;
  to_date: string;
  currency: string;
  revenue_accounts: AccountBalance[];
  total_revenue: number;
  cogs_accounts: AccountBalance[];
  total_cogs: number;
  gross_profit: number;
  gross_margin_pct: number;
  expense_accounts: AccountBalance[];
  total_expenses: number;
  net_operating_income: number;
  net_profit_margin_pct: number;
}

interface BalanceSheetData {
  business_unit_id: string;
  as_of_date: string;
  currency: string;
  current_assets: AccountBalance[];
  total_current_assets: number;
  fixed_assets: AccountBalance[];
  total_fixed_assets: number;
  total_assets: number;
  current_liabilities: AccountBalance[];
  total_liabilities: number;
  equity_accounts: AccountBalance[];
  retained_earnings: number;
  total_equity: number;
  total_liabilities_and_equity: number;
  is_balanced: boolean;
}

interface TrialBalanceRow {
  code: string;
  name: string;
  type: string;
  debit_balance: number;
  credit_balance: number;
}

interface TrialBalanceData {
  business_unit_id: string;
  from_date: string;
  to_date: string;
  currency: string;
  rows: TrialBalanceRow[];
  total_debit: number;
  total_credit: number;
  is_balanced: boolean;
}

export default function FinancialReportsPage() {
  const { activeUnit } = useBusiness();
  const currentUnit = activeUnit;
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"pl" | "bs" | "tb" | "coa">("pl");
  const [loading, setLoading] = useState(true);
  const [syncingJournals, setSyncingJournals] = useState(false);

  // Date Filters
  const now = new Date();
  const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const todayStr = now.toISOString().split('T')[0];

  const [fromDate, setFromDate] = useState(firstDayThisMonth);
  const [toDate, setToDate] = useState(todayStr);

  // Data States
  const [plData, setPlData] = useState<ProfitAndLossData | null>(null);
  const [bsData, setBsData] = useState<BalanceSheetData | null>(null);
  const [tbData, setTbData] = useState<TrialBalanceData | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);

  const fetchFinancials = async () => {
    setLoading(true);
    try {
      const unitParam = currentUnit?.id ? `unit_id=${currentUnit.id}` : "";
      const dateParams = `from=${fromDate}&to=${toDate}`;
      const queryStr = [unitParam, dateParams].filter(Boolean).join("&");

      const [plRes, bsRes, tbRes, coaRes] = await Promise.all([
        api.get(`/financials/profit-loss?${queryStr}`),
        api.get(`/financials/balance-sheet?${unitParam}&as_of=${toDate}`),
        api.get(`/financials/trial-balance?${queryStr}`),
        api.get(`/financials/accounts`)
      ]);

      setPlData(plRes.data?.data || null);
      setBsData(bsRes.data?.data || null);
      setTbData(tbRes.data?.data || null);
      setAccounts(coaRes.data?.data || []);
    } catch (err) {
      console.error("Failed to load financials", err);
      toast("Failed to load financial statements", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancials();
  }, [currentUnit?.id, fromDate, toDate]);

  const setPeriodPreset = (preset: "this_month" | "last_month" | "ytd" | "all") => {
    const d = new Date();
    if (preset === "this_month") {
      setFromDate(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]);
      setToDate(d.toISOString().split('T')[0]);
    } else if (preset === "last_month") {
      setFromDate(new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().split('T')[0]);
      setToDate(new Date(d.getFullYear(), d.getMonth(), 0).toISOString().split('T')[0]);
    } else if (preset === "ytd") {
      setFromDate(new Date(d.getFullYear(), 0, 1).toISOString().split('T')[0]);
      setToDate(d.toISOString().split('T')[0]);
    } else if (preset === "all") {
      setFromDate("2020-01-01");
      setToDate(d.toISOString().split('T')[0]);
    }
  };

  const handleRebuildJournals = async () => {
    setSyncingJournals(true);
    try {
      await api.post("/financials/rebuild-journals");
      toast("Double-entry journals synchronized from all transactions", "success");
      await fetchFinancials();
    } catch (e) {
      console.error("Failed to sync journals", e);
      toast("Failed to sync journal entries", "error");
    } finally {
      setSyncingJournals(false);
    }
  };

  const formatCurrency = (val: number | undefined) => {
    const num = val || 0;
    const currency = currentUnit?.currency || "INR";
    const symbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : currency;
    return `${symbol}${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Scale className="w-6 h-6 text-primary" /> Financial Intelligence Suite
            </h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" /> {currentUnit?.name || "All Workspaces"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time Double-Entry General Ledger, Profit & Loss Statements, Balance Sheets & Trial Balances
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRebuildJournals}
            disabled={syncingJournals}
            className="bg-secondary hover:bg-muted text-foreground font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 text-xs border border-border shadow-sm transition-all cursor-pointer disabled:opacity-50"
            title="Sync journal lines with historical invoices and expenses"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingJournals ? "animate-spin" : ""}`} />
            {syncingJournals ? "Syncing..." : "Re-Sync Ledger"}
          </button>
        </div>
      </div>

      {/* FX Rates Widget */}
      <FXRatesWidget />

      {/* Date Filters & Period Presets */}
      <div className="bg-card/70 border border-border/80 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mr-1">Period:</span>
          <button
            onClick={() => setPeriodPreset("this_month")}
            className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-secondary hover:bg-muted text-foreground border border-border/60 transition-colors cursor-pointer"
          >
            This Month
          </button>
          <button
            onClick={() => setPeriodPreset("last_month")}
            className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-secondary hover:bg-muted text-foreground border border-border/60 transition-colors cursor-pointer"
          >
            Last Month
          </button>
          <button
            onClick={() => setPeriodPreset("ytd")}
            className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-secondary hover:bg-muted text-foreground border border-border/60 transition-colors cursor-pointer"
          >
            Year to Date (YTD)
          </button>
          <button
            onClick={() => setPeriodPreset("all")}
            className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-secondary hover:bg-muted text-foreground border border-border/60 transition-colors cursor-pointer"
          >
            All Time
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground font-medium">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-secondary/70 border border-border/80 px-2.5 py-1.5 rounded-md text-xs text-foreground outline-none focus:border-primary"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground font-medium">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-secondary/70 border border-border/80 px-2.5 py-1.5 rounded-md text-xs text-foreground outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={fetchFinancials}
            className="p-1.5 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-all cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-card border border-border/80 p-4 rounded-xl shadow-sm">
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Operating Revenue</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-extrabold text-foreground mt-2">
            {formatCurrency(plData?.total_revenue)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">Invoices & Store Sales</div>
        </div>

        <div className="bg-card border border-border/80 p-4 rounded-xl shadow-sm">
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Direct COGS</span>
            <TrendingDown className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-extrabold text-foreground mt-2">
            {formatCurrency(plData?.total_cogs)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">Raw Materials & Shipping</div>
        </div>

        <div className="bg-card border border-border/80 p-4 rounded-xl shadow-sm">
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Gross Profit</span>
            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500">
              {plData?.gross_margin_pct || 0}% Margin
            </span>
          </div>
          <div className="text-xl font-extrabold text-emerald-500 mt-2">
            {formatCurrency(plData?.gross_profit)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">Revenue minus COGS</div>
        </div>

        <div className="bg-card border border-border/80 p-4 rounded-xl shadow-sm">
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Operating Expenses</span>
            <TrendingDown className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-extrabold text-foreground mt-2">
            {formatCurrency(plData?.total_expenses)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">Cloud, SaaS & Admin</div>
        </div>

        <div className="bg-card border border-border/80 p-4 rounded-xl shadow-sm bg-gradient-to-br from-card to-primary/5">
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Net Operating Income</span>
            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-primary/15 text-primary">
              {plData?.net_profit_margin_pct || 0}% Net
            </span>
          </div>
          <div className={`text-xl font-extrabold mt-2 ${(plData?.net_operating_income || 0) >= 0 ? "text-primary" : "text-rose-500"}`}>
            {formatCurrency(plData?.net_operating_income)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">Bottom-line Profit</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border text-sm font-semibold">
        <button
          onClick={() => setActiveTab("pl")}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "pl"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <TrendingUp className="w-4 h-4" /> Profit & Loss Statement
        </button>
        <button
          onClick={() => setActiveTab("bs")}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "bs"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Scale className="w-4 h-4" /> Balance Sheet
        </button>
        <button
          onClick={() => setActiveTab("tb")}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "tb"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <CheckCircle2 className="w-4 h-4" /> Trial Balance
        </button>
        <button
          onClick={() => setActiveTab("coa")}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "coa"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookOpen className="w-4 h-4" /> Chart of Accounts
        </button>
      </div>

      {/* TAB CONTENT: Profit & Loss Statement */}
      {activeTab === "pl" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border/80 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 bg-secondary/30 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">Income Statement (P&L)</h3>
                <p className="text-xs text-muted-foreground">For the period {plData?.from_date} to {plData?.to_date}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-bold text-muted-foreground">Currency: {currentUnit?.currency || "INR"}</span>
              </div>
            </div>

            <div className="p-5 space-y-6 text-sm">
              {/* Revenue Section */}
              <div>
                <div className="flex items-center justify-between font-bold text-xs uppercase tracking-wider text-muted-foreground pb-2 border-b border-border">
                  <span>1. Operating Revenue</span>
                  <span>Amount</span>
                </div>
                <div className="divide-y divide-border/40 font-mono text-xs">
                  {plData?.revenue_accounts?.map((acc) => (
                    <div key={acc.code} className="flex items-center justify-between py-2 hover:bg-muted/30 px-2 rounded">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{acc.code}</span>
                        <span className="font-sans text-foreground font-medium">{acc.name}</span>
                      </div>
                      <span className="font-bold text-foreground">{formatCurrency(acc.net_balance)}</span>
                    </div>
                  ))}
                  {(!plData?.revenue_accounts || plData.revenue_accounts.length === 0) && (
                    <div className="py-2.5 text-xs text-muted-foreground italic px-2">No revenue logged in this period</div>
                  )}
                  <div className="flex items-center justify-between pt-3 font-bold text-sm text-foreground px-2 bg-secondary/20">
                    <span className="font-sans">Total Operating Revenue</span>
                    <span className="text-emerald-500">{formatCurrency(plData?.total_revenue)}</span>
                  </div>
                </div>
              </div>

              {/* COGS Section */}
              <div>
                <div className="flex items-center justify-between font-bold text-xs uppercase tracking-wider text-muted-foreground pb-2 border-b border-border">
                  <span>2. Cost of Goods Sold (COGS)</span>
                  <span>Amount</span>
                </div>
                <div className="divide-y divide-border/40 font-mono text-xs">
                  {plData?.cogs_accounts?.map((acc) => (
                    <div key={acc.code} className="flex items-center justify-between py-2 hover:bg-muted/30 px-2 rounded">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{acc.code}</span>
                        <span className="font-sans text-foreground font-medium">{acc.name}</span>
                      </div>
                      <span className="font-bold text-foreground">{formatCurrency(acc.net_balance)}</span>
                    </div>
                  ))}
                  {(!plData?.cogs_accounts || plData.cogs_accounts.length === 0) && (
                    <div className="py-2.5 text-xs text-muted-foreground italic px-2">No direct manufacturing / material costs</div>
                  )}
                  <div className="flex items-center justify-between pt-3 font-bold text-sm text-foreground px-2 bg-secondary/20">
                    <span className="font-sans">Total Cost of Goods Sold</span>
                    <span className="text-amber-500">{formatCurrency(plData?.total_cogs)}</span>
                  </div>
                </div>
              </div>

              {/* Gross Profit Callout */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 font-bold">
                <span className="text-sm text-emerald-500">Gross Profit (Margin: {plData?.gross_margin_pct || 0}%)</span>
                <span className="text-base text-emerald-500 font-mono">{formatCurrency(plData?.gross_profit)}</span>
              </div>

              {/* Operating Expenses Section */}
              <div>
                <div className="flex items-center justify-between font-bold text-xs uppercase tracking-wider text-muted-foreground pb-2 border-b border-border">
                  <span>3. Operating & Administrative Expenses</span>
                  <span>Amount</span>
                </div>
                <div className="divide-y divide-border/40 font-mono text-xs">
                  {plData?.expense_accounts?.map((acc) => (
                    <div key={acc.code} className="flex items-center justify-between py-2 hover:bg-muted/30 px-2 rounded">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{acc.code}</span>
                        <span className="font-sans text-foreground font-medium">{acc.name}</span>
                      </div>
                      <span className="font-bold text-foreground">{formatCurrency(acc.net_balance)}</span>
                    </div>
                  ))}
                  {(!plData?.expense_accounts || plData.expense_accounts.length === 0) && (
                    <div className="py-2.5 text-xs text-muted-foreground italic px-2">No operational expenses logged in this period</div>
                  )}
                  <div className="flex items-center justify-between pt-3 font-bold text-sm text-foreground px-2 bg-secondary/20">
                    <span className="font-sans">Total Operating Expenses</span>
                    <span className="text-rose-500">{formatCurrency(plData?.total_expenses)}</span>
                  </div>
                </div>
              </div>

              {/* Net Profit Callout */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-primary/10 border border-primary/30 font-bold">
                <div>
                  <span className="text-base text-foreground block">Net Operating Income (EBITDA)</span>
                  <span className="text-xs text-muted-foreground font-normal">Net Profit Margin: {plData?.net_profit_margin_pct || 0}%</span>
                </div>
                <span className={`text-xl font-mono ${(plData?.net_operating_income || 0) >= 0 ? "text-primary" : "text-rose-500"}`}>
                  {formatCurrency(plData?.net_operating_income)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: Balance Sheet */}
      {activeTab === "bs" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border/80 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 bg-secondary/30 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  Balance Sheet (Statement of Financial Position)
                  {bsData?.is_balanced ? (
                    <span className="text-xs bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Balanced
                    </span>
                  ) : (
                    <span className="text-xs bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Out of Balance
                    </span>
                  )}
                </h3>
                <p className="text-xs text-muted-foreground">As of {bsData?.as_of_date}</p>
              </div>
            </div>

            <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-8 text-xs font-mono">
              {/* ASSETS Column */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider pb-2 border-b border-primary/30 font-sans">
                  Assets
                </h4>

                <div className="space-y-2">
                  <div className="font-bold text-muted-foreground font-sans uppercase text-[10px]">Current Assets</div>
                  <div className="divide-y divide-border/40 pl-2">
                    {bsData?.current_assets?.map((acc) => (
                      <div key={acc.code} className="flex justify-between py-1.5">
                        <span className="text-foreground font-sans">{acc.code} - {acc.name}</span>
                        <span className="font-bold text-foreground">{formatCurrency(acc.net_balance)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-2 font-bold text-foreground">
                      <span className="font-sans">Total Current Assets</span>
                      <span>{formatCurrency(bsData?.total_current_assets)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-3">
                  <div className="font-bold text-muted-foreground font-sans uppercase text-[10px]">Fixed & Hardware Assets</div>
                  <div className="divide-y divide-border/40 pl-2">
                    {bsData?.fixed_assets?.map((acc) => (
                      <div key={acc.code} className="flex justify-between py-1.5">
                        <span className="text-foreground font-sans">{acc.code} - {acc.name}</span>
                        <span className="font-bold text-foreground">{formatCurrency(acc.net_balance)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-2 font-bold text-foreground">
                      <span className="font-sans">Total Fixed Assets</span>
                      <span>{formatCurrency(bsData?.total_fixed_assets)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-secondary/50 rounded-lg flex justify-between items-center font-bold text-sm text-foreground mt-4 font-sans">
                  <span>TOTAL ASSETS</span>
                  <span className="text-primary font-mono">{formatCurrency(bsData?.total_assets)}</span>
                </div>
              </div>

              {/* LIABILITIES & EQUITY Column */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-amber-500 uppercase tracking-wider pb-2 border-b border-amber-500/30 font-sans">
                  Liabilities & Equity
                </h4>

                <div className="space-y-2">
                  <div className="font-bold text-muted-foreground font-sans uppercase text-[10px]">Current Liabilities</div>
                  <div className="divide-y divide-border/40 pl-2">
                    {bsData?.current_liabilities?.map((acc) => (
                      <div key={acc.code} className="flex justify-between py-1.5">
                        <span className="text-foreground font-sans">{acc.code} - {acc.name}</span>
                        <span className="font-bold text-foreground">{formatCurrency(acc.net_balance)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-2 font-bold text-foreground">
                      <span className="font-sans">Total Liabilities</span>
                      <span>{formatCurrency(bsData?.total_liabilities)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-3">
                  <div className="font-bold text-muted-foreground font-sans uppercase text-[10px]">Owner's Equity & Earnings</div>
                  <div className="divide-y divide-border/40 pl-2">
                    {bsData?.equity_accounts?.map((acc) => (
                      <div key={acc.code} className="flex justify-between py-1.5">
                        <span className="text-foreground font-sans">{acc.code} - {acc.name}</span>
                        <span className="font-bold text-foreground">{formatCurrency(acc.net_balance)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-1.5 text-emerald-500">
                      <span className="font-sans">3020 - Retained Earnings (Cumulative Profit)</span>
                      <span className="font-bold">{formatCurrency(bsData?.retained_earnings)}</span>
                    </div>
                    <div className="flex justify-between pt-2 font-bold text-foreground">
                      <span className="font-sans">Total Equity</span>
                      <span>{formatCurrency(bsData?.total_equity)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-secondary/50 rounded-lg flex justify-between items-center font-bold text-sm text-foreground mt-4 font-sans">
                  <span>TOTAL LIABILITIES & EQUITY</span>
                  <span className="text-amber-500 font-mono">{formatCurrency(bsData?.total_liabilities_and_equity)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: Trial Balance */}
      {activeTab === "tb" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border/80 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 bg-secondary/30 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  Trial Balance Audit
                  {tbData?.is_balanced ? (
                    <span className="text-xs bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Balanced (Debits = Credits)
                    </span>
                  ) : (
                    <span className="text-xs bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded-full font-bold">
                      Imbalance Detected
                    </span>
                  )}
                </h3>
                <p className="text-xs text-muted-foreground">General Ledger balances for {tbData?.from_date} to {tbData?.to_date}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-secondary/40 border-b border-border text-muted-foreground uppercase text-[10px] font-bold">
                  <tr>
                    <th className="py-2.5 px-4">Account Code</th>
                    <th className="py-2.5 px-4">Account Name</th>
                    <th className="py-2.5 px-4">Category</th>
                    <th className="py-2.5 px-4 text-right">Debit Balance</th>
                    <th className="py-2.5 px-4 text-right">Credit Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {tbData?.rows?.map((r) => (
                    <tr key={r.code} className="hover:bg-muted/30">
                      <td className="py-2.5 px-4 font-bold text-primary">{r.code}</td>
                      <td className="py-2.5 px-4 font-sans text-foreground font-medium">{r.name}</td>
                      <td className="py-2.5 px-4">
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-sans font-semibold bg-secondary text-muted-foreground">
                          {r.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right text-foreground">
                        {r.debit_balance > 0 ? formatCurrency(r.debit_balance) : "-"}
                      </td>
                      <td className="py-2.5 px-4 text-right text-foreground">
                        {r.credit_balance > 0 ? formatCurrency(r.credit_balance) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-secondary/60 font-bold border-t-2 border-border text-foreground font-mono">
                  <tr>
                    <td colSpan={3} className="py-3 px-4 text-left font-sans">
                      TOTALS (Debits vs Credits)
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-500">
                      {formatCurrency(tbData?.total_debit)}
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-500">
                      {formatCurrency(tbData?.total_credit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: Chart of Accounts */}
      {activeTab === "coa" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border/80 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 bg-secondary/30 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">Standard Chart of Accounts (COA)</h3>
                <p className="text-xs text-muted-foreground">Pre-configured double-entry general ledger architecture</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-secondary/40 border-b border-border text-muted-foreground uppercase text-[10px] font-bold">
                  <tr>
                    <th className="py-2.5 px-4">Code</th>
                    <th className="py-2.5 px-4">Account Name</th>
                    <th className="py-2.5 px-4">Account Type</th>
                    <th className="py-2.5 px-4">Description</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {accounts.map((acc) => (
                    <tr key={acc.code} className="hover:bg-muted/30">
                      <td className="py-2.5 px-4 font-mono font-bold text-primary">{acc.code}</td>
                      <td className="py-2.5 px-4 font-bold text-foreground">{acc.name}</td>
                      <td className="py-2.5 px-4">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          acc.type === 'ASSET' ? 'bg-blue-500/10 text-blue-500' :
                          acc.type === 'LIABILITY' ? 'bg-amber-500/10 text-amber-500' :
                          acc.type === 'EQUITY' ? 'bg-purple-500/10 text-purple-500' :
                          acc.type === 'REVENUE' ? 'bg-emerald-500/10 text-emerald-500' :
                          'bg-rose-500/10 text-rose-500'
                        }`}>
                          {acc.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-muted-foreground">{acc.description}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className="text-[10px] bg-secondary text-muted-foreground px-2 py-0.5 rounded font-mono">
                          System Active
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
