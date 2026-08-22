"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast-context";
import { AVAILABLE_CURRENCIES } from "@/lib/currencies";
import { 
  Printer, Plus, Edit2, Trash2, CheckCircle2, Wrench, PowerOff, 
  Printer as PrinterIcon, Flame, Thermometer, Layers, Clock, FileCode, RefreshCw, Cloud, Wifi
} from "lucide-react";

export interface PrinterItem {
  id: number;
  name: string;
  make: string;
  connection_type?: string;
  cloud_region?: string;
  cloud_token?: string;
  ip_address?: string;
  serial_number?: string;
  access_code?: string;
  status: "Active" | "Printing" | "Paused" | "Maintenance" | "Offline" | "Error" | string;
  current_job?: string;
  progress?: number;
  nozzle_temp?: number;
  nozzle_target_temp?: number;
  bed_temp?: number;
  bed_target_temp?: number;
  layer_num?: number;
  total_layers?: number;
  remaining_minutes?: number;
  hourly_rate: number;
  last_seen?: string;
}

export default function PrintersPage() {
  const [printers, setPrinters] = useState<PrinterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    make: "Bambu Lab X1-Carbon",
    connection_type: "cloud",
    cloud_region: "us",
    cloud_token: "",
    serial_number: "",
    ip_address: "",
    access_code: "",
    status: "Active",
    hourly_rate: 0
  });

  const [baseCurrency, setBaseCurrency] = useState("₹");

  const fetchPrinters = async () => {
    try {
      const [res, locRes] = await Promise.all([
        api.get('/software/printers'),
        api.get('/settings/LOCALIZATION').catch(() => ({ data: null }))
      ]);
      setPrinters(Array.isArray(res.data) ? res.data : []);
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
      console.error("Failed to fetch printers", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrinters();
    // Poll telemetry every 4 seconds for real-time dashboard feel
    const interval = setInterval(fetchPrinters, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenEdit = (printer: PrinterItem) => {
    setFormData({
      name: printer.name,
      make: printer.make,
      connection_type: printer.connection_type || "cloud",
      cloud_region: printer.cloud_region || "us",
      cloud_token: printer.cloud_token || "",
      serial_number: printer.serial_number || "",
      ip_address: printer.ip_address || "",
      access_code: printer.access_code || "",
      status: printer.status,
      hourly_rate: printer.hourly_rate
    });
    setEditingId(printer.id);
    setIsOpen(true);
  };

  const handleOpenAdd = () => {
    setFormData({
      name: "",
      make: "Bambu Lab X1-Carbon",
      connection_type: "cloud",
      cloud_region: "us",
      cloud_token: "",
      serial_number: "",
      ip_address: "",
      access_code: "",
      status: "Active",
      hourly_rate: 0
    });
    setEditingId(null);
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        hourly_rate: Number(formData.hourly_rate)
      };

      if (editingId) {
        await api.put(`/software/printers/${editingId}`, payload);
        toast("Printer and Bambu MQTT connection updated", "success");
      } else {
        await api.post('/software/printers', payload);
        toast("Printer added & connecting via Bambu Cloud...", "success");
      }
      setIsOpen(false);
      fetchPrinters();
    } catch (err: any) {
      toast(err.response?.data?.error || err.message || "Failed to save printer", "error");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this printer?")) return;
    try {
      await api.delete(`/software/printers/${id}`);
      fetchPrinters();
      toast("Printer removed", "success");
    } catch (err: any) {
      toast(err.response?.data?.error || err.message || "Failed to delete printer", "error");
    }
  };

  const handleSync = async (id: number) => {
    setSyncingId(id);
    try {
      await api.post(`/software/printers/${id}/sync`);
      toast("Bambu MQTT synchronization triggered", "info");
      await fetchPrinters();
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to sync", "error");
    } finally {
      setTimeout(() => setSyncingId(null), 1000);
    }
  };

  const formatRemainingTime = (minutes?: number) => {
    if (!minutes || minutes <= 0) return null;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m} min`;
  };

  return (
    <div className="space-y-6 flex flex-col p-8 min-h-[calc(100vh-64px)]">
      {/* Header & Global Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-on-surface flex items-center gap-3">
            <PrinterIcon className="h-8 w-8 text-primary" />
            Bambu Lab Print Fleet
          </h2>
          <p className="text-muted-foreground mt-1">Real-time Bambu Cloud telemetry, live temperatures, progress, and billing rates</p>
        </div>
        <div className="flex gap-3">
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <button 
                className="bg-primary text-primary-foreground font-medium px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm hover:opacity-90 transition-opacity" 
                onClick={handleOpenAdd}
              >
                <Plus className="w-5 h-5" />
                Add Bambu Printer
              </button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border text-foreground max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Bambu Printer" : "Add Bambu Printer"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Printer Name</Label>
                    <input 
                      required 
                      className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary outline-none text-sm" 
                      placeholder="e.g. X1-Carbon Workshop"
                      value={formData.name} 
                      onChange={e => setFormData({ ...formData, name: e.target.value })} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Model</Label>
                    <select 
                      className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary outline-none text-sm" 
                      value={formData.make} 
                      onChange={e => setFormData({ ...formData, make: e.target.value })}
                    >
                      <option value="Bambu Lab X1-Carbon">Bambu Lab X1-Carbon</option>
                      <option value="Bambu Lab X1E">Bambu Lab X1E</option>
                      <option value="Bambu Lab P1S">Bambu Lab P1S</option>
                      <option value="Bambu Lab P1P">Bambu Lab P1P</option>
                      <option value="Bambu Lab A1">Bambu Lab A1</option>
                      <option value="Bambu Lab A1 mini">Bambu Lab A1 mini</option>
                      <option value="Custom 3D Printer">Other 3D Printer</option>
                    </select>
                  </div>
                </div>

                {/* Connection Mode Toggle */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <Label>Connection Mode</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, connection_type: "cloud" })}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-sm font-medium transition-colors ${
                        formData.connection_type === "cloud"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      <Cloud className="w-4 h-4" />
                      Bambu Cloud (Anywhere)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, connection_type: "lan" })}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-sm font-medium transition-colors ${
                        formData.connection_type === "lan"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      <Wifi className="w-4 h-4" />
                      LAN Mode / Tailscale
                    </button>
                  </div>
                </div>

                {/* Bambu Cloud Specific Inputs */}
                {formData.connection_type === "cloud" ? (
                  <div className="space-y-3 p-3 bg-muted/40 rounded-lg border border-border">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Cloud Region</Label>
                        <select 
                          className="w-full px-3 py-1.5 rounded-md bg-background border border-border text-sm outline-none" 
                          value={formData.cloud_region} 
                          onChange={e => setFormData({ ...formData, cloud_region: e.target.value })}
                        >
                          <option value="us">United States / Global (US)</option>
                          <option value="eu">Europe (EU)</option>
                          <option value="cn">China (CN)</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Printer Serial Number</Label>
                        <input 
                          required 
                          className="w-full px-3 py-1.5 rounded-md bg-background border border-border text-sm outline-none font-mono" 
                          placeholder="e.g. 01P00A123456789"
                          value={formData.serial_number} 
                          onChange={e => setFormData({ ...formData, serial_number: e.target.value.trim() })} 
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Bambu Account Token / Password</Label>
                      <input 
                        required 
                        type="password"
                        className="w-full px-3 py-1.5 rounded-md bg-background border border-border text-sm outline-none font-mono" 
                        placeholder="Paste your Bambu Cloud access token"
                        value={formData.cloud_token} 
                        onChange={e => setFormData({ ...formData, cloud_token: e.target.value.trim() })} 
                      />
                      <p className="text-[11px] text-muted-foreground">Found in Bambu Studio or Bambu Handy login credentials.</p>
                    </div>
                  </div>
                ) : (
                  /* LAN Mode Specific Inputs */
                  <div className="space-y-3 p-3 bg-muted/40 rounded-lg border border-border">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Printer IP Address</Label>
                        <input 
                          required 
                          className="w-full px-3 py-1.5 rounded-md bg-background border border-border text-sm outline-none font-mono" 
                          placeholder="192.168.1.150 or VPN IP"
                          value={formData.ip_address} 
                          onChange={e => setFormData({ ...formData, ip_address: e.target.value.trim() })} 
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Serial Number</Label>
                        <input 
                          required 
                          className="w-full px-3 py-1.5 rounded-md bg-background border border-border text-sm outline-none font-mono" 
                          placeholder="01P00A123456789"
                          value={formData.serial_number} 
                          onChange={e => setFormData({ ...formData, serial_number: e.target.value.trim() })} 
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">LAN Access Code</Label>
                      <input 
                        required 
                        type="password"
                        maxLength={8}
                        className="w-full px-3 py-1.5 rounded-md bg-background border border-border text-sm outline-none font-mono" 
                        placeholder="8-digit code from screen"
                        value={formData.access_code} 
                        onChange={e => setFormData({ ...formData, access_code: e.target.value.trim() })} 
                      />
                    </div>
                  </div>
                )}

                {/* Rates & Status */}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                  <div className="space-y-2">
                    <Label>Hourly Rate ({baseCurrency})</Label>
                    <input 
                      required 
                      type="number" 
                      step="0.01" 
                      className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary outline-none text-sm" 
                      value={formData.hourly_rate} 
                      onChange={e => setFormData({ ...formData, hourly_rate: Number(e.target.value) })} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status Override</Label>
                    <select 
                      className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary outline-none text-sm" 
                      value={formData.status} 
                      onChange={e => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="Active">Active / Ready</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Offline">Offline</option>
                    </select>
                  </div>
                </div>

                <button type="submit" className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition-opacity mt-4">
                  {editingId ? "Update & Reconnect" : "Connect Bambu Printer"}
                </button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Bambu Fleet</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">{printers.length}</span>
            <span className="text-xs text-muted-foreground">Printers</span>
          </div>
        </div>

        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active &amp; Printing</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-emerald-500">
              {printers.filter(p => p.status === 'Active' || p.status === 'Printing').length}
            </span>
            <span className="text-xs text-emerald-600 font-medium">Online</span>
          </div>
        </div>

        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Currently Printing</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-blue-500">
              {printers.filter(p => p.status === 'Printing').length}
            </span>
            <span className="text-xs text-blue-600 font-medium">Jobs Active</span>
          </div>
        </div>

        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avg Billing Rate</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">
              {baseCurrency}{printers.length ? (printers.reduce((acc, p) => acc + p.hourly_rate, 0) / printers.length).toFixed(2) : '0.00'}
            </span>
            <span className="text-xs text-muted-foreground">/hr</span>
          </div>
        </div>
      </div>

      {/* Fleet Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 mt-2">
        {printers.map((printer) => {
          const isPrinting = printer.status === "Printing";
          const isOffline = printer.status === "Offline";
          const isMaintenance = printer.status === "Maintenance";

          let statusBadge = (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Online / Idle
            </span>
          );

          if (isPrinting) {
            statusBadge = (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 bg-blue-500/15 px-2.5 py-1 rounded-full">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                Printing
              </span>
            );
          } else if (isMaintenance) {
            statusBadge = (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full">
                <Wrench className="w-3.5 h-3.5" />
                Maintenance
              </span>
            );
          } else if (isOffline) {
            statusBadge = (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-500 bg-rose-500/10 px-2.5 py-1 rounded-full">
                <PowerOff className="w-3.5 h-3.5" />
                Offline
              </span>
            );
          }

          return (
            <div key={printer.id} className="bg-card rounded-2xl border border-border p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-5 relative group overflow-hidden">
              {/* Top Row: Name, Make & Actions */}
              <div>
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                      {printer.name}
                      {printer.connection_type === "cloud" ? (
                        <span title="Connected via Bambu Cloud" className="text-xs font-normal text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Cloud className="w-3 h-3 text-primary" /> Cloud
                        </span>
                      ) : (
                        <span title="Connected via Local LAN" className="text-xs font-normal text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Wifi className="w-3 h-3 text-primary" /> LAN
                        </span>
                      )}
                    </h3>
                    <p className="text-xs font-medium text-muted-foreground mt-1">{printer.make} • {printer.serial_number || "No Serial"}</p>
                  </div>

                  <div className="flex gap-1 items-center">
                    <button 
                      onClick={() => handleSync(printer.id)} 
                      className={`p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-all ${syncingId === printer.id ? "animate-spin text-primary" : ""}`}
                      title="Sync Bambu Telemetry"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleOpenEdit(printer)} 
                      className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                      title="Edit Printer"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(printer.id)} 
                      className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete Printer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Print Progress Bar */}
                <div className="mt-5 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                      <FileCode className="w-3.5 h-3.5 text-primary" />
                      {printer.current_job || (isPrinting ? "Active Print Job" : "No active job")}
                    </span>
                    <span className="font-bold text-foreground text-sm">{printer.progress || 0}%</span>
                  </div>
                  <div className="w-full bg-secondary/60 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className={`h-2.5 rounded-full transition-all duration-700 ${
                        isPrinting ? "bg-primary shadow-[0_0_10px_rgba(78,222,163,0.5)]" : "bg-muted-foreground/30"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, printer.progress || 0))}%` }}
                    />
                  </div>
                </div>

                {/* Telemetry Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 p-3 bg-muted/30 rounded-xl border border-border/50 text-xs">
                  {/* Nozzle Temp */}
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Flame className="w-3 h-3 text-rose-400" /> Nozzle
                    </span>
                    <span className="font-semibold text-foreground">
                      {printer.nozzle_temp ? `${Math.round(printer.nozzle_temp)}°C` : "—"}
                    </span>
                  </div>

                  {/* Bed Temp */}
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Thermometer className="w-3 h-3 text-amber-400" /> Bed
                    </span>
                    <span className="font-semibold text-foreground">
                      {printer.bed_temp ? `${Math.round(printer.bed_temp)}°C` : "—"}
                    </span>
                  </div>

                  {/* Layers */}
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Layers className="w-3 h-3 text-blue-400" /> Layer
                    </span>
                    <span className="font-semibold text-foreground">
                      {printer.total_layers ? `${printer.layer_num || 0}/${printer.total_layers}` : "—"}
                    </span>
                  </div>

                  {/* Remaining Time */}
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3 text-primary" /> Remaining
                    </span>
                    <span className="font-semibold text-foreground">
                      {formatRemainingTime(printer.remaining_minutes) || "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Footer: Status & Hourly Rate */}
              <div className="pt-4 border-t border-border flex justify-between items-center">
                {statusBadge}
                <div className="text-right">
                  <span className="text-lg font-bold text-foreground">{baseCurrency}{printer.hourly_rate}</span>
                  <span className="text-xs text-muted-foreground">/hr</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!loading && printers.length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 bg-card rounded-2xl border border-dashed border-border mt-4 text-center">
          <PrinterIcon className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-xl font-semibold mb-2">No Bambu Printers Connected</h3>
          <p className="text-muted-foreground mb-6 max-w-md text-sm">
            Click "Add Bambu Printer" above to link your Bambu Lab 3D printers via Bambu Cloud Token or LAN Mode for real-time telemetry.
          </p>
        </div>
      )}
    </div>
  );
}


