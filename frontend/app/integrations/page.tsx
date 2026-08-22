"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { 
  Link2, ExternalLink, CreditCard, Copy, Check, ShieldCheck, 
  Key, Globe, CheckCircle2, RefreshCw, Bell, Send, MessageSquare,
  Bot, AlertTriangle, DollarSign, Lock, Printer, Radio, ToggleLeft, ToggleRight
} from "lucide-react";
import { useToast } from "@/components/ui/toast-context";

interface NotificationConfig {
  telegram_enabled: boolean;
  telegram_bot_token: string;
  telegram_chat_id: string;

  discord_enabled: boolean;
  discord_webhook_url: string;

  whatsapp_enabled: boolean;
  whatsapp_webhook_url: string;
  whatsapp_phone: string;

  custom_webhook_enabled: boolean;
  custom_webhook_url: string;

  notify_bambu_finished: boolean;
  notify_bambu_clogged: boolean;
  notify_invoice_paid: boolean;
  notify_ssl_expiry: boolean;
}

export default function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState<"alerts" | "payments" | "devops">("alerts");
  const [activeIframe, setActiveIframe] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  
  // Payment Gateway Secrets
  const [razorpaySecret, setRazorpaySecret] = useState("");
  const [stripeSecret, setStripeSecret] = useState("");
  const [paypalSecret, setPaypalSecret] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  
  // Notification Config State
  const [notifConfig, setNotifConfig] = useState<NotificationConfig>({
    telegram_enabled: false,
    telegram_bot_token: "",
    telegram_chat_id: "",
    discord_enabled: false,
    discord_webhook_url: "",
    whatsapp_enabled: false,
    whatsapp_webhook_url: "",
    whatsapp_phone: "",
    custom_webhook_enabled: false,
    custom_webhook_url: "",
    notify_bambu_finished: true,
    notify_bambu_clogged: true,
    notify_invoice_paid: true,
    notify_ssl_expiry: true,
  });

  const [savingNotifs, setSavingNotifs] = useState(false);
  const [testingChannel, setTestingChannel] = useState<string | null>(null);
  const { toast } = useToast();
  const [origin, setOrigin] = useState("https://invoice.safehousestudios.tech");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }

    // Fetch existing payment webhook secrets
    api.get('/settings').then(res => {
      const settings = res.data.data || res.data || [];
      settings.forEach((s: any) => {
        if (s.key === "RAZORPAY_WEBHOOK_SECRET" && s.value) setRazorpaySecret(s.value);
        if (s.key === "STRIPE_WEBHOOK_SECRET" && s.value) setStripeSecret(s.value);
        if (s.key === "PAYPAL_WEBHOOK_SECRET" && s.value) setPaypalSecret(s.value);
      });
    }).catch(() => {});

    // Fetch notification configuration
    api.get('/notifications/config').then(res => {
      if (res.data?.data) {
        setNotifConfig(prev => ({ ...prev, ...res.data.data }));
      }
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

  const handleSaveNotifications = async () => {
    setSavingNotifs(true);
    try {
      await api.post('/notifications/config', notifConfig);
      toast("Push & Webhook notification channels saved!", "success");
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to save notification settings", "error");
    } finally {
      setSavingNotifs(false);
    }
  };

  const handleSendTestAlert = async (channel: string) => {
    setTestingChannel(channel);
    try {
      await api.post('/notifications/test', { channel });
      toast(`Test alert sent to ${channel.toUpperCase()}!`, "success");
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to send test alert", "error");
    } finally {
      setTestingChannel(null);
    }
  };

  const apps = [
    { name: "Gitea (Self-Hosted Git)", desc: "Code repositories and issue tracking", url: "https://gitea.io" },
    { name: "Plane (Project Management)", desc: "Agile sprints and issue tracking", url: "https://plane.so" },
    { name: "Uptime Kuma (Monitors)", desc: "Server heartbeat & uptime tracking", url: "https://uptime.kuma.pet" },
  ];

  return (
    <div className="space-y-8 p-8 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Integrations &amp; Notification Engine</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Omnichannel alerts (Telegram, Discord, WhatsApp), payment gateway webhooks, and DevOps microservices
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border text-sm font-semibold">
        <button
          onClick={() => setActiveTab("alerts")}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "alerts"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Bell className="w-4 h-4" /> Push &amp; Webhook Alerts
        </button>
        <button
          onClick={() => setActiveTab("payments")}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "payments"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <CreditCard className="w-4 h-4" /> Payment Gateways
        </button>
        <button
          onClick={() => setActiveTab("devops")}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "devops"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Globe className="w-4 h-4" /> DevOps Microservices
        </button>
      </div>

      {/* TAB 1: PUSH & WEBHOOK NOTIFICATIONS */}
      {activeTab === "alerts" && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Section: Event Subscriptions */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <Radio className="w-4 h-4 text-primary" /> Active Event Subscriptions
                </h3>
                <p className="text-xs text-muted-foreground">Select which critical business events trigger instant alerts</p>
              </div>
              <button
                onClick={handleSaveNotifications}
                disabled={savingNotifs}
                className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-lg text-xs hover:opacity-90 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                {savingNotifs ? "Saving..." : "Save Subscriptions"}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
              {/* Bambu Finished Toggle */}
              <div 
                onClick={() => setNotifConfig(c => ({ ...c, notify_bambu_finished: !c.notify_bambu_finished }))}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                  notifConfig.notify_bambu_finished 
                    ? "bg-emerald-500/10 border-emerald-500/40 text-foreground" 
                    : "bg-secondary/40 border-border text-muted-foreground opacity-60"
                }`}
              >
                <Printer className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <span>🚨 Bambu Print Finished</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    Alerts when 3D print job reaches 100% completion.
                  </p>
                </div>
              </div>

              {/* Bambu Clogged Toggle */}
              <div 
                onClick={() => setNotifConfig(c => ({ ...c, notify_bambu_clogged: !c.notify_bambu_clogged }))}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                  notifConfig.notify_bambu_clogged 
                    ? "bg-rose-500/10 border-rose-500/40 text-foreground" 
                    : "bg-secondary/40 border-border text-muted-foreground opacity-60"
                }`}
              >
                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <span>🚨 Nozzle Clog / Failure</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    Alerts on extrusion stalls, HMS warnings, or print errors.
                  </p>
                </div>
              </div>

              {/* Invoice Paid Toggle */}
              <div 
                onClick={() => setNotifConfig(c => ({ ...c, notify_invoice_paid: !c.notify_invoice_paid }))}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                  notifConfig.notify_invoice_paid 
                    ? "bg-primary/10 border-primary/40 text-foreground" 
                    : "bg-secondary/40 border-border text-muted-foreground opacity-60"
                }`}
              >
                <DollarSign className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <span>💰 Client Paid Invoice ($$$)</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    Instant alert upon client settlement or gateway webhook.
                  </p>
                </div>
              </div>

              {/* SSL Expiry Toggle */}
              <div 
                onClick={() => setNotifConfig(c => ({ ...c, notify_ssl_expiry: !c.notify_ssl_expiry }))}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                  notifConfig.notify_ssl_expiry 
                    ? "bg-amber-500/10 border-amber-500/40 text-foreground" 
                    : "bg-secondary/40 border-border text-muted-foreground opacity-60"
                }`}
              >
                <Lock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <span>🔒 SSL Expiring (&le; 14 Days)</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    Proactive warnings to renew before certificate outages.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Notification Channels Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Telegram Bot Card */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between gap-5 relative overflow-hidden">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-base text-foreground flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#229ED9]" /> Telegram Bot
                  </span>
                  <button
                    onClick={() => setNotifConfig(c => ({ ...c, telegram_enabled: !c.telegram_enabled }))}
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full transition-colors cursor-pointer ${
                      notifConfig.telegram_enabled
                        ? "bg-[#229ED9]/20 text-[#229ED9] border border-[#229ED9]/40"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {notifConfig.telegram_enabled ? "Enabled" : "Disabled"}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Receive instant HTML/Markdown push messages to your Telegram bot or group chat.
                </p>

                <div className="space-y-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bot API Token</label>
                    <input
                      type="password"
                      placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ..."
                      className="w-full px-3 py-1.5 rounded-lg bg-background border border-border text-xs outline-none text-foreground font-mono"
                      value={notifConfig.telegram_bot_token}
                      onChange={e => setNotifConfig(c => ({ ...c, telegram_bot_token: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Chat ID / Group ID</label>
                    <input
                      type="text"
                      placeholder="@channel_name or -100123456789"
                      className="w-full px-3 py-1.5 rounded-lg bg-background border border-border text-xs outline-none text-foreground font-mono"
                      value={notifConfig.telegram_chat_id}
                      onChange={e => setNotifConfig(c => ({ ...c, telegram_chat_id: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-border/50">
                <button
                  onClick={handleSaveNotifications}
                  disabled={savingNotifs}
                  className="w-full py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                >
                  {savingNotifs ? "Saving..." : "Save Telegram Config"}
                </button>
                <button
                  onClick={() => handleSendTestAlert("telegram")}
                  disabled={testingChannel === "telegram" || !notifConfig.telegram_bot_token}
                  className="w-full py-1.5 bg-secondary hover:bg-muted text-foreground text-xs font-semibold rounded-lg border border-border transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3 h-3 text-[#229ED9]" />
                  {testingChannel === "telegram" ? "Sending..." : "Send Test Alert"}
                </button>
              </div>
            </div>

            {/* Discord Webhook Card */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between gap-5 relative overflow-hidden">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-base text-foreground flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#5865F2]" /> Discord Webhook
                  </span>
                  <button
                    onClick={() => setNotifConfig(c => ({ ...c, discord_enabled: !c.discord_enabled }))}
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full transition-colors cursor-pointer ${
                      notifConfig.discord_enabled
                        ? "bg-[#5865F2]/20 text-[#5865F2] border border-[#5865F2]/40"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {notifConfig.discord_enabled ? "Enabled" : "Disabled"}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Delivers color-coded rich embeds (Green for payments, Gold for print success, Red for clogs).
                </p>

                <div className="space-y-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Discord Webhook URL</label>
                    <input
                      type="password"
                      placeholder="https://discord.com/api/webhooks/..."
                      className="w-full px-3 py-1.5 rounded-lg bg-background border border-border text-xs outline-none text-foreground font-mono"
                      value={notifConfig.discord_webhook_url}
                      onChange={e => setNotifConfig(c => ({ ...c, discord_webhook_url: e.target.value }))}
                    />
                  </div>
                  <div className="p-2.5 rounded-lg bg-secondary/30 border border-border/50 text-[11px] text-muted-foreground space-y-1">
                    <div className="font-semibold text-foreground">💡 Pro-Tip:</div>
                    <div>Create a dedicated <code>#erp-alerts</code> channel in your Discord server and copy its integration webhook URL.</div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-border/50">
                <button
                  onClick={handleSaveNotifications}
                  disabled={savingNotifs}
                  className="w-full py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                >
                  {savingNotifs ? "Saving..." : "Save Discord Config"}
                </button>
                <button
                  onClick={() => handleSendTestAlert("discord")}
                  disabled={testingChannel === "discord" || !notifConfig.discord_webhook_url}
                  className="w-full py-1.5 bg-secondary hover:bg-muted text-foreground text-xs font-semibold rounded-lg border border-border transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3 h-3 text-[#5865F2]" />
                  {testingChannel === "discord" ? "Sending..." : "Send Test Alert"}
                </button>
              </div>
            </div>

            {/* WhatsApp / Custom Webhook Card */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between gap-5 relative overflow-hidden">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-base text-foreground flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#25D366]" /> WhatsApp / Webhook
                  </span>
                  <button
                    onClick={() => setNotifConfig(c => ({ ...c, whatsapp_enabled: !c.whatsapp_enabled }))}
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full transition-colors cursor-pointer ${
                      notifConfig.whatsapp_enabled
                        ? "bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/40"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {notifConfig.whatsapp_enabled ? "Enabled" : "Disabled"}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Connect WhatsApp Cloud API, Green API, Twilio, or any custom microservice webhook.
                </p>

                <div className="space-y-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Webhook / Relay Endpoint URL</label>
                    <input
                      type="text"
                      placeholder="https://api.green-api.com/waInstance... or custom"
                      className="w-full px-3 py-1.5 rounded-lg bg-background border border-border text-xs outline-none text-foreground font-mono"
                      value={notifConfig.whatsapp_webhook_url}
                      onChange={e => setNotifConfig(c => ({ ...c, whatsapp_webhook_url: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Target Phone (with country code)</label>
                    <input
                      type="text"
                      placeholder="+91 98765 43210"
                      className="w-full px-3 py-1.5 rounded-lg bg-background border border-border text-xs outline-none text-foreground font-mono"
                      value={notifConfig.whatsapp_phone}
                      onChange={e => setNotifConfig(c => ({ ...c, whatsapp_phone: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-border/50">
                <button
                  onClick={handleSaveNotifications}
                  disabled={savingNotifs}
                  className="w-full py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                >
                  {savingNotifs ? "Saving..." : "Save WhatsApp Config"}
                </button>
                <button
                  onClick={() => handleSendTestAlert("whatsapp")}
                  disabled={testingChannel === "whatsapp" || !notifConfig.whatsapp_webhook_url}
                  className="w-full py-1.5 bg-secondary hover:bg-muted text-foreground text-xs font-semibold rounded-lg border border-border transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3 h-3 text-[#25D366]" />
                  {testingChannel === "whatsapp" ? "Sending..." : "Send Test Alert"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PAYMENT GATEWAY WEBHOOKS */}
      {activeTab === "payments" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Payment Gateway Auto-Reconciliation Webhooks</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Configure these webhook endpoints in your payment gateway dashboard. When clients pay invoices, the gateway sends an event to InvoiceCore which automatically verifies HMAC signatures, marks the invoice as <strong className="text-emerald-500 font-semibold">PAID</strong>, triggers push alerts, and reconciles the financial ledger.
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
                      className="p-2 rounded-lg bg-secondary hover:bg-muted text-foreground transition-colors shrink-0 cursor-pointer"
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
                className="w-full py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
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
                      className="p-2 rounded-lg bg-secondary hover:bg-muted text-foreground transition-colors shrink-0 cursor-pointer"
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
                className="w-full py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
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
                      className="p-2 rounded-lg bg-secondary hover:bg-muted text-foreground transition-colors shrink-0 cursor-pointer"
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
                className="w-full py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
              >
                {savingKey === "PAYPAL_WEBHOOK_SECRET" ? "Saving..." : "Save PayPal Secret"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DEVOPS MICROSERVICES */}
      {activeTab === "devops" && (
        <div className="space-y-4 animate-in fade-in duration-200">
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
                  className="text-xs bg-secondary text-foreground px-3 py-1.5 rounded-lg hover:bg-muted transition-colors font-semibold cursor-pointer"
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
      )}
    </div>
  );
}
