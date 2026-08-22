"use client";

import React, { useState, useEffect } from 'react';
import { Save, Loader2, ArrowLeft, Lock, Unlock, User, Hash, FileText, ChevronRight, Calculator, Building } from "lucide-react";
import { QuotationItemsTable, QuoteItem } from "../new/quotation-items"; 
import api from "@/lib/api"; 
import Link from "next/link";
import { useRouter, useSearchParams } from 'next/navigation';
import { AVAILABLE_CURRENCIES } from "@/lib/currencies";
import { Suspense } from 'react';
import { useToast } from "@/components/ui/toast-context";

function EditQuotationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Data State
  const [quoteNumber, setQuoteNumber] = useState("");
  const [isManual, setIsManual] = useState(false); 
  const [issueDate, setIssueDate] = useState<string>("");
  
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [currency, setCurrency] = useState<string>("INR"); 
  
  const [items, setItems] = useState<QuoteItem[]>([]);
  
  // Text Fields
  const [servicesOffered, setServicesOffered] = useState("");
  const [contractTerms, setContractTerms] = useState("");
  const [remarks, setRemarks] = useState("");
  const [itemCodeLabel, setItemCodeLabel] = useState("Item Code / HSN");

  const [grandTotal, setGrandTotal] = useState(0);

  // --- 1. Initial Data Load ---
  useEffect(() => {
    const loadAll = async () => {
        try {
            const [quoteRes, clientsRes, locRes] = await Promise.all([
                api.get(`/quotations/${id}`),
                api.get('/clients?limit=500'),
                api.get('/settings/LOCALIZATION')
            ]);

            const quote = quoteRes.data;
            setClients(clientsRes.data.data || clientsRes.data || []);
            
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

            // Populate Form
            setQuoteNumber(quote.quotation_number);
            setIsManual(quote.is_manual_entry || false); // Load manual status
            setIssueDate(quote.issue_date ? new Date(quote.issue_date).toISOString().split('T')[0] : "");
            setSelectedClientId(quote.client_id.toString());
            setCurrency(quote.currency || "INR");
            
            // Populate Items
            const loadedItems = typeof quote.line_items === 'string' 
                ? JSON.parse(quote.line_items) 
                : quote.line_items;
                
            setItems(loadedItems || []);
            
            setServicesOffered(quote.services_offered || "");
            setContractTerms(quote.contract_terms || "");
            setRemarks(quote.remarks || "");
            
        } catch (e) {
            console.error(e);
            toast("Failed to load quotation details", "error");
            router.push('/quotations');
        } finally {
            setLoading(false);
        }
    };
    if (id) loadAll();
  }, [id, router, toast]);

  // --- 2. Recalculate Totals ---
  useEffect(() => {
    const total = items.reduce((sum, i) => sum + Number(i.amount), 0);
    setGrandTotal(total);
  }, [items]);

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2
    }).format(amount);
  };

  // --- 3. Update Handler ---
  const handleUpdate = async () => {
    setIsSaving(true);
    try {
        await api.put(`/quotations/${id}`, {
            clientId: Number(selectedClientId),
            issueDate: issueDate ? new Date(issueDate).toISOString() : undefined,
            currency,
            items,
            subtotal: grandTotal, 
            grandTotal,
            servicesOffered,
            contractTerms,
            remarks,
            // Include Manual Override Data
            isManual, 
            manualNumber: isManual ? quoteNumber : undefined 
        });
        toast("Quotation Updated Successfully", "success");
        router.push('/quotations');
    } catch (e: any) {
        console.error(e);
        toast(e.response?.data?.error || "Update failed", "error");
    } finally {
        setIsSaving(false);
    }
  };

  if (loading) {
      return (
          <div className="min-h-screen flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
          </div>
      );
  }

  return (
    <div className="min-h-screen p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-4">
        <div className="flex items-center gap-4">
          <Link href="/quotations">
             <button className="p-2 glass-panel hover:bg-white/10 text-gray-400 hover:text-white transition-colors rounded-xl">
                 <ArrowLeft className="w-5 h-5" />
             </button>
          </Link>
          <div>
             <h1 className="text-3xl font-bold text-white mb-1">Edit Quotation</h1>
             <p className="text-sm text-cyan-400 font-mono">{quoteNumber}</p>
          </div>
        </div>
        <button onClick={handleUpdate} disabled={isSaving} className="btn-primary flex items-center shadow-lg shadow-cyan-500/20">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Save className="w-4 h-4 mr-2"/>} 
            Update Quote
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
         {/* Sidebar: Meta Data */}
         <div className="xl:col-span-4 space-y-6">
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
                            <p className="text-xs text-gray-500">Edit number manually</p>
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
                                    value={quoteNumber} 
                                    onChange={(e) => setQuoteNumber(e.target.value)}
                                    placeholder="e.g. Q-CUSTOM-001"
                                    className="input-dark w-full pl-10 font-mono text-sm border-amber-500/30 focus:border-amber-500" 
                                />
                            </div>
                        ) : (
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input 
                                    value={quoteNumber} 
                                    disabled 
                                    className="input-dark w-full pl-10 bg-white/[0.02] text-gray-500 font-mono text-sm cursor-not-allowed" 
                                />
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Client</label>
                        <div className="relative">
                            <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <select 
                                className="input-dark w-full pl-10 appearance-none text-sm bg-background text-foreground"
                                value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}
                            >
                                <option value="" className="bg-[#18181b] text-white">Select Client...</option>
                                {clients.map(c => <option key={c.id} value={c.id} className="bg-[#18181b] text-white">{c.company_name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Currency Selector */}
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
                </div>
            </div>
         </div>

         {/* Main Content: Items */}
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
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Services Offered</label>
                        <textarea 
                            value={servicesOffered} 
                            onChange={(e) => setServicesOffered(e.target.value)} 
                            className="input-dark w-full h-32 resize-none text-sm" 
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Contract Terms</label>
                        <textarea 
                            value={contractTerms} 
                            onChange={(e) => setContractTerms(e.target.value)} 
                            className="input-dark w-full h-32 resize-none text-sm" 
                        />
                    </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-white/10 mt-6">
                    <div className="w-64 space-y-2">
                        <div className="flex justify-between font-bold text-lg text-gray-300">
                            <span>Total Estimate</span>
                            <span className="text-cyan-400 text-2xl tracking-tight">
                                {formatMoney(grandTotal)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
         </div>
      </div>
    </div>
  );
}

export default function EditQuotationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-cyan-400"/></div>}>
      <EditQuotationContent />
    </Suspense>
  );
}