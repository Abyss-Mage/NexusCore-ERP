"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { FileSignature, Plus, Loader2, X } from "lucide-react";
import { useToast } from "@/components/ui/toast-context";

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    client_id: "",
    proposal_num: "",
    title: "",
    issue_date: "",
    grand_total: ""
  });

  const fetchData = async () => {
    try {
        const [proposalsRes, clientsRes] = await Promise.all([
            api.get("/software/proposals"),
            api.get("/clients?limit=500")
        ]);
        setProposals(proposalsRes.data?.data || proposalsRes.data || []);
        setClients(clientsRes.data?.data || []);
    } catch (e) {
        console.error("Failed to load data", e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
        await api.post("/software/proposals", {
            ...formData,
            client_id: parseInt(formData.client_id),
            grand_total: parseFloat(formData.grand_total),
            status: "Draft",
            issue_date: formData.issue_date ? new Date(formData.issue_date).toISOString() : new Date().toISOString()
        });
        toast("Proposal created successfully", "success");
        setOpen(false);
        setFormData({ client_id: "", proposal_num: "", title: "", issue_date: "", grand_total: "" });
        fetchData();
    } catch (err) {
        toast("Failed to create proposal", "error");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 w-full max-w-7xl mx-auto overflow-x-hidden">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Proposals & SOWs</h1>
          <p className="text-gray-400 mt-1">Manage and create statements of work</p>
        </div>
      </div>
      
      <div className="glass-panel flex flex-col min-w-0">
        <div className="p-4 md:p-6 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-lg font-bold text-white flex items-center">
            <FileSignature className="w-5 h-5 mr-2 text-cyan-400" /> Recent Proposals
          </h2>
          <button onClick={() => setOpen(true)} className="btn-primary text-sm px-4 py-2 flex items-center">
            <Plus className="w-4 h-4 mr-2" /> Create Proposal
          </button>
        </div>
        
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white/[0.02] border-b border-white/5">
              <tr>
                <th className="p-4 font-semibold text-gray-400 uppercase tracking-wider text-xs">ID</th>
                <th className="p-4 font-semibold text-gray-400 uppercase tracking-wider text-xs">Client</th>
                <th className="p-4 font-semibold text-gray-400 uppercase tracking-wider text-xs">Title</th>
                <th className="p-4 font-semibold text-gray-400 uppercase tracking-wider text-xs">Date</th>
                <th className="p-4 font-semibold text-gray-400 uppercase tracking-wider text-xs">Total</th>
                <th className="p-4 font-semibold text-gray-400 uppercase tracking-wider text-xs">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {proposals.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500 border border-dashed border-white/10 m-4 rounded-lg">
                    No proposals created yet.
                  </td>
                </tr>
              )}
              {proposals.map(p => (
                <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 font-mono text-cyan-400">{p.proposal_num}</td>
                  <td className="p-4 font-medium text-white">{p.client?.company_name}</td>
                  <td className="p-4 text-gray-300">{p.title}</td>
                  <td className="p-4 text-gray-400">{new Date(p.issue_date).toLocaleDateString()}</td>
                  <td className="p-4 font-bold text-white">₹{p.grand_total}</td>
                  <td className="p-4">
                    <span className="bg-white/10 text-gray-300 px-2.5 py-1 rounded-full text-xs border border-white/5 font-medium">{p.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="glass-panel w-full max-w-lg p-6 flex flex-col gap-6 relative">
                <button 
                    onClick={() => { setOpen(false); setFormData({ client_id: "", proposal_num: "", title: "", issue_date: "", grand_total: "" }); }}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
                
                <div>
                    <h2 className="text-xl font-bold text-white">New Proposal / SOW</h2>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Client</label>
                        <select 
                            required
                            className="input-dark w-full appearance-none"
                            value={formData.client_id} 
                            onChange={(e) => setFormData({...formData, client_id: e.target.value})}
                        >
                            <option value="" disabled>Select a client...</option>
                            {clients.map(c => <option key={c.id} value={c.id.toString()}>{c.company_name}</option>)}
                        </select>
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Title</label>
                        <input 
                            required 
                            className="input-dark w-full"
                            placeholder="e.g. Website Development" 
                            value={formData.title} 
                            onChange={e => setFormData({...formData, title: e.target.value})} 
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">Proposal #</label>
                            <input 
                                required 
                                className="input-dark w-full"
                                placeholder="PROP-001" 
                                value={formData.proposal_num} 
                                onChange={e => setFormData({...formData, proposal_num: e.target.value})} 
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">Issue Date</label>
                            <input 
                                required 
                                type="date" 
                                className="input-dark w-full"
                                value={formData.issue_date} 
                                onChange={e => setFormData({...formData, issue_date: e.target.value})} 
                            />
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Estimated Total (₹)</label>
                        <input 
                            required 
                            type="number" 
                            className="input-dark w-full"
                            value={formData.grand_total} 
                            onChange={e => setFormData({...formData, grand_total: e.target.value})} 
                        />
                    </div>
                    
                    <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                        <button type="button" onClick={() => { setOpen(false); setFormData({ client_id: "", proposal_num: "", title: "", issue_date: "", grand_total: "" }); }} className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors">Cancel</button>
                        <button type="submit" className="btn-primary flex items-center" disabled={loading}>
                            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Save Proposal
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}
