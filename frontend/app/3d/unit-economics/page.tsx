"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { 
  Calculator, TrendingUp, Zap, Clock, Package, DollarSign, 
  Printer, Layers, Users, PieChart, ArrowUpRight, CheckCircle2, RefreshCw
} from "lucide-react";
import { useToast } from "@/components/ui/toast-context";
import { AVAILABLE_CURRENCIES } from "@/lib/currencies";

interface PrinterEconomics {
  printer_id: number;
  name: string;
  make: string;
  purchase_price: number;
  total_jobs: number;
  total_print_hours: number;
  power_consumed_kwh: number;
  depreciation_cost: number;
  electricity_cost: number;
  filament_cost: number;
  labor_cost: number;
  total_cost: number;
  total_revenue: number;
  net_profit: number;
  margin_percent: number;
  roi_percent: number;
}

interface MaterialEconomics {
  material_type: string;
  total_grams: number;
  total_jobs: number;
  material_cost: number;
  total_revenue: number;
  net_profit: number;
  margin_percent: number;
}

interface ClientEconomics {
  client_id: number;
  client_name: string;
  total_jobs: number;
  total_revenue: number;
  total_cost: number;
  net_profit: number;
  margin_percent: number;
}

interface UnitEconomicsData {
  total_jobs: number;
  total_print_hours: number;
  total_filament_grams: number;
  total_revenue: number;
  total_filament_cost: number;
  total_depreciation_cost: number;
  total_electricity_cost: number;
  total_labor_cost: number;
  total_cost: number;
  total_net_profit: number;
  average_margin_percent: number;
  by_printer: PrinterEconomics[];
  by_material: MaterialEconomics[];
  by_client: ClientEconomics[];
  recent_jobs: any[];
}

export default function UnitEconomicsPage() {
  const [data, setData] = useState<UnitEconomicsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"printer" | "material" | "client" | "jobs">("printer");
  const [baseCurrency, setBaseCurrency] = useState("₹");
  const { toast } = useToast();

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [res, locRes] = await Promise.all([
        api.get('/software/analytics/unit-economics'),
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
      toast("Failed to load unit economics analytics", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const totalCost = data?.total_cost || 1;
  const filamentShare = data ? Math.round((data.total_filament_cost / totalCost) * 100) : 0;
  const depShare = data ? Math.round((data.total_depreciation_cost / totalCost) * 100) : 0;
  const elecShare = data ? Math.round((data.total_electricity_cost / totalCost) * 100) : 0;
  const laborShare = data ? Math.round((data.total_labor_cost / totalCost) * 100) : 0;

  return (
    <div className="space-y-6 flex flex-col p-8 min-h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-on-surface flex items-center gap-3">
            <Calculator className="h-8 w-8 text-primary" />
            True Unit Economics &amp; ROI Matrix
          </h2>
          <p className="text-muted-foreground mt-1">
            Job costing formula: <span className="font-mono text-foreground font-semibold">Net Profit = Revenue − (Filament + Depreciation + Electricity + Labor)</span>
          </p>
        </div>

        <button 
          onClick={fetchAnalytics}
          className="bg-secondary hover:bg-muted text-foreground font-medium px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Matrix
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Gross Print Revenue</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">{baseCurrency}{data?.total_revenue?.toLocaleString() || "0"}</span>
            <span className="text-xs text-muted-foreground">{data?.total_jobs || 0} jobs</span>
          </div>
        </div>

        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Production Cost</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-rose-500">{baseCurrency}{data?.total_cost?.toLocaleString() || "0"}</span>
            <span className="text-xs text-muted-foreground">All 4 cost layers</span>
          </div>
        </div>

        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Net Fleet Profit</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-emerald-500">{baseCurrency}{data?.total_net_profit?.toLocaleString() || "0"}</span>
            <span className="text-xs text-emerald-600 font-bold">({data?.average_margin_percent || 0}% margin)</span>
          </div>
        </div>

        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Machine Utilization</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-primary">{data?.total_print_hours || 0}h</span>
            <span className="text-xs text-muted-foreground">/ {(Number(data?.total_filament_grams || 0) / 1000).toFixed(1)}kg filament</span>
          </div>
        </div>
      </div>

      {/* 4-Layer Cost Distribution Breakdown */}
      <div className="bg-card p-6 rounded-2xl border border-border shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
            <PieChart className="w-4 h-4 text-primary" /> Cost Component Distribution
          </h3>
          <span className="text-xs text-muted-foreground">Total Production Spend: {baseCurrency}{data?.total_cost?.toFixed(2) || "0.00"}</span>
        </div>

        {/* Visual Progress Stack */}
        <div className="h-4 w-full bg-muted rounded-full overflow-hidden flex shadow-inner">
          <div style={{ width: `${filamentShare}%` }} className="bg-blue-500 transition-all duration-500" title={`Filament: ${filamentShare}%`} />
          <div style={{ width: `${depShare}%` }} className="bg-purple-500 transition-all duration-500" title={`Depreciation: ${depShare}%`} />
          <div style={{ width: `${elecShare}%` }} className="bg-amber-500 transition-all duration-500" title={`Electricity: ${elecShare}%`} />
          <div style={{ width: `${laborShare}%` }} className="bg-emerald-500 transition-all duration-500" title={`Labor: ${laborShare}%`} />
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-foreground">Filament Spool ({filamentShare}%)</div>
              <div className="text-xs text-muted-foreground">{baseCurrency}{data?.total_filament_cost?.toFixed(2) || "0.00"}</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-purple-500 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-foreground">Machine Depreciation ({depShare}%)</div>
              <div className="text-xs text-muted-foreground">{baseCurrency}{data?.total_depreciation_cost?.toFixed(2) || "0.00"}</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-foreground">Electricity kWh ({elecShare}%)</div>
              <div className="text-xs text-muted-foreground">{baseCurrency}{data?.total_electricity_cost?.toFixed(2) || "0.00"}</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-foreground">Labor &amp; Post-Proc ({laborShare}%)</div>
              <div className="text-xs text-muted-foreground">{baseCurrency}{data?.total_labor_cost?.toFixed(2) || "0.00"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex gap-2 bg-muted/40 p-1 rounded-xl border border-border self-start">
        <button
          onClick={() => setActiveTab("printer")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "printer" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Printer className="w-3.5 h-3.5" /> By Printer ROI
        </button>
        <button
          onClick={() => setActiveTab("material")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "material" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="w-3.5 h-3.5" /> By Material Type
        </button>
        <button
          onClick={() => setActiveTab("client")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "client" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="w-3.5 h-3.5" /> By Client Account
        </button>
        <button
          onClick={() => setActiveTab("jobs")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "jobs" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Package className="w-3.5 h-3.5" /> Recent Jobs Matrix
        </button>
      </div>

      {/* Tab 1: By Printer */}
      {activeTab === "printer" && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                <tr>
                  <th className="p-4">Printer &amp; Hardware</th>
                  <th className="p-4">Hours &amp; Energy</th>
                  <th className="p-4">Cost Breakdown (4-Layers)</th>
                  <th className="p-4">Gross Revenue</th>
                  <th className="p-4">Net Profit &amp; Margin</th>
                  <th className="p-4">Capex ROI Recovery</th>
                </tr>
              </thead>
              <tbody className="divide-y border-border">
                {(data?.by_printer || []).map(p => (
                  <tr key={p.printer_id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-foreground">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.make || 'Bambu Lab'} • Capex: {baseCurrency}{p.purchase_price.toLocaleString()}</div>
                    </td>
                    <td className="p-4 text-xs">
                      <div className="font-semibold text-foreground">{p.total_print_hours.toFixed(1)} hrs ({p.total_jobs} jobs)</div>
                      <div className="text-muted-foreground">{p.power_consumed_kwh.toFixed(1)} kWh power</div>
                    </td>
                    <td className="p-4 text-xs space-y-0.5">
                      <div className="text-muted-foreground">Filament: <span className="text-foreground">{baseCurrency}{p.filament_cost.toFixed(0)}</span> | Dep: <span className="text-foreground">{baseCurrency}{p.depreciation_cost.toFixed(0)}</span></div>
                      <div className="text-muted-foreground">Power: <span className="text-foreground">{baseCurrency}{p.electricity_cost.toFixed(0)}</span> | Labor: <span className="text-foreground">{baseCurrency}{p.labor_cost.toFixed(0)}</span></div>
                    </td>
                    <td className="p-4 font-bold text-foreground">
                      {baseCurrency}{p.total_revenue.toLocaleString()}
                    </td>
                    <td className="p-4">
                      <div className={`font-bold ${p.net_profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {baseCurrency}{p.net_profit.toFixed(2)}
                      </div>
                      <div className="text-xs text-emerald-600 font-semibold">{p.margin_percent.toFixed(1)}% margin</div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${Math.min(100, Math.max(0, p.roi_percent))}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-foreground">{p.roi_percent.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: By Material */}
      {activeTab === "material" && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                <tr>
                  <th className="p-4">Material Grade</th>
                  <th className="p-4">Jobs &amp; Mass Consumed</th>
                  <th className="p-4">Raw Material Spend</th>
                  <th className="p-4">Gross Revenue</th>
                  <th className="p-4">Net Contribution Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y border-border">
                {(data?.by_material || []).map(m => (
                  <tr key={m.material_type} className="hover:bg-muted/20 transition-colors">
                    <td className="p-4">
                      <span className="font-bold text-foreground text-sm px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                        {m.material_type}
                      </span>
                    </td>
                    <td className="p-4 text-xs">
                      <div className="font-semibold text-foreground">{m.total_grams.toFixed(0)} grams ({m.total_jobs} prints)</div>
                      <div className="text-muted-foreground">{(m.total_grams / 1000).toFixed(2)} kg extruded</div>
                    </td>
                    <td className="p-4 text-xs font-semibold text-rose-500">
                      {baseCurrency}{m.material_cost.toFixed(2)}
                    </td>
                    <td className="p-4 font-bold text-foreground">
                      {baseCurrency}{m.total_revenue.toLocaleString()}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-emerald-500">
                        {baseCurrency}{m.net_profit.toFixed(2)}
                      </div>
                      <div className="text-xs text-emerald-600 font-semibold">{m.margin_percent.toFixed(1)}% margin</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: By Client */}
      {activeTab === "client" && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                <tr>
                  <th className="p-4">Client Account</th>
                  <th className="p-4">Completed Jobs</th>
                  <th className="p-4">Total Billed Revenue</th>
                  <th className="p-4">True Production Cost</th>
                  <th className="p-4">Net Account Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y border-border">
                {(data?.by_client || []).map(c => (
                  <tr key={c.client_id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-4 font-bold text-foreground">
                      {c.client_name}
                    </td>
                    <td className="p-4 text-xs text-muted-foreground">
                      {c.total_jobs} print orders
                    </td>
                    <td className="p-4 font-bold text-foreground">
                      {baseCurrency}{c.total_revenue.toLocaleString()}
                    </td>
                    <td className="p-4 text-xs text-rose-500 font-semibold">
                      {baseCurrency}{c.total_cost.toFixed(2)}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-emerald-500">
                        {baseCurrency}{c.net_profit.toFixed(2)}
                      </div>
                      <div className="text-xs text-emerald-600 font-semibold">{c.margin_percent.toFixed(1)}% account margin</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Recent Jobs Ledger */}
      {activeTab === "jobs" && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                <tr>
                  <th className="p-4">Job Title &amp; Client</th>
                  <th className="p-4">Filament</th>
                  <th className="p-4">Machine Dep.</th>
                  <th className="p-4">Electricity</th>
                  <th className="p-4">Labor</th>
                  <th className="p-4">Total Cost</th>
                  <th className="p-4">Billed Revenue</th>
                  <th className="p-4">Net Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y border-border">
                {(data?.recent_jobs || []).map(j => (
                  <tr key={j.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-foreground">{j.title}</div>
                      <div className="text-xs text-muted-foreground">{j.client?.company_name || 'Direct Sale'} • {j.estimated_time_hours}h</div>
                    </td>
                    <td className="p-4 text-xs text-foreground">{baseCurrency}{Number(j.filament_cost || 0).toFixed(1)}</td>
                    <td className="p-4 text-xs text-foreground">{baseCurrency}{Number(j.depreciation_cost || 0).toFixed(1)}</td>
                    <td className="p-4 text-xs text-foreground">{baseCurrency}{Number(j.electricity_cost || 0).toFixed(1)}</td>
                    <td className="p-4 text-xs text-foreground">{baseCurrency}{Number(j.labor_cost || 0).toFixed(1)}</td>
                    <td className="p-4 text-xs font-bold text-rose-500">{baseCurrency}{Number(j.total_cost || 0).toFixed(1)}</td>
                    <td className="p-4 text-xs font-bold text-foreground">{baseCurrency}{Number(j.revenue || 0).toFixed(1)}</td>
                    <td className="p-4 text-xs font-bold text-emerald-500">
                      +{baseCurrency}{Number(j.net_profit || 0).toFixed(1)}
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
