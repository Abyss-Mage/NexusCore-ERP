"use client"

import { useState, useEffect } from "react"
import api from "@/lib/api"
import { Plus, Trash2, Edit, Key, Lock, Eye, EyeOff, Copy, ExternalLink, ShieldCheck, X } from "lucide-react"
import { useToast } from "@/components/ui/toast-context"
import { VaultOTP } from "@/components/VaultOTP"

interface Client {
    id: number;
    company_name: string;
}

interface Credential {
    id: number;
    client_id: number;
    service_name: string;
    url?: string;
    username: string;
    notes?: string;
    created_at: string;
}

interface VaultAuditLog {
    id: number;
    user_id: number;
    user_email: string;
    credential_id?: number;
    service_name: string;
    client_id?: number;
    client_name: string;
    action: string;
    ip_address: string;
    user_agent: string;
    created_at: string;
}

export default function CredentialVaultPage() {
    const [isLocked, setIsLocked] = useState(true)
    const [activeTab, setActiveTab] = useState<"credentials" | "audit">("credentials")
    const [clients, setClients] = useState<Client[]>([])
    const [selectedClientId, setSelectedClientId] = useState<string>("0")
    const [credentials, setCredentials] = useState<Credential[]>([])
    const [auditLogs, setAuditLogs] = useState<VaultAuditLog[]>([])
    const [loadingAudit, setLoadingAudit] = useState(false)
    
    const [isOpen, setIsOpen] = useState(false)
    const { toast } = useToast()
    
    const [formData, setFormData] = useState({
        id: 0,
        service_name: "",
        url: "",
        username: "",
        password: "",
        notes: "",
        client_id: ""
    })

    const [decryptedPasswords, setDecryptedPasswords] = useState<Record<number, string>>({})
    const [visiblePasswords, setVisiblePasswords] = useState<Record<number, boolean>>({})

    const fetchClients = async () => {
        try {
            const cRes = await api.get('/clients?limit=500')
            const clientsData = cRes.data.data || cRes.data || []
            setClients(clientsData)
            if (clientsData.length > 0) {
                const firstClient = clientsData[0].id.toString();
                setSelectedClientId(firstClient)
                fetchCredentials(firstClient)
            }
        } catch (err) {
            console.error(err)
        }
    }

    const fetchCredentials = async (clientId: string) => {
        if (!clientId || clientId === "0") {
            setCredentials([])
            return
        }
        try {
            const res = await api.get(`/vault/client/${clientId}`)
            setCredentials(res.data.data || [])
            setDecryptedPasswords({})
            setVisiblePasswords({})
        } catch (err) {
            console.error(err)
            toast("Failed to load credentials", "error")
        }
    }

    const fetchAuditLogs = async () => {
        setLoadingAudit(true)
        try {
            const res = await api.get('/vault/audit-logs?limit=100')
            setAuditLogs(res.data.data || [])
        } catch (err) {
            console.error(err)
            toast("Failed to load audit logs", "error")
        } finally {
            setLoadingAudit(false)
        }
    }

    useEffect(() => {
        fetchClients()
    }, [])

    useEffect(() => {
        if (activeTab === "audit") {
            fetchAuditLogs()
        }
    }, [activeTab])

    const handleClientChange = (clientId: string) => {
        setSelectedClientId(clientId)
        fetchCredentials(clientId)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const payload = {
                client_id: Number(formData.client_id || selectedClientId),
                service_name: formData.service_name,
                url: formData.url || undefined,
                username: formData.username,
                password: formData.password,
                notes: formData.notes || undefined,
            }

            if (formData.id) {
                await api.put(`/vault/${formData.id}`, payload)
                toast("Credential updated", "success")
            } else {
                await api.post('/vault', payload)
                toast("Credential added to vault", "success")
            }

            setIsOpen(false)
            fetchCredentials(formData.client_id || selectedClientId)
            resetForm()
        } catch (err: any) {
            toast(err.response?.data?.error || "Failed to save credential", "error")
        }
    }

    const resetForm = () => {
        setFormData({ id: 0, service_name: "", url: "", username: "", password: "", notes: "", client_id: selectedClientId })
    }

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to permanently delete this credential?")) return;
        try {
            await api.delete(`/vault/${id}`);
            toast("Credential deleted", "success");
            fetchCredentials(selectedClientId);
        } catch (err: any) {
            toast(err.response?.data?.error || "Failed to delete credential", "error");
        }
    }

    const togglePasswordVisibility = async (id: number) => {
        // If it's currently visible, just hide it
        if (visiblePasswords[id]) {
            setVisiblePasswords({ ...visiblePasswords, [id]: false })
            return
        }

        // If we haven't fetched it yet, fetch it
        if (!decryptedPasswords[id]) {
            try {
                const res = await api.get(`/vault/${id}/decrypted`)
                setDecryptedPasswords({ ...decryptedPasswords, [id]: res.data.decrypted_password })
            } catch (err: any) {
                toast(err.response?.data?.error || "Failed to decrypt password", "error")
                return
            }
        }

        // Show it
        setVisiblePasswords({ ...visiblePasswords, [id]: true })
    }

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text)
        toast(`${label} copied to clipboard`, "success")
    }

    const copyPassword = async (id: number) => {
        let pwd = decryptedPasswords[id];
        if (!pwd) {
            try {
                const res = await api.get(`/vault/${id}/decrypted`)
                pwd = res.data.decrypted_password
                setDecryptedPasswords({ ...decryptedPasswords, [id]: pwd })
            } catch (err: any) {
                toast(err.response?.data?.error || "Failed to decrypt password", "error")
                return
            }
        }
        copyToClipboard(pwd, "Password")
    }

    return (
        <>
        {isLocked && <VaultOTP onUnlock={() => setIsLocked(false)} />}
        <div className={`space-y-6 w-full max-w-7xl mx-auto p-4 md:p-6 overflow-x-hidden transition-all duration-700 ${isLocked ? 'blur-md opacity-50 scale-95 pointer-events-none' : 'blur-0 opacity-100 scale-100'}`}>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                        <ShieldCheck className="h-8 w-8 text-cyan-400" />
                        Client Credential Vault
                    </h1>
                    <p className="text-gray-400 mt-1">Zero-Trust AES-256 password vault with immutable access audit trails</p>
                </div>

                <div className="flex gap-2 bg-white/5 p-1 rounded-xl border border-white/10 self-start sm:self-auto">
                    <button
                        onClick={() => setActiveTab("credentials")}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                            activeTab === "credentials" 
                                ? "bg-primary text-primary-foreground shadow" 
                                : "text-gray-400 hover:text-white"
                        }`}
                    >
                        Credentials
                    </button>
                    <button
                        onClick={() => setActiveTab("audit")}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                            activeTab === "audit" 
                                ? "bg-primary text-primary-foreground shadow" 
                                : "text-gray-400 hover:text-white"
                        }`}
                    >
                        Audit Trail
                    </button>
                </div>
            </div>

            {activeTab === "credentials" && (
                <>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
                    <div className="flex items-center gap-3">
                        <label className="text-xs uppercase text-gray-400 font-bold tracking-wider">Client:</label>
                        <select 
                            className="input-dark w-full sm:w-[250px] appearance-none"
                            value={selectedClientId} 
                            onChange={(e) => handleClientChange(e.target.value)}
                        >
                            {clients.length === 0 && <option value="0" disabled>No clients found</option>}
                            {clients.map(c => <option key={c.id} value={c.id.toString()}>{c.company_name}</option>)}
                        </select>
                    </div>

                    <button 
                        disabled={!selectedClientId || selectedClientId === "0"} 
                        onClick={() => {
                            setFormData({...formData, client_id: selectedClientId});
                            setIsOpen(true);
                        }}
                        className="btn-primary flex items-center justify-center whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Plus className="mr-2 h-4 w-4" /> Add Credential
                    </button>
                </div>
                </>
            )}

            {activeTab === "credentials" && (
                <>
                {!selectedClientId || selectedClientId === "0" ? (
                    <div className="border border-dashed border-white/10 rounded-xl flex items-center justify-center p-12 text-gray-500 text-center flex-col gap-4 bg-white/[0.02]">
                        <Key className="h-12 w-12 opacity-50" />
                        <div>
                            <p className="font-bold text-white text-lg">No Client Selected</p>
                            <p className="text-sm mt-1">Please select a client from the dropdown to view or add credentials.</p>
                        </div>
                    </div>
                ) : credentials.length === 0 ? (
                    <div className="border border-dashed border-white/10 rounded-xl flex items-center justify-center p-12 text-gray-500 text-center flex-col gap-4 bg-white/[0.02]">
                        <Lock className="h-12 w-12 opacity-50" />
                        <div>
                            <p className="font-bold text-white text-lg">Vault is Empty</p>
                            <p className="text-sm mt-1 mb-6">There are no credentials stored for this client yet.</p>
                            <button onClick={() => setIsOpen(true)} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors border border-white/10">Add First Credential</button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {credentials.map(cred => (
                            <div key={cred.id} className="glass-panel p-5 relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/80"></div>
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="text-lg font-bold text-white leading-tight flex items-center gap-2">
                                            {cred.service_name}
                                        </h3>
                                        {cred.url && (
                                            <button 
                                                type="button"
                                                onClick={() => {
                                                    if (!cred.url) return;
                                                    try {
                                                        const formatted = /^https?:\/\//i.test(cred.url) ? cred.url : `https://${cred.url}`;
                                                        const parsed = new URL(formatted);
                                                        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                                                            const a = document.createElement('a');
                                                            a.href = parsed.href;
                                                            a.target = '_blank';
                                                            a.rel = 'noopener noreferrer';
                                                            a.click();
                                                        }
                                                    } catch (e) {
                                                        console.error("Invalid URL", e);
                                                    }
                                                }}
                                                className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 mt-1 truncate text-xs hover:underline text-left cursor-pointer"
                                            >
                                                <span>{cred.url}</span>
                                                <ExternalLink className="h-3 w-3 shrink-0" />
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            className="h-8 w-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 rounded transition-colors"
                                            onClick={() => {
                                                setFormData({
                                                    id: cred.id,
                                                    service_name: cred.service_name,
                                                    url: cred.url || "",
                                                    username: cred.username,
                                                    password: "",
                                                    notes: cred.notes || "",
                                                    client_id: cred.client_id.toString()
                                                })
                                                api.get(`/vault/${cred.id}/decrypted`).then(res => {
                                                    setFormData(prev => ({...prev, password: res.data.decrypted_password}))
                                                    setIsOpen(true)
                                                }).catch(() => {
                                                    setFormData(prev => ({...prev, password: ""}))
                                                    setIsOpen(true)
                                                })
                                            }}
                                        >
                                            <Edit className="h-4 w-4" />
                                        </button>
                                        <button 
                                            className="h-8 w-8 flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                                            onClick={() => handleDelete(cred.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Username</label>
                                        <div className="flex items-center gap-2">
                                            <code className="text-sm bg-black/40 text-gray-300 px-3 py-1.5 rounded flex-1 truncate select-all border border-white/5">{cred.username}</code>
                                            <button 
                                                className="h-8 w-8 flex items-center justify-center shrink-0 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded transition-colors" 
                                                onClick={() => copyToClipboard(cred.username, "Username")}
                                                title="Copy Username"
                                            >
                                                <Copy className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-1">
                                        <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Password</label>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 bg-black/40 border border-white/5 text-gray-300 px-3 py-1.5 rounded flex items-center h-[34px] overflow-hidden text-sm">
                                                {visiblePasswords[cred.id] ? (
                                                    <code className="select-all font-mono break-all">{decryptedPasswords[cred.id]}</code>
                                                ) : (
                                                    <span className="text-gray-500 tracking-widest text-lg leading-none mt-1">••••••••</span>
                                                )}
                                            </div>
                                            <button 
                                                className="h-8 w-8 flex items-center justify-center shrink-0 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded transition-colors"
                                                onClick={() => togglePasswordVisibility(cred.id)}
                                                title={visiblePasswords[cred.id] ? "Hide Password" : "Show Password"}
                                            >
                                                {visiblePasswords[cred.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                            <button 
                                                className="h-8 w-8 flex items-center justify-center shrink-0 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded transition-colors"
                                                onClick={() => copyPassword(cred.id)}
                                                title="Copy Password"
                                            >
                                                <Copy className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {cred.notes && (
                                        <div className="space-y-1 pt-3 border-t border-white/5">
                                            <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Notes</label>
                                            <p className="text-sm text-gray-300 whitespace-pre-wrap">{cred.notes}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                </>
            )}

            {activeTab === "audit" && (
                <div className="glass-panel overflow-hidden border border-white/10 rounded-xl">
                    <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
                        <div>
                            <h3 className="font-bold text-white text-base">Zero-Trust Access Audit Trail</h3>
                            <p className="text-xs text-gray-400">Immutable audit log of all credential reveals, copies, updates, and deletes</p>
                        </div>
                        <button
                            onClick={fetchAuditLogs}
                            className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
                        >
                            Refresh Log
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-white/5 text-gray-400 text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="p-3">Timestamp</th>
                                    <th className="p-3">User</th>
                                    <th className="p-3">Action</th>
                                    <th className="p-3">Service / Secret</th>
                                    <th className="p-3">Client</th>
                                    <th className="p-3">IP Address</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {loadingAudit ? (
                                    <tr><td colSpan={6} className="p-8 text-center text-gray-400">Loading audit trail...</td></tr>
                                ) : auditLogs.length === 0 ? (
                                    <tr><td colSpan={6} className="p-8 text-center text-gray-500">No audit events recorded yet</td></tr>
                                ) : (
                                    auditLogs.map((log) => {
                                        let actionBadgeClass = "bg-blue-500/10 text-blue-400 border-blue-500/20";
                                        if (log.action === "VIEW_PASSWORD") actionBadgeClass = "bg-amber-500/15 text-amber-400 border-amber-500/30";
                                        if (log.action === "DELETE_SECRET") actionBadgeClass = "bg-rose-500/15 text-rose-400 border-rose-500/30";
                                        if (log.action === "CREATE_SECRET") actionBadgeClass = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
                                        if (log.action === "UPDATE_SECRET") actionBadgeClass = "bg-purple-500/15 text-purple-400 border-purple-500/30";

                                        return (
                                            <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="p-3 text-xs text-gray-300 font-mono">
                                                    {new Date(log.created_at).toLocaleString()}
                                                </td>
                                                <td className="p-3 font-medium text-white text-xs">
                                                    {log.user_email || `User #${log.user_id}`}
                                                </td>
                                                <td className="p-3">
                                                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${actionBadgeClass}`}>
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-cyan-400 font-semibold text-xs">
                                                    {log.service_name || "—"}
                                                </td>
                                                <td className="p-3 text-gray-300 text-xs">
                                                    {log.client_name || "—"}
                                                </td>
                                                <td className="p-3 text-gray-400 font-mono text-xs">
                                                    {log.ip_address || "127.0.0.1"}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* MODAL */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="glass-panel w-full max-w-lg p-6 flex flex-col gap-6 relative">
                        <button 
                            onClick={() => { setIsOpen(false); resetForm(); }}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <div>
                            <h2 className="text-xl font-bold text-white">{formData.id ? "Edit Credential" : "Add to Vault"}</h2>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300">Service / Environment Name</label>
                                <input 
                                    required 
                                    className="input-dark w-full"
                                    placeholder="e.g. Production AWS, WordPress Admin" 
                                    value={formData.service_name} 
                                    onChange={e => setFormData({ ...formData, service_name: e.target.value })} 
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300">Login URL (Optional)</label>
                                <input 
                                    type="url" 
                                    className="input-dark w-full"
                                    placeholder="https://..." 
                                    value={formData.url} 
                                    onChange={e => setFormData({ ...formData, url: e.target.value })} 
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Username / Email</label>
                                    <input 
                                        required 
                                        className="input-dark w-full"
                                        value={formData.username} 
                                        onChange={e => setFormData({ ...formData, username: e.target.value })} 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Password</label>
                                    <input 
                                        required 
                                        type="password" 
                                        className="input-dark w-full"
                                        value={formData.password} 
                                        onChange={e => setFormData({ ...formData, password: e.target.value })} 
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300">Notes (Optional)</label>
                                <textarea 
                                    rows={3} 
                                    className="input-dark w-full py-2"
                                    placeholder="Database name, SSH port, etc." 
                                    value={formData.notes} 
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })} 
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                                <button type="button" onClick={() => { setIsOpen(false); resetForm(); }} className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors">Cancel</button>
                                <button type="submit" className="btn-primary">
                                    {formData.id ? "Update Credential" : "Encrypt & Save"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
        </>
    )
}
