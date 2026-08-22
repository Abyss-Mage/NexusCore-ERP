"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { 
  FolderGit2, CheckCircle2, Clock, Plus, Edit2, Trash2, 
  Receipt, ArrowRight, Calendar, DollarSign, Layers, Search
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast-context";
import { AVAILABLE_CURRENCIES } from "@/lib/currencies";
import { useRouter } from "next/navigation";

interface Client {
  id: number;
  company_name: string;
}

interface ProjectMilestone {
  id: number;
  project_id: number;
  title: string;
  description?: string;
  amount: number;
  percentage: number;
  due_date?: string;
  status: string;
  invoice_id?: number;
  created_at: string;
}

interface SoftwareProject {
  id: number;
  client_id: number;
  client?: Client;
  name: string;
  description?: string;
  total_budget: number;
  currency: string;
  status: string;
  start_date?: string;
  deadline?: string;
  milestones?: ProjectMilestone[];
  created_at: string;
}

export default function ProjectMilestonesPage() {
  const [projects, setProjects] = useState<SoftwareProject[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("₹");
  const { toast } = useToast();
  const router = useRouter();

  // Project Modal
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [projectForm, setProjectForm] = useState({
    client_id: "",
    name: "",
    description: "",
    total_budget: 100000,
    currency: "INR",
    status: "IN_PROGRESS",
    start_date: "",
    deadline: ""
  });

  // Milestone Modal
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [editingMilestoneId, setEditingMilestoneId] = useState<number | null>(null);
  const [milestoneForm, setMilestoneForm] = useState({
    title: "",
    description: "",
    amount: 25000,
    percentage: 25,
    due_date: "",
    status: "PENDING"
  });

  const fetchData = async () => {
    try {
      const [projRes, clientRes, locRes] = await Promise.all([
        api.get('/software/projects').catch(() => ({ data: { data: [] } })),
        api.get('/clients?limit=500').catch(() => ({ data: { data: [] } })),
        api.get('/settings/LOCALIZATION').catch(() => ({ data: null }))
      ]);

      const rawProj = projRes.data;
      const projList = Array.isArray(rawProj) ? rawProj : (Array.isArray(rawProj?.data) ? rawProj.data : []);
      setProjects(projList);

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

  const handleOpenAddProject = () => {
    setEditingProjectId(null);
    setProjectForm({
      client_id: clients[0]?.id ? clients[0].id.toString() : "",
      name: "",
      description: "",
      total_budget: 100000,
      currency: "INR",
      status: "IN_PROGRESS",
      start_date: new Date().toISOString().split("T")[0],
      deadline: ""
    });
    setIsProjectModalOpen(true);
  };

  const handleOpenEditProject = (p: SoftwareProject) => {
    setEditingProjectId(p.id);
    setProjectForm({
      client_id: p.client_id.toString(),
      name: p.name,
      description: p.description || "",
      total_budget: p.total_budget || 0,
      currency: p.currency || "INR",
      status: p.status || "IN_PROGRESS",
      start_date: p.start_date ? p.start_date.split("T")[0] : "",
      deadline: p.deadline ? p.deadline.split("T")[0] : ""
    });
    setIsProjectModalOpen(true);
  };

  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        client_id: Number(projectForm.client_id),
        name: projectForm.name,
        description: projectForm.description || undefined,
        total_budget: Number(projectForm.total_budget),
        currency: projectForm.currency,
        status: projectForm.status,
        start_date: projectForm.start_date || undefined,
        deadline: projectForm.deadline || undefined
      };

      if (editingProjectId) {
        await api.put(`/software/projects/${editingProjectId}`, payload);
        toast("Project updated", "success");
      } else {
        await api.post('/software/projects', payload);
        toast("Project created", "success");
      }
      setIsProjectModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to save project", "error");
    }
  };

  const handleDeleteProject = async (id: number) => {
    if (!confirm("Are you sure you want to delete this project and all its milestones?")) return;
    try {
      await api.delete(`/software/projects/${id}`);
      toast("Project deleted", "success");
      fetchData();
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to delete project", "error");
    }
  };

  // Milestone actions
  const handleOpenAddMilestone = (projectId: number, projectBudget: number) => {
    setSelectedProjectId(projectId);
    setEditingMilestoneId(null);
    const quarter = projectBudget > 0 ? projectBudget * 0.25 : 25000;
    setMilestoneForm({
      title: "",
      description: "",
      amount: quarter,
      percentage: 25,
      due_date: "",
      status: "PENDING"
    });
    setIsMilestoneModalOpen(true);
  };

  const handleMilestoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;
    try {
      const payload = {
        title: milestoneForm.title,
        description: milestoneForm.description || undefined,
        amount: Number(milestoneForm.amount),
        percentage: Number(milestoneForm.percentage),
        due_date: milestoneForm.due_date || undefined,
        status: milestoneForm.status
      };

      if (editingMilestoneId) {
        await api.put(`/software/milestones/${editingMilestoneId}`, payload);
        toast("Milestone updated", "success");
      } else {
        await api.post(`/software/projects/${selectedProjectId}/milestones`, payload);
        toast("Milestone added to sprint", "success");
      }
      setIsMilestoneModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to save milestone", "error");
    }
  };

  const handleDeleteMilestone = async (id: number) => {
    if (!confirm("Are you sure you want to delete this milestone?")) return;
    try {
      await api.delete(`/software/milestones/${id}`);
      toast("Milestone deleted", "success");
      fetchData();
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to delete milestone", "error");
    }
  };

  const handleInvoiceMilestone = async (m: ProjectMilestone) => {
    try {
      const res = await api.post(`/software/milestones/${m.id}/invoice`);
      toast(res.data.message || "Milestone invoice created!", "success");
      fetchData();
      router.push('/invoices');
    } catch (err: any) {
      toast(err.response?.data?.error || err.message || "Failed to invoice milestone", "error");
    }
  };

  // KPIs (Safely computed)
  const projectList = Array.isArray(projects) ? projects : [];
  const totalProjects = projectList.length;
  const totalBudget = projectList.reduce((acc, p) => acc + (Number(p.total_budget) || 0), 0);
  
  let totalInvoiced = 0;
  let totalPendingRevenue = 0;

  projectList.forEach(p => {
    (Array.isArray(p.milestones) ? p.milestones : []).forEach(m => {
      if (m.status === 'INVOICED') {
        totalInvoiced += (Number(m.amount) || 0);
      } else {
        totalPendingRevenue += (Number(m.amount) || 0);
      }
    });
  });

  const filteredProjects = projectList.filter(p =>
    (p.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.client?.company_name && p.client.company_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 flex flex-col p-8 min-h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-on-surface flex items-center gap-3">
            <FolderGit2 className="h-8 w-8 text-primary" />
            Project Milestone &amp; Retainer Billing
          </h2>
          <p className="text-muted-foreground mt-1">Sprint milestone tracking, automated deliverable invoicing, and retainer overage monitoring</p>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={handleOpenAddProject}
            className="bg-primary text-primary-foreground font-medium px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm hover:opacity-90 transition-opacity"
          >
            <Plus className="w-5 h-5" /> New Software Project
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Projects</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">{totalProjects}</span>
            <span className="text-xs text-muted-foreground">Software Sprints</span>
          </div>
        </div>

        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Contract Budget</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">{baseCurrency}{totalBudget.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground">Booked Value</span>
          </div>
        </div>

        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Milestones Invoiced</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-emerald-500">{baseCurrency}{totalInvoiced.toLocaleString()}</span>
            <span className="text-xs text-emerald-600 font-medium">Billed to Clients</span>
          </div>
        </div>

        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pending Milestone Revenue</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-amber-500">{baseCurrency}{totalPendingRevenue.toLocaleString()}</span>
            <span className="text-xs text-amber-600 font-medium">Upon Completion</span>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 bg-card border border-border p-3 rounded-xl">
        <Search className="w-4 h-4 text-muted-foreground ml-1" />
        <input 
          type="text" 
          placeholder="Filter by project title, description, or client..." 
          className="bg-transparent text-sm text-foreground outline-none flex-1 placeholder:text-muted-foreground"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Projects List */}
      <div className="space-y-6">
        {filteredProjects.map((project) => {
          const milestones = project.milestones || [];
          const invoicedAmount = milestones
            .filter(m => m.status === 'INVOICED')
            .reduce((acc, m) => acc + m.amount, 0);
          const progressPercent = project.total_budget > 0 
            ? Math.min(100, Math.round((invoicedAmount / project.total_budget) * 100))
            : 0;

          return (
            <div key={project.id} className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
              {/* Project Header */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-border">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold text-foreground">{project.name}</h3>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-primary/10 text-primary border border-primary/20">
                      {project.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Client: <span className="font-semibold text-foreground">{project.client?.company_name || 'Client #' + project.client_id}</span>
                    {project.deadline && <> • Deadline: <span className="text-foreground">{new Date(project.deadline).toLocaleDateString()}</span></>}
                  </p>
                  {project.description && <p className="text-xs text-muted-foreground/80 mt-1">{project.description}</p>}
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Total Budget</div>
                    <div className="text-lg font-bold text-foreground">{baseCurrency}{Number(project.total_budget).toLocaleString()}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenAddMilestone(project.id, project.total_budget)}
                      className="text-xs bg-secondary hover:bg-muted text-foreground font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 text-primary" /> Add Milestone
                    </button>
                    <button
                      onClick={() => handleOpenEditProject(project)}
                      className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteProject(project.id)}
                      className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-muted-foreground">Invoicing Progress ({progressPercent}%)</span>
                  <span className="text-foreground">{baseCurrency}{invoicedAmount.toLocaleString()} / {baseCurrency}{Number(project.total_budget).toLocaleString()}</span>
                </div>
                <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Milestones Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5" /> Sprint Milestones ({milestones.length})
                  </h4>
                </div>

                {milestones.length === 0 ? (
                  <div className="p-6 border border-dashed border-border rounded-xl text-center text-xs text-muted-foreground">
                    No milestones configured for this project yet. Click "Add Milestone" to break this sprint into billable deliverables.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {milestones.map((m) => {
                      const isInvoiced = m.status === 'INVOICED';
                      return (
                        <div 
                          key={m.id} 
                          className={`p-4 rounded-xl border transition-all ${
                            isInvoiced 
                              ? 'bg-emerald-500/5 border-emerald-500/20' 
                              : 'bg-muted/20 border-border hover:border-primary/40'
                          } flex flex-col justify-between gap-3`}
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <h5 className="font-bold text-sm text-foreground leading-tight">{m.title}</h5>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isInvoiced 
                                  ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30' 
                                  : 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                              }`}>
                                {m.status}
                              </span>
                            </div>
                            {m.description && <p className="text-xs text-muted-foreground line-clamp-2">{m.description}</p>}
                          </div>

                          <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
                            <div>
                              <div className="font-bold text-foreground text-sm">{baseCurrency}{Number(m.amount).toLocaleString()}</div>
                              {m.due_date && (
                                <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Calendar className="w-3 h-3" /> Due: {new Date(m.due_date).toLocaleDateString()}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              {!isInvoiced && (
                                <button
                                  onClick={() => handleInvoiceMilestone(m)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1 shadow-sm transition-colors"
                                  title="Complete and generate draft invoice"
                                >
                                  <Receipt className="w-3 h-3" /> Bill Now
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteMilestone(m.id)}
                                className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {!loading && filteredProjects.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 text-center bg-card border border-border rounded-2xl">
            <FolderGit2 className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-1">No software projects found</h3>
            <p className="text-sm text-muted-foreground mb-4">Click "New Software Project" to start tracking client sprints and milestone billing.</p>
          </div>
        )}
      </div>

      {/* Project Modal */}
      <Dialog open={isProjectModalOpen} onOpenChange={setIsProjectModalOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProjectId ? "Edit Software Project" : "New Software Project"}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define sprint budget, timeline and client account
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleProjectSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Client Account</Label>
              <select
                required
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none"
                value={projectForm.client_id}
                onChange={e => setProjectForm({ ...projectForm, client_id: e.target.value })}
              >
                <option value="" disabled>Select Client</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id.toString()}>{c.company_name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Project / Sprint Name</Label>
              <input
                required
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none"
                placeholder="e.g. Next.js SaaS MVP or Mobile App Redesign"
                value={projectForm.name}
                onChange={e => setProjectForm({ ...projectForm, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Total Budget ({baseCurrency})</Label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none"
                  value={projectForm.total_budget}
                  onChange={e => setProjectForm({ ...projectForm, total_budget: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Project Status</Label>
                <select
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none"
                  value={projectForm.status}
                  onChange={e => setProjectForm({ ...projectForm, status: e.target.value })}
                >
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="ON_HOLD">ON_HOLD</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Start Date</Label>
                <input
                  type="date"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none"
                  value={projectForm.start_date}
                  onChange={e => setProjectForm({ ...projectForm, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Deadline</Label>
                <input
                  type="date"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none"
                  value={projectForm.deadline}
                  onChange={e => setProjectForm({ ...projectForm, deadline: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Description (Optional)</Label>
              <textarea
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none"
                placeholder="Scope, repo link, or client objectives..."
                value={projectForm.description}
                onChange={e => setProjectForm({ ...projectForm, description: e.target.value })}
              />
            </div>

            <button type="submit" className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition-opacity mt-4">
              {editingProjectId ? "Update Project" : "Create Project"}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Milestone Modal */}
      <Dialog open={isMilestoneModalOpen} onOpenChange={setIsMilestoneModalOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle>Add Sprint Milestone</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define deliverable scope and billable amount
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleMilestoneSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Milestone Title</Label>
              <input
                required
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none"
                placeholder="e.g. Phase 1: Database Architecture & Auth API"
                value={milestoneForm.title}
                onChange={e => setMilestoneForm({ ...milestoneForm, title: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Milestone Amount ({baseCurrency})</Label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none"
                  value={milestoneForm.amount}
                  onChange={e => setMilestoneForm({ ...milestoneForm, amount: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Target Due Date</Label>
                <input
                  type="date"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none"
                  value={milestoneForm.due_date}
                  onChange={e => setMilestoneForm({ ...milestoneForm, due_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Deliverables / Notes</Label>
              <textarea
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none"
                placeholder="Acceptance criteria required for signoff..."
                value={milestoneForm.description}
                onChange={e => setMilestoneForm({ ...milestoneForm, description: e.target.value })}
              />
            </div>

            <button type="submit" className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition-opacity mt-4">
              Save Milestone
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
