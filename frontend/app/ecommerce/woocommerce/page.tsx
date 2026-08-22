"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { 
  ShoppingBag, RefreshCw, CheckCircle2, ExternalLink, 
  Copy, Check, Clock, Package, DollarSign, Key, Globe, 
  Layers, ArrowUpRight, Search, FileText
} from "lucide-react";
import { useToast } from "@/components/ui/toast-context";
import { AVAILABLE_CURRENCIES } from "@/lib/currencies";

interface InvoiceRecord {
  id: number;
  invoice_number: string;
  client_id: number;
  client?: {
    company_name: string;
    email?: string;
    phone?: string;
    addresses?: any;
  };
  issue_date: string;
  grand_total: number;
  subtotal: number;
  currency: string;
  status: string;
  remarks?: string;
  line_items: any[];
}

export default function WooCommerceStorePage() {
  const [orders, setOrders] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<"orders" | "settings">("orders");
  const [baseCurrency, setBaseCurrency] = useState("₹");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  // Settings State
  const [storeUrl, setStoreUrl] = useState("https://tytgear.com");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  const [origin, setOrigin] = useState("https://invoice.safehousestudios.tech");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordersRes, configRes, locRes] = await Promise.all([
        api.get('/software/woocommerce/orders'),
        api.get('/software/woocommerce/config').catch(() => ({ data: { data: {} } })),
        api.get('/settings/LOCALIZATION').catch(() => ({ data: null }))
      ]);

      setOrders(ordersRes.data.data || []);

      const cfg = configRes.data?.data || {};
      if (cfg.store_url) setStoreUrl(cfg.store_url);
      if (cfg.consumer_key) setConsumerKey(cfg.consumer_key);
      if (cfg.consumer_secret) setConsumerSecret(cfg.consumer_secret);
      if (cfg.webhook_secret) setWebhookSecret(cfg.webhook_secret);

      if (locRes.data && locRes.data.value) {
        try {
          const parsed = typeof locRes.data.value === 'string' ? JSON.parse(locRes.data.value) : locRes.data.value;
          if (parsed.base_currency) {
            const symbolMatch = AVAILABLE_CURRENCIES?.find((c: any) => c.code === parsed.base_currency);
            setBaseCurrency(symbolMatch ? symbolMatch.symbol : parsed.base_currency);
          }
        } catch (e) {}
      }
    } catch (e) {
      console.error("Failed to load WooCommerce data", e);
      toast("Failed to load WooCommerce store data", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await api.post('/software/woocommerce/config', {
        store_url: storeUrl,
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
        webhook_secret: webhookSecret,
      });
      toast("WooCommerce store settings saved successfully", "success");
    } catch (e: any) {
      toast(e.response?.data?.error || "Failed to save settings", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    toast(`${label} copied to clipboard!`, "success");
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // KPIs
  const totalRevenue = orders.reduce((sum, o) => sum + (o.status === "PAID" ? o.grand_total : 0), 0);
  const paidCount = orders.filter(o => o.status === "PAID").length;
  const pendingCount = orders.filter(o => o.status !== "PAID" && o.status !== "CANCELLED").length;

  const filteredOrders = orders.filter(o => 
    o.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    (o.client?.company_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (o.remarks || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 flex flex-col p-8 min-h-[calc(100vh-64px)] max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20 shadow-sm">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">TYTGEAR WooCommerce Store</h1>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Store
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Automated sales ingestion, customer fulfillment, and 3D print queueing from <strong className="text-foreground">{storeUrl}</strong>
            </p>
          </div>
        </div>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => {
              if (!storeUrl) return;
              try {
                const formatted = /^https?:\/\//i.test(storeUrl) ? storeUrl : `https://${storeUrl}`;
                const parsed = new URL(formatted);
                if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                  const a = document.createElement('a');
                  a.href = parsed.href;
                  a.target = '_blank';
                  a.rel = 'noopener noreferrer';
                  a.click();
                }
              } catch (e) {
                console.error("Invalid store URL", e);
              }
            }}
            className="bg-secondary hover:bg-muted text-foreground font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm transition-colors text-xs border border-border cursor-pointer"
          >
            <Globe className="w-4 h-4 text-emerald-500" /> Visit Store <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={fetchData}
            className="bg-primary hover:opacity-90 text-primary-foreground font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm transition-all text-xs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Feed
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <div className="bg-card p-5 rounded-2xl border border-border shadow-sm flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Gross Store Sales</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">{baseCurrency}{totalRevenue.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground">{orders.length} orders</span>
          </div>
        </div>

        <div className="bg-card p-5 rounded-2xl border border-border shadow-sm flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Settled &amp; Paid</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-emerald-500">{paidCount}</span>
            <span className="text-xs text-emerald-600 font-semibold">Invoices Auto-Generated</span>
          </div>
        </div>

        <div className="bg-card p-5 rounded-2xl border border-border shadow-sm flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fulfillment &amp; COD</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-amber-500">{pendingCount}</span>
            <span className="text-xs text-muted-foreground">In Processing</span>
          </div>
        </div>

        <div className="bg-card p-5 rounded-2xl border border-border shadow-sm flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Target Products</span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-primary">Deskmat &bull; 3D Prints</span>
          </div>
          <span className="text-[11px] text-muted-foreground">Keyboards &bull; Posters &bull; Tapestries</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-muted/40 p-1 rounded-xl border border-border self-start">
        <button
          onClick={() => setActiveTab("orders")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "orders" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Package className="w-3.5 h-3.5" /> Synced Orders &amp; Invoices ({orders.length})
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "settings" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Key className="w-3.5 h-3.5" /> WordPress Webhook &amp; API Keys
        </button>
      </div>

      {/* Tab 1: Orders Table */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-card border border-border p-3 rounded-xl">
            <Search className="w-4 h-4 text-muted-foreground ml-1" />
            <input 
              type="text" 
              placeholder="Search by order/invoice number, customer name, or item description..." 
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
                    <th className="p-4">Order / Invoice #</th>
                    <th className="p-4">Customer Details</th>
                    <th className="p-4">Merchandise &amp; Line Items</th>
                    <th className="p-4">Total Amount</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-border">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground text-sm">
                        No WooCommerce orders received yet. Configure the webhook below to start streaming orders automatically from <strong className="text-foreground">tytgear.com</strong>.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map(order => (
                      <tr key={order.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-foreground">{order.invoice_number}</div>
                          <div className="text-xs text-muted-foreground">{new Date(order.issue_date).toLocaleDateString()}</div>
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-foreground">{order.client?.company_name || 'Customer'}</div>
                          <div className="text-xs text-muted-foreground">{order.client?.email || '—'}</div>
                        </td>
                        <td className="p-4 text-xs space-y-1 max-w-[280px]">
                          {order.line_items?.map((item: any, idx: number) => (
                            <div key={idx} className="text-foreground truncate flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                              <span className="truncate">{item.description} &times; {item.quantity}</span>
                            </div>
                          ))}
                        </td>
                        <td className="p-4 font-bold text-foreground">
                          {baseCurrency}{order.grand_total.toFixed(2)}
                        </td>
                        <td className="p-4">
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                            order.status === 'PAID' ? 'bg-emerald-500/15 text-emerald-500' :
                            order.status === 'CANCELLED' ? 'bg-rose-500/15 text-rose-500' : 'bg-amber-500/15 text-amber-500'
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <a
                            href={`/invoices`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-secondary hover:bg-muted text-xs font-semibold text-foreground transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5 text-primary" /> View Invoice
                          </a>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: WordPress / WooCommerce Settings */}
      {activeTab === "settings" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Webhook Configuration Card */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">
            <div>
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <Globe className="w-5 h-5 text-emerald-500" /> Webhook Setup (WordPress &rarr; InvoiceCore)
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Configure this webhook in your WordPress admin panel (<strong className="text-foreground">WooCommerce &rarr; Settings &rarr; Advanced &rarr; Webhooks</strong>) to stream live sales into InvoiceCore.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Webhook Delivery URL</label>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    className="w-full px-3 py-2 rounded-lg bg-muted text-xs font-mono border border-border text-foreground truncate select-all"
                    value={`${origin}/api/webhooks/woocommerce`}
                  />
                  <button
                    onClick={() => copyToClipboard(`${origin}/api/webhooks/woocommerce`, "Webhook URL")}
                    className="p-2 rounded-lg bg-secondary hover:bg-muted text-foreground transition-colors shrink-0"
                    title="Copy URL"
                  >
                    {copiedKey === "Webhook URL" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Webhook Secret (Secret Key in WooCommerce)</label>
                <input
                  type="password"
                  placeholder="Paste WooCommerce Webhook Secret..."
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs outline-none text-foreground"
                  value={webhookSecret}
                  onChange={e => setWebhookSecret(e.target.value)}
                />
              </div>

              <div className="bg-muted/40 p-4 rounded-xl border border-border text-xs space-y-2 text-muted-foreground">
                <strong className="text-foreground block">Quick WordPress Webhook Settings:</strong>
                <div>&bull; <strong>Topic:</strong> <code className="text-foreground">Order created</code> (or <code className="text-foreground">Order updated</code>)</div>
                <div>&bull; <strong>Status:</strong> <code className="text-emerald-500">Active</code></div>
                <div>&bull; <strong>API Version:</strong> <code className="text-foreground">WP REST API Integration v3</code></div>
              </div>
            </div>
          </div>

          {/* REST API Sync Credentials Card */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">
            <div>
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <Key className="w-5 h-5 text-primary" /> Store REST API Credentials
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Required for bi-directional order pulls and catalog sync with <strong className="text-foreground">tytgear.com</strong>.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">WordPress Store URL</label>
                <input
                  type="text"
                  placeholder="https://tytgear.com"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs outline-none text-foreground"
                  value={storeUrl}
                  onChange={e => setStoreUrl(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Consumer Key (ck_...)</label>
                <input
                  type="text"
                  placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs outline-none text-foreground font-mono"
                  value={consumerKey}
                  onChange={e => setConsumerKey(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Consumer Secret (cs_...)</label>
                <input
                  type="password"
                  placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs outline-none text-foreground font-mono"
                  value={consumerSecret}
                  onChange={e => setConsumerSecret(e.target.value)}
                />
              </div>

              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="w-full py-2.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
              >
                {savingSettings ? "Saving..." : "Save WooCommerce Settings"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
