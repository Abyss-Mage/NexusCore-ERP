"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { 
  Plus, Edit2, Trash2, Printer as PrinterIcon, Receipt, Clock, 
  Scale, Layers, CheckCircle2, Play, Sparkles, AlertCircle, ArrowRight, User
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast-context";
import { PrintJob, Printer, Filament } from "@/types/print";
import { AVAILABLE_CURRENCIES } from "@/lib/currencies";

interface Client {
  id: number;
  company_name: string;
  name?: string;
}

const COLUMNS = [
  { id: "Pending", label: "Queue / Pending", color: "amber" },
  { id: "Printing", label: "In Production", color: "blue" },
  { id: "Done", label: "Completed", color: "emerald" },
];

export default function KanbanBoard() {
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<PrintJob | null>(null);
  const [baseCurrency, setBaseCurrency] = useState("₹");
  const { toast } = useToast();
  const router = useRouter();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    printer_id: "",
    filament_id: "",
    client_id: "",
    estimated_time_hours: 1,
    filament_weight_grams: 50,
    status: "Pending"
  });

  const fetchData = async () => {
    try {
      const [jobsRes, pRes, fRes, cRes, locRes] = await Promise.all([
        api.get('/software/print-jobs'),
        api.get('/software/printers'),
        api.get('/software/filaments'),
        api.get('/clients?limit=100').catch(() => ({ data: { data: [] } })),
        api.get('/settings/LOCALIZATION').catch(() => ({ data: null }))
      ]);
      setJobs(jobsRes.data || []);
      setPrinters(pRes.data || []);
      setFilaments(fRes.data || []);
      setClients(cRes.data?.data || cRes.data || []);

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
      console.error("Failed to fetch Kanban data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenAdd = () => {
    setEditingJob(null);
    setFormData({
      title: "",
      description: "",
      printer_id: printers[0]?.id ? printers[0].id.toString() : "",
      filament_id: filaments[0]?.id ? filaments[0].id.toString() : "",
      client_id: "",
      estimated_time_hours: 1.5,
      filament_weight_grams: 75,
      status: "Pending"
    });
    setIsOpen(true);
  };

  const handleOpenEdit = (job: PrintJob) => {
    setEditingJob(job);
    setFormData({
      title: job.title,
      description: job.description || "",
      printer_id: job.printer_id ? job.printer_id.toString() : "",
      filament_id: job.filament_id ? job.filament_id.toString() : "",
      client_id: job.client_id ? job.client_id.toString() : "",
      estimated_time_hours: job.estimated_time_hours || 0,
      filament_weight_grams: job.filament_weight_grams || 0,
      status: job.status
    });
    setIsOpen(true);
  };

  // Live Cost Calculation in Modal
  const selectedPrinter = printers.find(p => p.id.toString() === formData.printer_id);
  const selectedFilament = filaments.find(f => f.id.toString() === formData.filament_id);
  const machineCost = (formData.estimated_time_hours || 0) * (selectedPrinter?.hourly_rate || 0);
  const materialCost = (formData.filament_weight_grams || 0) * (selectedFilament?.cost_per_gram || 0);
  const calculatedTotal = machineCost + materialCost;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        title: formData.title,
        description: formData.description || null,
        printer_id: formData.printer_id ? Number(formData.printer_id) : null,
        filament_id: formData.filament_id ? Number(formData.filament_id) : null,
        client_id: (formData.client_id && formData.client_id !== "0") ? Number(formData.client_id) : null,
        estimated_time_hours: Number(formData.estimated_time_hours),
        filament_weight_grams: Number(formData.filament_weight_grams),
        status: formData.status
      };

      if (editingJob) {
        await api.put(`/software/print-jobs/${editingJob.id}`, payload);
        toast("Print job updated", "success");
      } else {
        await api.post('/software/print-jobs', payload);
        toast("Print job scheduled", "success");
      }

      setIsOpen(false);
      fetchData();
    } catch (err: any) {
      toast(err.response?.data?.error || err.message || "Failed to save print job", "error");
    }
  };

  const handleDragStart = (e: React.DragEvent, jobId: number) => {
    e.dataTransfer.setData("jobId", jobId.toString());
  };

  const handleDrop = async (e: React.DragEvent, status: string) => {
    e.preventDefault();
    const jobIdStr = e.dataTransfer.getData("jobId");
    if (!jobIdStr) return;
    const jobId = Number(jobIdStr);

    const targetJob = jobs.find(j => j.id === jobId);
    if (!targetJob || targetJob.status === status) return;

    try {
      // Optimistic update
      setJobs(jobs.map(j => j.id === jobId ? { ...j, status } : j));
      await api.patch(`/software/print-jobs/${jobId}/status`, { status });

      if (status === "Done") {
        toast(`Print job completed! Deducted ${targetJob.filament_weight_grams}g from inventory.`, "success");
      } else {
        toast(`Job moved to ${status}`, "info");
      }
      fetchData();
    } catch (err: any) {
      fetchData();
      toast(err.response?.data?.error || "Failed to move job", "error");
    }
  };

  const handleMoveStatus = async (job: PrintJob, newStatus: string) => {
    try {
      setJobs(jobs.map(j => j.id === job.id ? { ...j, status: newStatus } : j));
      await api.patch(`/software/print-jobs/${job.id}/status`, { status: newStatus });
      if (newStatus === "Done") {
        toast(`Print completed! Deducted ${job.filament_weight_grams}g filament from spool.`, "success");
      } else {
        toast(`Job moved to ${newStatus}`, "info");
      }
      fetchData();
    } catch (err: any) {
      fetchData();
      toast(err.response?.data?.error || "Failed to update status", "error");
    }
  };

  const handleGenerateInvoice = async (job: PrintJob) => {
    if (!job.client_id) {
      toast("Please attach a Client to this job before invoicing", "error");
      return;
    }
    try {
      const bankRes = await api.get('/banks?limit=200').catch(() => ({ data: { data: [] } }));
      const banks = bankRes.data?.data || bankRes.data || [];
      const bankId = banks.length > 0 ? banks[0].id : null;

      const payload = {
        client_id: job.client_id,
        bank_account_id: bankId,
        issue_date: new Date().toISOString(),
        due_date: new Date(Date.now() + 15 * 86400000).toISOString(),
        category: "3D Printing",
        line_items: [
          {
            description: `3D Printing Service: ${job.title} (${job.estimated_time_hours}h machine time)`,
            quantity: 1,
            rate: job.total_cost || 0,
            amount: job.total_cost || 0
          }
        ],
        subtotal: job.total_cost || 0,
        grand_total: job.total_cost || 0,
        currency: "INR",
        is_manual_entry: false
      };

      const res = await api.post('/invoices', payload);
      toast(`Invoice #${res.data?.invoice_number || 'draft'} generated successfully!`, "success");
      router.push('/invoices');
    } catch (err: any) {
      toast(err.response?.data?.error || err.message || "Failed to generate invoice", "error");
    }
  };

  const handleDeleteJob = async (jobId: number) => {
    if (!confirm("Are you sure you want to delete this print job?")) return;
    try {
      await api.delete(`/software/print-jobs/${jobId}`);
      toast("Print job removed", "success");
      fetchData();
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to delete job", "error");
    }
  };

  // KPIs
  const activePrintJobs = jobs.filter(j => j.status === 'Printing').length;
  const queueSize = jobs.filter(j => j.status === 'Pending').length;
  const completedJobs = jobs.filter(j => j.status === 'Done').length;
  const totalFarmRevenue = jobs.filter(j => j.status === 'Done').reduce((acc, j) => acc + (j.total_cost || 0), 0);

  return (
    <div className="space-y-6 flex flex-col p-8 min-h-[calc(100vh-64px)]">
      {/* Header & Global Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-on-surface flex items-center gap-3">
            <Layers className="h-8 w-8 text-primary" />
            Print Kanban &amp; Production
          </h2>
          <p className="text-muted-foreground mt-1">Live farm workflow, Bambu printer dispatching, and automated filament inventory deduction</p>
        </div>

        <div className="flex gap-3">
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <button 
                className="bg-primary text-primary-foreground font-medium px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm hover:opacity-90 transition-opacity"
                onClick={handleOpenAdd}
              >
                <Plus className="w-5 h-5" />
                New Print Job
              </button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border text-foreground max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingJob ? "Edit Print Job" : "Schedule New Print Job"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                {/* Title & Description */}
                <div className="space-y-2">
                  <Label>Job Title / Part Name</Label>
                  <input 
                    required 
                    className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary outline-none text-sm" 
                    placeholder="e.g. Drone Frame Mount v2.1"
                    value={formData.title} 
                    onChange={e => setFormData({ ...formData, title: e.target.value })} 
                  />
                </div>

                {/* Client Link (Optional) */}
                <div className="space-y-2">
                  <Label>Client (Optional for Invoicing)</Label>
                  <select 
                    className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary outline-none text-sm" 
                    value={formData.client_id} 
                    onChange={e => setFormData({ ...formData, client_id: e.target.value })}
                  >
                    <option value="">-- Internal / No Client --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id.toString()}>{c.company_name || c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Hardware & Material Dispatch */}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                  <div className="space-y-2">
                    <Label>Assign Printer</Label>
                    <select 
                      className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary outline-none text-sm" 
                      value={formData.printer_id} 
                      onChange={e => setFormData({ ...formData, printer_id: e.target.value })}
                    >
                      <option value="">-- Unassigned --</option>
                      {printers.map(p => (
                        <option key={p.id} value={p.id.toString()}>
                          {p.name} ({baseCurrency}{p.hourly_rate}/hr)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Filament Spool</Label>
                    <select 
                      className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary outline-none text-sm" 
                      value={formData.filament_id} 
                      onChange={e => setFormData({ ...formData, filament_id: e.target.value })}
                    >
                      <option value="">-- Select Material --</option>
                      {filaments.map(f => (
                        <option key={f.id} value={f.id.toString()}>
                          {f.brand} {f.material_type} ({f.color}) • {f.remaining_weight_grams}g left
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Print Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Estimated Time (Hours)</Label>
                    <input 
                      required 
                      type="number" 
                      step="0.1" 
                      className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary outline-none text-sm font-mono" 
                      value={formData.estimated_time_hours} 
                      onChange={e => setFormData({ ...formData, estimated_time_hours: Number(e.target.value) })} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Filament Weight (Grams)</Label>
                    <input 
                      required 
                      type="number" 
                      step="1" 
                      className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:border-primary outline-none text-sm font-mono" 
                      value={formData.filament_weight_grams} 
                      onChange={e => setFormData({ ...formData, filament_weight_grams: Number(e.target.value) })} 
                    />
                  </div>
                </div>

                {/* Real-Time Cost Calculation Preview */}
                <div className="p-3 bg-muted/40 rounded-xl border border-border/80 flex justify-between items-center text-xs">
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground">Calculated Cost Breakdown</span>
                    <div className="text-[11px] text-muted-foreground">
                      Time: {baseCurrency}{machineCost.toFixed(2)} + Material: {baseCurrency}{materialCost.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-primary">{baseCurrency}{calculatedTotal.toFixed(2)}</span>
                  </div>
                </div>

                <button type="submit" className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition-opacity mt-4">
                  {editingJob ? "Update Print Job" : "Add to Kanban Queue"}
                </button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active In Production</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-blue-500">{activePrintJobs}</span>
            <span className="text-xs text-muted-foreground">/ {printers.length} Printers</span>
          </div>
        </div>

        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Queue Size</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-amber-500">{queueSize}</span>
            <span className="text-xs text-muted-foreground">Pending Jobs</span>
          </div>
        </div>

        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Completed Jobs</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-emerald-500">{completedJobs}</span>
            <span className="text-xs text-muted-foreground">Finished</span>
          </div>
        </div>

        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Completed Value</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">{baseCurrency}{totalFarmRevenue.toFixed(2)}</span>
            <span className="text-xs text-muted-foreground">Produced</span>
          </div>
        </div>
      </div>

      {/* Kanban Board Columns */}
      <div className="flex-1 flex gap-6 overflow-x-auto pb-4 pt-2">
        {COLUMNS.map((col) => {
          const colJobs = jobs.filter(j => j.status === col.id);

          return (
            <div 
              key={col.id} 
              className="min-w-[340px] w-[340px] flex flex-col gap-4 bg-muted/20 rounded-2xl p-4 border border-border/60 shrink-0"
              onDrop={(e) => handleDrop(e, col.id)}
              onDragOver={(e) => e.preventDefault()}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    col.id === "Printing" ? "bg-blue-500 animate-pulse" : col.id === "Done" ? "bg-emerald-500" : "bg-amber-500"
                  }`} />
                  <h3 className="font-bold text-foreground text-base">{col.label}</h3>
                </div>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                  {colJobs.length}
                </span>
              </div>

              {/* Cards Container */}
              <div className="flex-1 overflow-y-auto flex flex-col gap-3 min-h-[400px]">
                {colJobs.map((job) => {
                  const assignedPrinter = printers.find(p => p.id === job.printer_id) || job.printer;
                  const assignedFilament = filaments.find(f => f.id === job.filament_id) || job.filament;
                  const client = clients.find(c => c.id === job.client_id) || job.client;

                  return (
                    <div 
                      key={job.id} 
                      draggable 
                      onDragStart={(e) => handleDragStart(e, job.id)}
                      className={`bg-card rounded-xl border p-4 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing flex flex-col justify-between gap-3 group relative overflow-hidden ${
                        col.id === "Printing" ? "border-blue-500/50 bg-blue-500/[0.02]" : "border-border"
                      }`}
                    >
                      {/* Top Row: Title, Client & Actions */}
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors truncate">{job.title}</h4>
                            {client ? (
                              <p className="text-xs text-primary font-medium flex items-center gap-1 mt-0.5">
                                <User className="w-3 h-3" /> {client.company_name || client.name}
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground mt-0.5">Internal Job</p>
                            )}
                          </div>

                          <div className="flex gap-1 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleOpenEdit(job)}
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary"
                              title="Edit Job"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleDeleteJob(job.id)}
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
                              title="Delete Job"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Printer & Spool Tags */}
                        <div className="space-y-1.5 mt-3 pt-2.5 border-t border-border text-xs">
                          {/* Printer Badge */}
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-1.5">
                              <PrinterIcon className="w-3.5 h-3.5 text-primary" />
                              {assignedPrinter ? assignedPrinter.name : "Unassigned"}
                            </span>
                            {assignedPrinter?.status === "Printing" && col.id === "Printing" && (
                              <span className="text-[10px] text-blue-400 font-medium">
                                {assignedPrinter.progress || 0}%
                              </span>
                            )}
                          </div>

                          {/* Filament Spool Info */}
                          {assignedFilament ? (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground flex items-center gap-1.5">
                                <span 
                                  className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0" 
                                  style={{ backgroundColor: assignedFilament.color_hex || "#3B82F6" }} 
                                />
                                {assignedFilament.color} ({assignedFilament.material_type})
                              </span>
                              <span className="text-foreground font-semibold">{job.filament_weight_grams}g</span>
                            </div>
                          ) : (
                            <div className="text-muted-foreground text-[11px]">No filament assigned ({job.filament_weight_grams}g)</div>
                          )}

                          {/* Time & Total Cost */}
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" /> {job.estimated_time_hours}h
                            </span>
                            <span className="font-bold text-foreground text-sm">
                              {baseCurrency}{Number(job.total_cost || 0).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Column-Specific Quick Actions */}
                      <div className="pt-2 border-t border-border flex items-center gap-2">
                        {col.id === "Pending" && (
                          <button
                            onClick={() => handleMoveStatus(job, "Printing")}
                            className="w-full py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Play className="w-3.5 h-3.5" /> Start Print
                          </button>
                        )}

                        {col.id === "Printing" && (
                          <button
                            onClick={() => handleMoveStatus(job, "Done")}
                            className="w-full py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Complete &amp; Deduct Spool
                          </button>
                        )}

                        {col.id === "Done" && (
                          <button
                            onClick={() => handleGenerateInvoice(job)}
                            className="w-full py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Receipt className="w-3.5 h-3.5" /> Generate Invoice
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {colJobs.length === 0 && (
                  <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-dashed border-border/50 text-center text-xs text-muted-foreground">
                    <span>No jobs in {col.label.toLowerCase()}</span>
                    <span className="text-[11px] mt-0.5">Drag cards here or create new</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

