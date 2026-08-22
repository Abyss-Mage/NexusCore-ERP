"use client";

import React, { useState, useEffect } from 'react';
import { Save, Loader2, ArrowLeft, Mail, Phone, Lock, Unlock, User, Hash, FileText, ChevronRight, Calculator, Building } from "lucide-react";
import { QuotationItemsTable, QuoteItem } from "./quotation-items";
import api from "@/lib/api"; 
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { AVAILABLE_CURRENCIES } from "@/lib/currencies";
import { useToast } from "@/components/ui/toast-context";

export default function NewQuotationPage() {
  const router = useRouter();
  const { toast } = useToast();

  // --- State ---
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState<string>("");
  
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedClient, setSelectedClient] = useState<any>(null);
  
  const [currency, setCurrency] = useState<string>("INR");
  const [exchangeRate, setExchangeRate] = useState<number>(1.0);
  const [isSaving, setIsSaving] = useState(false);

  // Manual Override State
  const [isManual, setIsManual] = useState(false);
  const [manualNumber, setManualNumber] = useState("");

  // BOQ (Items)
  const [items, setItems] = useState<QuoteItem[]>([
    { id: 1, description: "", hsn: "", quantity: 1, rate: 0, amount: 0 }
  ]);
  const [subtotal, setSubtotal] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);

  const [servicesOffered, setServicesOffered] = useState("");
  const [contractTerms, setContractTerms] = useState("");
  const [remarks, setRemarks] = useState("");
  const [itemCodeLabel, setItemCodeLabel] = useState("Item Code / HSN");

  // --- Data Fetching ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [clientsRes, locRes] = await Promise.all([
          api.get('/clients?limit=500'),
          api.get('/settings/LOCALIZATION')
        ]);
        setClients(clientsRes.data.data || []);
        
        if (locRes.data && locRes.data.value) {
            try {
                const parsed = typeof locRes.data.value === 'string' 
                    ? JSON.parse(locRes.data.value) 
                    : locRes.data.value;
                if (parsed.item_code_label) {
                    setItemCodeLabel(parsed.item_code_label);
                }
            } catch(e) {}
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, []);

  const handleClientChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedClientId(id);
    const client = clients.find(c => c.id.toString() === id);
    setSelectedClient(client || null);
  };

  useEffect(() => {
    const newSubtotal = items.reduce((sum, item) => sum + item.amount, 0);
    setSubtotal(newSubtotal);
    setGrandTotal(newSubtotal); 
  }, [items]);

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2
    }).format(amount);
  };

  // --- Save Handler ---
  const handleSave = async () => {
    if (!selectedClientId) return toast("Please select a Client.", "error");
    if (items.length === 0 || subtotal === 0) return toast("Please add items to the BOQ.", "error");
    if (isManual && !manualNumber.trim()) return toast("Please enter the Manual Quotation Number.", "error");

    try {
      setIsSaving(true);
      const payload = {
        client_id: Number(selectedClientId),
        issue_date: issueDate ? new Date(issueDate).toISOString() : undefined,
        expiry_date: expiryDate ? new Date(expiryDate).toISOString() : undefined, 
        currency: currency,
        exchange_rate: exchangeRate,
        line_items: items,
        services_offered: servicesOffered,
        contract_terms: contractTerms,
        remarks: remarks,
        
        // Manual Override Fields
        is_manual_entry: isManual,
        quotation_number: isManual ? manualNumber : undefined
      };

      const response = await api.post('/quotations', payload);
      toast(`Success! Quotation ${response.data.quotation_number} Created`, "success");
      router.push('/quotations');

    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.error || "Failed to create quotation.";
      toast(msg, "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen p-6 max-w-[1600px] mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-4">
        <div>
            <div className="flex items-center gap-2 mb-1">
                <Link href="/quotations" className="text-gray-400 hover:text-white transition-colors">Quotations</Link>
                <ChevronRight className="w-4 h-4 text-gray-600" />
                <span className="text-cyan-400 font-medium">New Quote</span>
            </div>
            <h1 className="text-3xl font-bold text-white">Create Proposal</h1>
            <p className="text-sm text-gray-400">Generate a new quotation or estimate</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleSave} disabled={isSaving} className="btn-primary shadow-lg shadow-cyan-500/20">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Quote
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Client & Meta Data (4 cols) */}
        <div className="xl:col-span-4 space-y-6">
            
            {/* 1. Client Details */}
            <div className="glass-panel p-6">
                <div className="border-b border-white/5 pb-4 mb-6">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <User className="w-5 h-5 text-cyan-400" />
                        Client Information
                    </h2>
                </div>
                
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Client Name</label>
                        <div className="relative">
                            <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <select 
                                className="input-dark w-full pl-10 appearance-none bg-background text-foreground"
                                value={selectedClientId}
                                onChange={handleClientChange}
                            >
                                <option value="" className="bg-[#18181b] text-white">Select Client...</option>
                                {clients.map(client => (
                                <option key={client.id} value={client.id} className="bg-[#18181b] text-white">{client.company_name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Contact Phone</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input disabled value={selectedClient?.phone || "—"} className="input-dark w-full pl-10 bg-white/[0.02] text-gray-500 cursor-not-allowed" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input disabled value={selectedClient?.email || "—"} className="input-dark w-full pl-10 bg-white/[0.02] text-gray-500 cursor-not-allowed" />
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Quote Meta */}
            <div className="glass-panel p-6">
                <div className="border-b border-white/5 pb-4 mb-6">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Hash className="w-5 h-5 text-cyan-400" />
                        Quote Details
                    </h2>
                </div>
                
                <div className="space-y-6">
                    
                    {/* Manual Override Toggle */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <label className="text-sm font-medium text-gray-300">Manual Override</label>
                            <p className="text-xs text-gray-500">Set number manually</p>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="rounded border-gray-600 bg-white/5 text-cyan-500 focus:ring-cyan-500/20"
                                checked={isManual}
                                onChange={(e) => setIsManual(e.target.checked)} 
                            />
                        </label>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Quotation No</label>
                        {isManual ? (
                            <div className="relative">
                                <Unlock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                                <input 
                                    value={manualNumber} 
                                    onChange={(e) => setManualNumber(e.target.value)}
                                    placeholder="e.g. Q-CUSTOM-001"
                                    className="input-dark w-full pl-10 font-mono text-sm border-amber-500/30 focus:border-amber-500" 
                                />
                            </div>
                        ) : (
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input 
                                    value="Auto-generated" 
                                    disabled 
                                    className="input-dark w-full pl-10 bg-white/[0.02] text-gray-500 font-mono text-sm cursor-not-allowed" 
                                />
                            </div>
                        )}
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Currency</label>
                        <select 
                            className="input-dark w-full appearance-none text-sm"
                            value={currency} 
                            onChange={(e) => setCurrency(e.target.value)}
                        >
                            <option value="">Select Currency</option>
                            {AVAILABLE_CURRENCIES.map((c) => (
                                <option key={c.code} value={c.code}>
                                {c.code} - {c.name} ({c.symbol})
                                </option>
                            ))}
                        </select>
                    </div>

                    {currency !== 'INR' && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-cyan-400">Exchange Rate (to INR)</label>
                            <input
                                type="number"
                                step="0.01"
                                className="input-dark w-full border-cyan-500/30 bg-cyan-500/5 focus:border-cyan-400 focus:ring-cyan-400 text-sm"
                                value={exchangeRate}
                                onChange={e => setExchangeRate(Number(e.target.value))}
                            />
                            <p className="text-xs text-gray-500 pt-1">
                                1 {currency} = ₹{exchangeRate.toFixed(2)}
                            </p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300 block">Issue Date</label>
                        <div className="relative">
                            <input 
                                type="date"
                                className="input-dark w-full text-sm [color-scheme:dark]"
                                value={issueDate}
                                onChange={(e) => setIssueDate(e.target.value)}
                            />
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300 block">Valid Until (Optional)</label>
                        <div className="relative">
                            <input 
                                type="date"
                                className="input-dark w-full text-sm [color-scheme:dark]"
                                value={expiryDate}
                                onChange={(e) => setExpiryDate(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* RIGHT COLUMN: BOQ & Scope (8 cols) */}
        <div className="xl:col-span-8 flex flex-col gap-6">
            <div className="glass-panel p-6">
                <div className="border-b border-white/5 pb-4 mb-6">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <FileText className="w-5 h-5 text-cyan-400" />
                        Bill of Quantities
                    </h2>
                </div>
                
                <div className="-mx-2 sm:mx-0">
                    <QuotationItemsTable items={items} setItems={setItems} currency={currency} itemCodeLabel={itemCodeLabel} />
                </div>

                <div className="flex justify-end mt-6 pt-4 border-t border-white/10">
                    <div className="text-right w-64">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-gray-400 text-sm font-mono">Subtotal</span>
                            <span className="text-white font-medium font-mono">{formatMoney(subtotal)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 mt-2">
                            <span className="font-bold text-gray-300">Total Estimate</span>
                            <span className="text-2xl font-bold text-cyan-400 tracking-tight">{formatMoney(grandTotal)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="glass-panel p-6">
                <div className="border-b border-white/5 pb-4 mb-6">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <FileText className="w-5 h-5 text-cyan-400" />
                        Scope & Terms
                    </h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Services Offered (Scope)</label>
                        <textarea 
                            placeholder="Describe the scope of work..."
                            value={servicesOffered}
                            onChange={(e) => setServicesOffered(e.target.value)}
                            className="input-dark w-full h-32 resize-none text-sm"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Contract Terms</label>
                        <textarea 
                            placeholder="e.g. 50% Advance, Balance on Delivery..."
                            value={contractTerms}
                            onChange={(e) => setContractTerms(e.target.value)}
                            className="input-dark w-full h-32 resize-none text-sm"
                        />
                    </div>
                </div>
                <div className="space-y-2 pt-6 mt-6 border-t border-white/5">
                    <label className="text-sm font-medium text-gray-300">Internal Remarks (Not visible to client)</label>
                    <input 
                        placeholder="Notes for team..."
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        className="input-dark w-full text-sm"
                    />
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}