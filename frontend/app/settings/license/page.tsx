"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import { 
  KeyRound, ShieldCheck, CheckCircle2, AlertCircle, Sparkles, 
  Layers, Printer, Globe, Lock, ShoppingBag, Building2, Copy, Check, RefreshCw
} from "lucide-react";
import { useToast } from "@/components/ui/toast-context";
import { useBusiness } from "@/contexts/business-context";

interface LicenseStatus {
  is_licensed: boolean;
  tier: string;
  tier_label: string;
  licensee_name: string;
  licensee_email: string;
  masked_serial_key: string;
  expires_at: string | null;
  days_remaining: number;
  is_expired: boolean;
  modules: string[];
  max_businesses: number;
  max_invoices_per_month: number;
  max_printers: number;
  max_domains: number;
  product_info: {
    product_name: string;
    version: string;
    developer: string;
    edition: string;
    tagline: string;
  };
}

export default function LicensePage() {
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [serialInput, setSerialInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { refreshBusinessUnits } = useBusiness();

  const fetchLicenseStatus = async () => {
    try {
      const res = await api.get('/license/status');
      setLicense(res.data);
    } catch (err: any) {
      console.error("Failed to load license info", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLicenseStatus();
  }, []);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serialInput.trim()) return;

    setSubmitting(true);
    try {
      const res = await api.post('/license/activate', { serial_key: serialInput.trim() });
      toast(res.data.message || "License successfully activated!", "success");
      setSerialInput("");
      await fetchLicenseStatus();
      await refreshBusinessUnits();
    } catch (err: any) {
      toast(err.response?.data?.error || "Invalid or corrupt license serial code", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    if (!confirm("Are you sure you want to deactivate this license and return to the Free Community Edition? All your data will remain completely intact.")) {
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.delete('/license/deactivate');
      toast(res.data.message || "License deactivated", "info");
      await fetchLicenseStatus();
      await refreshBusinessUnits();
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to deactivate license", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const isPro = license?.is_licensed && !license?.is_expired;

  return (
    <div className="space-y-8 max-w-6xl mx-auto p-6 md:p-8">
      {/* Safehouse Studios Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-950/40 via-cyan-950/30 to-purple-950/40 border border-blue-500/20 p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-400" /> Safehouse Studios Original
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {license?.product_info?.version || "v2.5.0"}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
              {license?.product_info?.product_name || "NexusCore ERP"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {license?.product_info?.tagline || "1st AI Assisted Development Project by Safehouse Studios"}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className={`px-4 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 shadow-sm ${
              isPro 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-emerald-500/10' 
                : 'bg-muted text-foreground border-border'
            }`}>
              <ShieldCheck className={`w-4 h-4 ${isPro ? 'text-emerald-400' : 'text-muted-foreground'}`} />
              {license?.tier_label || "Free Community Edition"}
            </div>
          </div>
        </div>
      </div>

      {/* Main License Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Status & Activation */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border ${
                  isPro ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-muted text-muted-foreground border-border'
                }`}>
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Instance License Profile</h2>
                  <p className="text-xs text-muted-foreground">Cryptographic serial verification status</p>
                </div>
              </div>

              {isPro && (
                <button
                  onClick={handleDeactivate}
                  disabled={submitting}
                  className="text-xs text-destructive hover:underline font-medium"
                >
                  Deactivate Key
                </button>
              )}
            </div>

            {/* License Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 bg-muted/30 rounded-xl border border-border space-y-1">
                <span className="text-muted-foreground text-[11px] uppercase tracking-wider font-semibold">Licensee / Organization</span>
                <p className="text-foreground font-bold text-sm truncate">{license?.licensee_name || "Community User"}</p>
                {license?.licensee_email && <p className="text-muted-foreground truncate">{license.licensee_email}</p>}
              </div>

              <div className="p-3.5 bg-muted/30 rounded-xl border border-border space-y-1">
                <span className="text-muted-foreground text-[11px] uppercase tracking-wider font-semibold">License Validity</span>
                <p className="text-foreground font-bold text-sm">
                  {isPro 
                    ? (license?.days_remaining && license.days_remaining > 3650 ? 'Perpetual Lifetime' : `${license?.days_remaining} Days Remaining`) 
                    : 'Free Open-Source Tier'}
                </p>
                {license?.expires_at && (
                  <p className="text-muted-foreground text-[11px]">
                    Expires: {new Date(license.expires_at).toLocaleDateString()}
                  </p>
                )}
              </div>

              {license?.masked_serial_key && (
                <div className="sm:col-span-2 p-3.5 bg-muted/30 rounded-xl border border-border flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground text-[10px] uppercase tracking-wider font-semibold">Active Serial Key</span>
                    <p className="font-mono text-xs font-bold text-cyan-400">{license.masked_serial_key}</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                    Cryptographically Valid
                  </span>
                </div>
              )}
            </div>

            {/* Serial Activation Form */}
            <form onSubmit={handleActivate} className="space-y-3 pt-2">
              <label className="text-xs font-bold text-foreground block">
                {isPro ? "Update / Replace License Key" : "Activate Commercial License Serial"}
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  placeholder="NEXUS-eyJwIjoiZXlKc2FXUWlPaUpzYV..."
                  value={serialInput}
                  onChange={e => setSerialInput(e.target.value)}
                  className="flex-1 px-4 py-2.5 bg-background border border-border rounded-xl text-xs font-mono text-foreground outline-none focus:border-primary transition-colors"
                />
                <button
                  type="submit"
                  disabled={submitting || !serialInput.trim()}
                  className="px-5 py-2.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  {submitting ? "Verifying..." : "Activate Serial"}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Enter the Ed25519-signed serial code generated from your Safehouse Studios subscription account.
              </p>
            </form>
          </div>
        </div>

        {/* Right Col: Quota & Capabilities Matrix */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" /> Unlocked Capabilities
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-muted/20 rounded-xl border border-border">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-foreground">Multi-Business Workspaces</span>
                </div>
                <span className="font-mono font-bold text-primary">
                  {license?.max_businesses === -1 ? "Unlimited" : `${license?.max_businesses || 2} Max`}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-muted/20 rounded-xl border border-border">
                <div className="flex items-center gap-2">
                  <Printer className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-foreground">Bambu 3D Farm Fleet</span>
                </div>
                <span className="font-mono font-bold text-primary">
                  {license?.max_printers === -1 ? "Unlimited" : `${license?.max_printers || 2} Max`}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-muted/20 rounded-xl border border-border">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-blue-400" />
                  <span className="font-semibold text-foreground">Domains & SSL Monitor</span>
                </div>
                <span className="font-mono font-bold text-primary">
                  {license?.max_domains === -1 ? "Unlimited" : `${license?.max_domains || 3} Max`}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-muted/20 rounded-xl border border-border">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-purple-400" />
                  <span className="font-semibold text-foreground">Zero-Trust Credential Vault</span>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>

              <div className="flex items-center justify-between p-2.5 bg-muted/20 rounded-xl border border-border">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-pink-400" />
                  <span className="font-semibold text-foreground">WooCommerce Webhook Sync</span>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
            </div>

            <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl text-[11px] text-muted-foreground space-y-1">
              <p className="font-bold text-foreground">Dual Commercial License</p>
              <p>Self-hostable under Fair-Code Open Source. Commercial serial unlocks unlimited enterprise scale.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
