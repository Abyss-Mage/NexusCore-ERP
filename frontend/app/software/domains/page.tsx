"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { 
  Globe, ShieldCheck, ShieldAlert, AlertTriangle, 
  Plus, Edit2, Trash2, RefreshCw, Receipt, ExternalLink, Server, Search
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast-context";
import { AVAILABLE_CURRENCIES } from "@/lib/currencies";
import { useRouter } from "next/navigation";

interface Client {
  id: number;
  company_name: string;
}

interface ClientDomain {
  id: number;
  client_id: number;
  client?: Client;
  domain_name: string;
  provider?: string;
  domain_expiry_date?: string;
  auto_renew: boolean;
  renewal_price: number;
  last_invoice_date?: string;
  status: string;
  has_ssl: boolean;
  ssl_issuer?: string;
  ssl_expiry_date?: string;
  ssl_status: string;
  a_records?: string;
  mx_records?: string;
  txt_records?: string;
  notes?: string;
  last_checked_at?: string;
  created_at: string;
}

export default function DomainsMonitorPage() {
  const [domains, setDomains] = useState<ClientDomain[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingId, setCheckingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedDNS, setSelectedDNS] = useState<ClientDomain | null>(null);
  const [baseCurrency, setBaseCurrency] = useState("₹");
  const { toast } = useToast();
  const router = useRouter();

  const [formData, setFormData] = useState({
    client_id: "",
    domain_name: "",
    provider: "",
    domain_expiry_date: "",
    auto_renew: true,
    renewal_price: 1500,
    notes: ""
  });

  const fetchData = async () => {
    try {
      const [domRes, clientRes, locRes] = await Promise.all([
        api.get('/software/domains').catch(() => ({ data: { data: [] } })),
        api.get('/clients?limit=500').catch(() => ({ data: { data: [] } })),
        api.get('/settings/LOCALIZATION').catch(() => ({ data: null }))
      ]);

      const rawDom = domRes.data;
      const domList = Array.isArray(rawDom) ? rawDom : (Array.isArray(rawDom?.data) ? rawDom.data : []);
      setDomains(domList);

      const rawClients = clientRes.data;
      const clientList = Array.isArray(rawClients) ? rawClients : (Array.isArray(rawClients?.data) ? rawClients.data : []);
      setClients(clientList);

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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
      client_id: clients[0]?.id ? clients[0].id.toString() : "",
      domain_name: "",
      provider: "Cloudflare",
      domain_expiry_date: "",
      auto_renew: true,
      renewal_price: 1500,
      notes: ""
    });
    setIsOpen(true);
  };

  const handleOpenEdit = (d: ClientDomain) => {
    setEditingId(d.id);
    setFormData({
      client_id: d.client_id.toString(),
      domain_name: d.domain_name,
      provider: d.provider || "",
      domain_expiry_date: d.domain_expiry_date ? d.domain_expiry_date.split("T")[0] : "",
      auto_renew: d.auto_renew,
      renewal_price: d.renewal_price || 1500,
      notes: d.notes || ""
    });
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        client_id: Number(formData.client_id),
        domain_name: formData.domain_name,
        provider: formData.provider || undefined,
        domain_expiry_date: formData.domain_expiry_date || undefined,
        auto_renew: formData.auto_renew,
        renewal_price: Number(formData.renewal_price),
        notes: formData.notes || undefined
      };

      if (editingId) {
        await api.put(`/software/domains/${editingId}`, payload);
        toast("Domain updated", "success");
      } else {
        await api.post('/software/domains', payload);
        toast("Domain added & health check queued", "success");
      }
      setIsOpen(false);
      fetchData();
    } catch (err: any) {
      toast(err.response?.data?.error || err.message || "Failed to save domain", "error");
    }
  };

  const handleCheckSSL = async (id: number) => {
    setCheckingId(id);
    try {
      const res = await api.post(`/software/domains/${id}/check`);
      toast(res.data.message || "Domain checked successfully", "success");
      fetchData();
    } catch (err: any) {
      toast(err.response?.data?.error || "Health check failed", "error");
    } finally {
      setCheckingId(null);
    }
  };

  const handleGenerateInvoice = async (d: ClientDomain) => {
    try {
      const res = await api.post(`/software/domains/${d.id}/invoice`);
      toast(res.data.message || "Renewal invoice generated!", "success");
      router.push('/invoices');
    } catch (err: any) {
      toast(err.response?.data?.error || err.message || "Failed to generate renewal invoice", "error");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to remove this domain from monitoring?")) return;
    try {
      await api.delete(`/software/domains/${id}`);
      toast("Domain removed", "success");
      fetchData();
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to delete domain", "error");
    }
  };

  // KPIs (Safely computed)
  const domainList = Array.isArray(domains) ? domains : [];
  const totalDomains = domainList.length;
  const validSSLCount = domainList.filter(d => d.has_ssl && d.ssl_status === 'VALID').length;
  const expiringSoonCount = domainList.filter(d => {
    let days = 999;
    if (d.ssl_expiry_date) {
      days = Math.min(days, Math.ceil((new Date(d.ssl_expiry_date).getTime() - Date.now()) / (86400000)));
    }
    if (d.domain_expiry_date) {
      days = Math.min(days, Math.ceil((new Date(d.domain_expiry_date).getTime() - Date.now()) / (86400000)));
    }
    return days <= 30 && days >= 0;
  }).length;
  const annualRenewalSum = domainList.reduce((acc, d) => acc + (Number(d.renewal_price) || 0), 0);

  const filteredDomains = domainList.filter(d => 
    (d.domain_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (d.client?.company_name && d.client.company_name.toLowerCase().includes(search.toLowerCase())) ||
    (d.provider && d.provider.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 flex flex-col p-8 min-h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-on-surface flex items-center gap-3">
            <Globe className="h-8 w-8 text-primary" />
            Domains &amp; SSL Auto-Monitor
          </h2>
          <p className="text-muted-foreground mt-1">Real-time TLS handshake monitoring, DNS records, and 30-day proactive auto-renewal billing</p>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={handleOpenAdd}
            className="bg-primary text-primary-foreground font-medium px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm hover:opacity-90 transition-opacity"
          >
            <Plus className="w-5 h-5" /> Add Domain
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Monitored Domains</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">{totalDomains}</span>
            <span className="text-xs text-muted-foreground">Active Assets</span>
          </div>
        </div>

        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">SSL Health</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-emerald-500">{validSSLCount}</span>
            <span className="text-xs text-emerald-600 font-medium">/ {totalDomains} Valid HTTPS</span>
          </div>
        </div>

        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Expiring &lt; 30 Days</span>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold ${expiringSoonCount > 0 ? 'text-amber-500' : 'text-foreground'}`}>
              {expiringSoonCount}
            </span>
            <span className="text-xs text-amber-600 font-medium">Needs Renewal</span>
          </div>
        </div>

        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Annual Renewal Volume</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">{baseCurrency}{annualRenewalSum.toFixed(2)}</span>
            <span className="text-xs text-muted-foreground">Managed / Year</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 bg-card border border-border p-3 rounded-xl">
        <Search className="w-4 h-4 text-muted-foreground ml-1" />
        <input 
          type="text" 
          placeholder="Filter by domain name, client, or registrar provider..." 
          className="bg-transparent text-sm text-foreground outline-none flex-1 placeholder:text-muted-foreground"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Domains Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
              <tr>
                <th className="p-4">Domain &amp; Client</th>
                <th className="p-4">SSL Certificate</th>
                <th className="p-4">Registration Expiry</th>
                <th className="p-4">Annual Renewal</th>
                <th className="p-4">DNS Records</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y border-border">
              {filteredDomains.map((d) => {
                let sslDays = 999;
                if (d.ssl_expiry_date) {
                  sslDays = Math.ceil((new Date(d.ssl_expiry_date).getTime() - Date.now()) / (86400000));
                }

                let domainDays = 999;
                if (d.domain_expiry_date) {
                  domainDays = Math.ceil((new Date(d.domain_expiry_date).getTime() - Date.now()) / (86400000));
                }

                return (
                  <tr key={d.id} className="hover:bg-muted/20 transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                          <Globe className="w-5 h-5" />
                        </div>
                        <div>
                          <a 
                            href={`https://${encodeURIComponent(d.domain_name.trim().replace(/^https?:\/\//i, ''))}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1 text-sm"
                          >
                            {d.domain_name}
                            <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                          </a>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {d.client?.company_name || 'Client #' + d.client_id} • <span className="font-medium text-foreground/70">{d.provider || 'DNS'}</span>
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* SSL Status */}
                    <td className="p-4">
                      {d.has_ssl ? (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            {sslDays <= 0 ? (
                              <span className="text-xs font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <ShieldAlert className="w-3.5 h-3.5" /> Expired
                              </span>
                            ) : sslDays <= 30 ? (
                              <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5" /> {sslDays}d left
                              </span>
                            ) : (
                              <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <ShieldCheck className="w-3.5 h-3.5" /> Valid HTTPS
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {d.ssl_issuer || 'TLS Certificate'} • {d.ssl_expiry_date ? new Date(d.ssl_expiry_date).toLocaleDateString() : ''}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">No SSL Detected</span>
                      )}
                    </td>

                    {/* Domain Expiry */}
                    <td className="p-4 text-xs">
                      {d.domain_expiry_date ? (
                        <div className="space-y-0.5">
                          <div className="font-semibold text-foreground">
                            {new Date(d.domain_expiry_date).toLocaleDateString()}
                          </div>
                          <span className={`text-[11px] font-medium ${
                            domainDays <= 0 ? 'text-rose-500' : domainDays <= 30 ? 'text-amber-500' : 'text-muted-foreground'
                          }`}>
                            {domainDays <= 0 ? 'Expired' : `${domainDays} days remaining`}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Not set</span>
                      )}
                    </td>

                    {/* Renewal Price */}
                    <td className="p-4 text-xs">
                      <div className="font-bold text-foreground">
                        {baseCurrency}{Number(d.renewal_price || 0).toFixed(2)}
                      </div>
                      <span className={`text-[10px] ${d.auto_renew ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                        {d.auto_renew ? '● Auto-Billing Active' : 'Manual Billing'}
                      </span>
                    </td>

                    {/* DNS Records */}
                    <td className="p-4">
                      <button
                        onClick={() => setSelectedDNS(d)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-secondary hover:bg-muted text-foreground transition-colors flex items-center gap-1.5 font-medium"
                      >
                        <Server className="w-3.5 h-3.5 text-primary" /> View DNS
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleCheckSSL(d.id)}
                          disabled={checkingId === d.id}
                          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                          title="Re-check SSL & DNS Handshake"
                        >
                          <RefreshCw className={`w-4 h-4 ${checkingId === d.id ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                          onClick={() => handleGenerateInvoice(d)}
                          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-emerald-500 transition-colors"
                          title="Generate Renewal Invoice"
                        >
                          <Receipt className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(d)}
                          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                          title="Edit Domain"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(d.id)}
                          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                          title="Delete Domain"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!loading && filteredDomains.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Globe className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-1">No domains found</h3>
            <p className="text-sm text-muted-foreground mb-4">Click "Add Domain" to begin monitoring client websites and SSL certificates.</p>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Monitored Domain" : "Add Domain to Monitor"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Client Account</Label>
              <select
                required
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none"
                value={formData.client_id}
                onChange={e => setFormData({ ...formData, client_id: e.target.value })}
              >
                <option value="" disabled>Select Client</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id.toString()}>{c.company_name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Domain Name</Label>
              <input
                required
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none"
                placeholder="e.g. clientapp.com or api.saas.io"
                value={formData.domain_name}
                onChange={e => setFormData({ ...formData, domain_name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Provider / Registrar</Label>
                <input
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none"
                  placeholder="e.g. Cloudflare, Namecheap"
                  value={formData.provider}
                  onChange={e => setFormData({ ...formData, provider: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Registration Expiry</Label>
                <input
                  type="date"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none"
                  value={formData.domain_expiry_date}
                  onChange={e => setFormData({ ...formData, domain_expiry_date: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Annual Renewal Price ({baseCurrency})</Label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none"
                  value={formData.renewal_price}
                  onChange={e => setFormData({ ...formData, renewal_price: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5 flex flex-col justify-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    className="rounded border-border"
                    checked={formData.auto_renew}
                    onChange={e => setFormData({ ...formData, auto_renew: e.target.checked })}
                  />
                  <span>Auto-generate renewal invoice 30d prior</span>
                </label>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Notes / Server Details (Optional)</Label>
              <textarea
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none"
                placeholder="Nameservers, hosting provider, IP allocations..."
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <button type="submit" className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition-opacity mt-4">
              {editingId ? "Update Domain" : "Register & Run Health Check"}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      {/* DNS Records Modal */}
      <Dialog open={!!selectedDNS} onOpenChange={(open) => { if (!open) setSelectedDNS(null); }}>
        <DialogContent className="bg-card border-border text-foreground max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Server className="w-5 h-5 text-primary" /> Live DNS Records: {selectedDNS?.domain_name}
            </DialogTitle>
          </DialogHeader>
          {selectedDNS && (
            <div className="space-y-4 pt-2 text-xs">
              <div className="space-y-1">
                <Label className="text-muted-foreground font-bold">A Records (IP Addresses):</Label>
                <div className="p-2.5 bg-muted/40 rounded-lg font-mono text-foreground border border-border">
                  {selectedDNS.a_records || "No A records resolved"}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-muted-foreground font-bold">MX Records (Mail Routing):</Label>
                <div className="p-2.5 bg-muted/40 rounded-lg font-mono text-foreground border border-border">
                  {selectedDNS.mx_records || "No MX records found"}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-muted-foreground font-bold">TXT Records (SPF / DKIM / Verification):</Label>
                <div className="p-2.5 bg-muted/40 rounded-lg font-mono text-foreground border border-border max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {selectedDNS.txt_records || "No TXT records found"}
                </div>
              </div>

              <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-2 border-t border-border">
                <span>Last checked: {selectedDNS.last_checked_at ? new Date(selectedDNS.last_checked_at).toLocaleString() : 'Never'}</span>
                <button
                  onClick={() => {
                    const id = selectedDNS.id;
                    setSelectedDNS(null);
                    handleCheckSSL(id);
                  }}
                  className="text-primary hover:underline font-semibold"
                >
                  Force Re-Query Now
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
