"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { 
  Link2, ExternalLink, CreditCard, Copy, Check, ShieldCheck, 
  Key, Globe, CheckCircle2, RefreshCw
} from "lucide-react";
import { useToast } from "@/components/ui/toast-context";

export default function IntegrationsPage() {
  const [activeIframe, setActiveIframe] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [razorpaySecret, setRazorpaySecret] = useState("");
  const [stripeSecret, setStripeSecret] = useState("");
  const [paypalSecret, setPaypalSecret] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const { toast } = useToast();

  const [origin, setOrigin] = useState("https://invoice.safehousestudios.tech");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }

    // Fetch existing webhook secrets
    api.get('/settings').then(res => {
      const settings = res.data.data || res.data || [];
      settings.forEach((s: any) => {
        if (s.key === "RAZORPAY_WEBHOOK_SECRET" && s.value) setRazorpaySecret(s.value);
        if (s.key === "STRIPE_WEBHOOK_SECRET" && s.value) setStripeSecret(s.value);
        if (s.key === "PAYPAL_WEBHOOK_SECRET" && s.value) setPaypalSecret(s.value);
      });
    }).catch(() => {});
  }, []);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    toast(`${label} copied to clipboard!`, "success");
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleSaveSecret = async (key: string, value: string) => {
    setSavingKey(key);
    try {
      await api.post('/settings', {
        key: key,
        value: value
      });
      toast(`${key.replace('_', ' ')} saved`, "success");
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to save secret", "error");
    } finally {
      setSavingKey(null);
    }
  };

  const apps = [
    { name: "Gitea (Self-Hosted Git)", desc: "Code repositories and issue tracking", url: "https://gitea.io" },
    { name: "Plane (Project Management)", desc: "Agile sprints and issue tracking", url: "https://plane.so" },
    { name: "Uptime Kuma (Monitors)", desc: "Server heartbeat & uptime tracking", url: "https://uptime.kuma.pet" },
  ];

  return (
    <div className="space-y-8 p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <Link2 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Integrations &amp; Payment Webhooks</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Automated invoice reconciliation, payment webhooks, and DevOps microservices</p>
        </div>
      </div>

      {/* Section 1: Payment Gateway Webhook Auto-Reconciliation */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold text-foreground">Payment Gateway Auto-Reconciliation Webhooks</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Configure these webhook endpoints in your payment gateway dashboard. When clients pay invoices, the gateway sends an event to InvoiceCore which automatically verifies HMAC signatures, marks the invoice as <strong className="text-emerald-500 font-semibold">PAID</strong>, and enters receipts into the financial ledger.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {/* Razorpay Webhook Card */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between gap-5 relative overflow-hidden">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-base text-foreground flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500" /> Razorpay
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-500">
                  HMAC SHA256
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Handles <code className="text-foreground">payment.captured</code> and <code className="text-foreground">order.paid</code> events.
              </p>

              <div className="space-y-1.5 pt-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Webhook Endpoint URL</label>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    className="w-full px-2.5 py-1.5 rounded-lg bg-muted text-xs font-mono border border-border text-foreground truncate select-all"
                    value={`${origin}/api/webhooks/razorpay`}
                  />
                  <button
                    onClick={() => copyToClipboard(`${origin}/api/webhooks/razorpay`, "Razorpay Webhook URL")}
                    className="p-2 rounded-lg bg-secondary hover:bg-muted text-foreground transition-colors shrink-0"
                    title="Copy URL"
                  >
                    {copiedKey === "Razorpay Webhook URL" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Webhook Secret</label>
                <input
                  type="password"
                  placeholder="Paste your Razorpay secret..."
                  className="w-full px-3 py-1.5 rounded-lg bg-background border border-border text-xs outline-none text-foreground"
                  value={razorpaySecret}
                  onChange={e => setRazorpaySecret(e.target.value)}
                />
              </div>
            </div>

            <button
              onClick={() => handleSaveSecret("RAZORPAY_WEBHOOK_SECRET", razorpaySecret)}
              disabled={savingKey === "RAZORPAY_WEBHOOK_SECRET"}
              className="w-full py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              {savingKey === "RAZORPAY_WEBHOOK_SECRET" ? "Saving..." : "Save Razorpay Secret"}
            </button>
          </div>

          {/* Stripe Webhook Card */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between gap-5 relative overflow-hidden">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-base text-foreground flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-purple-500" /> Stripe
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-500">
                  v1 Signature
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Handles <code className="text-foreground">checkout.session.completed</code> &amp; <code className="text-foreground">payment_intent.succeeded</code>.
              </p>

              <div className="space-y-1.5 pt-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Webhook Endpoint URL</label>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    className="w-full px-2.5 py-1.5 rounded-lg bg-muted text-xs font-mono border border-border text-foreground truncate select-all"
                    value={`${origin}/api/webhooks/stripe`}
                  />
                  <button
                    onClick={() => copyToClipboard(`${origin}/api/webhooks/stripe`, "Stripe Webhook URL")}
                    className="p-2 rounded-lg bg-secondary hover:bg-muted text-foreground transition-colors shrink-0"
                    title="Copy URL"
                  >
                    {copiedKey === "Stripe Webhook URL" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Webhook Signing Secret (whsec_...)</label>
                <input
                  type="password"
                  placeholder="whsec_..."
                  className="w-full px-3 py-1.5 rounded-lg bg-background border border-border text-xs outline-none text-foreground"
                  value={stripeSecret}
                  onChange={e => setStripeSecret(e.target.value)}
                />
              </div>
            </div>

            <button
              onClick={() => handleSaveSecret("STRIPE_WEBHOOK_SECRET", stripeSecret)}
              disabled={savingKey === "STRIPE_WEBHOOK_SECRET"}
              className="w-full py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              {savingKey === "STRIPE_WEBHOOK_SECRET" ? "Saving..." : "Save Stripe Secret"}
            </button>
          </div>

          {/* PayPal Webhook Card */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between gap-5 relative overflow-hidden">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-base text-foreground flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-cyan-500" /> PayPal
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-500">
                  Instant IPN / Webhook
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Handles <code className="text-foreground">PAYMENT.CAPTURE.COMPLETED</code> and invoice settlement.
              </p>

              <div className="space-y-1.5 pt-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Webhook Endpoint URL</label>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    className="w-full px-2.5 py-1.5 rounded-lg bg-muted text-xs font-mono border border-border text-foreground truncate select-all"
                    value={`${origin}/api/webhooks/paypal`}
                  />
                  <button
                    onClick={() => copyToClipboard(`${origin}/api/webhooks/paypal`, "PayPal Webhook URL")}
                    className="p-2 rounded-lg bg-secondary hover:bg-muted text-foreground transition-colors shrink-0"
                    title="Copy URL"
                  >
                    {copiedKey === "PayPal Webhook URL" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Webhook ID (Optional)</label>
                <input
                  type="password"
                  placeholder="PayPal Webhook ID..."
                  className="w-full px-3 py-1.5 rounded-lg bg-background border border-border text-xs outline-none text-foreground"
                  value={paypalSecret}
                  onChange={e => setPaypalSecret(e.target.value)}
                />
              </div>
            </div>

            <button
              onClick={() => handleSaveSecret("PAYPAL_WEBHOOK_SECRET", paypalSecret)}
              disabled={savingKey === "PAYPAL_WEBHOOK_SECRET"}
              className="w-full py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              {savingKey === "PAYPAL_WEBHOOK_SECRET" ? "Saving..." : "Save PayPal Secret"}
            </button>
          </div>
        </div>
      </div>

      {/* Section 2: Hub & Spoke DevOps Services */}
      <div className="space-y-4 pt-6 border-t border-border">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold text-foreground">Hub &amp; Spoke DevOps Services</h2>
        </div>

        {!activeIframe ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {apps.map((app) => (
              <div 
                key={app.name} 
                className="bg-card p-6 rounded-2xl border border-border shadow-sm hover:border-primary/50 transition-all cursor-pointer flex flex-col items-center gap-3 text-center group"
                onClick={() => setActiveIframe(app.url)}
              >
                <div className="h-14 w-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                  <ExternalLink className="h-7 w-7" />
                </div>
                <h3 className="font-bold text-base text-foreground">{app.name}</h3>
                <p className="text-xs text-muted-foreground">{app.desc}</p>
                <span className="text-xs font-semibold text-primary group-hover:underline mt-1">Open Service &rarr;</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col h-[calc(100vh-250px)]">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-base font-bold text-foreground">Embedded View: {apps.find(a => a.url === activeIframe)?.name}</h3>
              <button 
                onClick={() => setActiveIframe(null)}
                className="text-xs bg-secondary text-foreground px-3 py-1.5 rounded-lg hover:bg-muted transition-colors font-semibold"
              >
                Close View
              </button>
            </div>
            <div className="flex-1 bg-white rounded-xl overflow-hidden border border-border shadow-inner">
              <iframe 
                src={activeIframe} 
                className="w-full h-full border-none" 
                title="Embedded App"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
