"use client";

import React, { useState, useEffect } from 'react';
import { Save, Loader2, Calendar as CalendarIcon, User, Hash, Tag, FileText, CheckCircle2, ChevronRight, Calculator, Building, ArrowLeft } from "lucide-react";
import { InvoiceItemsTable } from "../new/invoice-items"; 
import api from "@/lib/api"; 
import Link from "next/link";
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useToast } from "@/components/ui/toast-context";
import { AVAILABLE_CURRENCIES } from "@/lib/currencies";

// --- Currency Helpers ---
const getCurrencyLocale = (code: string) => {
    const map: Record<string, string> = {
        'USD': 'en-US',
        'INR': 'en-IN',
        'CAD': 'en-CA',
        'AUD': 'en-AU',
        'GBP': 'en-GB',
        'EUR': 'de-DE',
        'JPY': 'ja-JP'
    };
    return map[code] || 'en-US';
};

function EditInvoiceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Data State
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [remarks, setRemarks] = useState("");
  const [category, setCategory] = useState("");
  
  const [clients, setClients] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  
  // NEW: Currency State
  const [currency, setCurrency] = useState("INR");
  const [exchangeRate, setExchangeRate] = useState(1.0);
  const [items, setItems] = useState<any[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);
  const [taxData, setTaxData] = useState<any>({ taxType: "NONE", gstRate: 0, breakdown: { cgst: 0, sgst: 0, igst: 0 } });
  const [itemCodeLabel, setItemCodeLabel] = useState("Item Code / HSN");

  // --- 1. Initial Data Load ---
  useEffect(() => {
    const loadAll = async () => {
        try {
            const [invRes, clientsRes, banksRes, localizationRes] = await Promise.all([
                api.get(`/invoices/${id}`),
                api.get('/clients?limit=500'),
                api.get('/banks?limit=200'),
                api.get('/settings/LOCALIZATION')
            ]);

            const inv = invRes.data;
            setClients(clientsRes.data.data || []);
            setBanks(banksRes.data.data || []);
            
            if (localizationRes.data && localizationRes.data.value) {
                try {
                    const parsed = typeof localizationRes.data.value === 'string' 
                        ? JSON.parse(localizationRes.data.value) 
                        : localizationRes.data.value;
                    if (parsed.item_code_label) {
                        setItemCodeLabel(parsed.item_code_label);
                    }
                } catch(e) {}
            }

            // Pre-fill Form
            setInvoiceNumber(inv.invoice_number);
            setIssueDate(inv.issue_date ? new Date(inv.issue_date).toISOString().split('T')[0] : "");
            if(inv.due_date) setDueDate(new Date(inv.due_date).toISOString().split('T')[0]);
            setRemarks(inv.remarks || "");
            setCategory(inv.category || "");
            setSelectedClientId(inv.client_id.toString());
            
            // Set Bank & Currency
            setSelectedBankId(inv.bank_account_id?.toString() || "");
            if (inv.currency) setCurrency(inv.currency);
            if (inv.exchange_rate) setExchangeRate(inv.exchange_rate);

            setItems(inv.line_items);
            const ts = inv.tax_summary || {};
            setTaxData({
                taxType: ts.tax_type || "NONE",
                gstRate: ts.rate || 0,
                breakdown: {
                    cgst: ts.cgst || 0,
                    sgst: ts.sgst || 0,
                    igst: ts.igst || 0,
                }
            });
            
        } catch (e) {
            console.error(e);
            toast("Failed to load invoice details", "error");
            router.push('/invoices');
        } finally {
            setLoading(false);
        }
    };
    if (id) loadAll();
  }, [id, router, toast]);

  // --- 2. Handle Bank Change (Update Currency) ---
  const handleBankChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const bankId = e.target.value;
    setSelectedBankId(bankId);
    
    // Find bank and set currency
    const bank = banks.find(b => b.id.toString() === bankId);
    if (bank) {
        setCurrency(bank.currency);
    }
  };

  // --- 3. Recalculate Totals ---
  useEffect(() => {
    const newSub = items.reduce((sum, i) => sum + Number(i.amount), 0);
    setSubtotal(newSub);
  }, [items]);

  // --- 4. Recalculate Tax Logic ---
  useEffect(() => {
    if (!selectedClientId || subtotal === 0) return;
    
    const client = clients.find(c => c.id.toString() === selectedClientId);
    if (!client) return;

    api.post('/invoices/calculate-tax', {
        clientStateCode: client.state_code,
        clientCountry: client.country
    }).then(res => {
        const backendTax = res.data;
        setTaxData({
            ...backendTax,
            breakdown: {
                cgst: (subtotal * backendTax.breakdown.cgst) / 100,
                sgst: (subtotal * backendTax.breakdown.sgst) / 100,
                igst: (subtotal * backendTax.breakdown.igst) / 100,
            }
        });
    });
  }, [selectedClientId, subtotal, clients]);

  useEffect(() => {
    const bd = taxData?.breakdown || { cgst: 0, sgst: 0, igst: 0 };
    const taxTotal = (bd.cgst || 0) + (bd.sgst || 0) + (bd.igst || 0);
    setGrandTotal(subtotal + taxTotal);
  }, [subtotal, taxData]);

  // --- 5. Update Handler ---
  const handleUpdate = async () => {
    setIsSaving(true);
    try {
        await api.put(`/invoices/${id}`, {
            client_id: Number(selectedClientId),
            bank_account_id: Number(selectedBankId),
            issue_date: issueDate ? new Date(issueDate).toISOString() : undefined,
            due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
            line_items: items,
            remarks,
            category: category || undefined,
            currency,
            exchange_rate: Number(exchangeRate)
        });
        toast("Invoice Updated Successfully", "success");
        router.push('/invoices');
    } catch (e: any) {
        toast(e.response?.data?.error || "Update failed", "error");
    } finally {
        setIsSaving(false);
    }
  };

  // Helper for formatting money
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat(getCurrencyLocale(currency), { 
        style: 'currency', 
        currency: currency 
    }).format(amount);
  };

  if (loading) {
      return (
          <div className="min-h-screen flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
          </div>
      );
  }

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto space-y-6">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-4">
        <div className="flex items-center gap-4">
          <Link href="/invoices">
             <button className="p-2 glass-panel hover:bg-white/10 text-gray-400 hover:text-white transition-colors rounded-xl">
                 <ArrowLeft className="w-5 h-5" />
             </button>
          </Link>
          <div>
             <h1 className="text-3xl font-bold text-white mb-1">Edit Invoice</h1>
             <p className="text-sm text-cyan-400 font-mono">{invoiceNumber}</p>
          </div>
        </div>
        
        <button onClick={handleUpdate} disabled={isSaving} className="btn-primary flex items-center shadow-lg shadow-cyan-500/20">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Update Invoice
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Main Form (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
            
          {/* Client & Basic Details Panel */}
          <section className="glass-panel p-6">
            <div className="border-b border-white/5 pb-4 mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <User className="w-5 h-5 text-cyan-400" />
                    Client & Details
                </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Client Select */}
                <div className="md:col-span-2 relative">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-300">Select Client *</label>
                  </div>
                  <div className="relative">
                      <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <select 
                        className="input-dark w-full pl-10 appearance-none bg-background text-foreground"
                        value={selectedClientId}
                        onChange={(e) => setSelectedClientId(e.target.value)}
                      >
                        <option value="" className="bg-[#18181b] text-white">Select Client...</option>
                        {clients.map(client => {
                          const location = client.state || client.country;
                          return (
                            <option key={client.id} value={client.id} className="bg-[#18181b] text-white">
                              {client.company_name}{location ? ` (${location})` : ''}
                            </option>
                          );
                        })}
                      </select>
                  </div>
                </div>
                
                {/* Dates */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 block">Invoice Date</label>
                  <div className="relative">
                      <input 
                          type="date"
                          className="input-dark w-full text-sm [color-scheme:dark]"
                          value={issueDate}
                          onChange={(e) => setIssueDate(e.target.value)}
                      />
                  </div>
                </div>
                
                <div className="space-y-2 md:col-start-2">
                  <label className="text-sm font-medium text-gray-300 block">Due Date</label>
                  <div className="relative">
                      <input 
                          type="date"
                          className="input-dark w-full text-sm [color-scheme:dark]"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                      />
                  </div>
                </div>
            </div>
          </section>

          {/* Line Items Panel */}
          <section className="glass-panel p-6">
            <div className="border-b border-white/5 pb-4 mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-cyan-400" />
                    Line Items
                </h2>
            </div>
            
            <div className="-mx-2 sm:mx-0">
                <InvoiceItemsTable items={items} setItems={setItems} currency={currency} itemCodeLabel={itemCodeLabel} />
            </div>
          </section>

          {/* Notes & Terms */}
          <section className="glass-panel p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Category */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                        <Tag className="w-4 h-4 text-gray-500" />
                        Category
                    </label>
                    <select
                        className="input-dark w-full appearance-none text-sm"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                    >
                        <option value="">Select Category...</option>
                        <option value="3D Printing">3D Printing</option>
                        <option value="Software Development">Software Development</option>
                        <option value="General Consulting">General Consulting</option>
                        <option value="Retainer">Retainer</option>
                        <option value="Other">Other</option>
                    </select>
                </div>

                {/* Remarks */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Remarks & Terms</label>
                    <textarea 
                        placeholder={`e.g. Please pay in ${currency}. Bank charges to be borne by payer.`}
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        className="input-dark w-full h-32 resize-none text-sm"
                    />
                </div>
            </div>
          </section>
        </div>

        {/* Right Column: Summary & Settings (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
            {/* Summary Card */}
            <div className="glass-panel p-6 sticky top-6">
                <div className="border-b border-white/5 pb-4 mb-6">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Calculator className="w-5 h-5 text-cyan-400" />
                        Summary
                    </h2>
                </div>
                
                <div className="space-y-4 font-mono text-sm">
                    <div className="flex justify-between items-center text-gray-400">
                        <span>Subtotal</span>
                        <span className="text-white font-medium">{formatMoney(subtotal)}</span>
                    </div>
                    
                    {/* Tax Breakdown */}
                    {taxData.taxType !== 'NONE' && (
                        <div className="space-y-2 py-3 border-y border-white/5">
                            {taxData.breakdown.cgst > 0 && (
                                <div className="flex justify-between items-center text-gray-400">
                                    <span>CGST ({(taxData.gstRate / 2).toFixed(1)}%)</span>
                                    <span className="text-white font-medium">{formatMoney(taxData.breakdown.cgst)}</span>
                                </div>
                            )}
                            {taxData.breakdown.sgst > 0 && (
                                <div className="flex justify-between items-center text-gray-400">
                                    <span>SGST ({(taxData.gstRate / 2).toFixed(1)}%)</span>
                                    <span className="text-white font-medium">{formatMoney(taxData.breakdown.sgst)}</span>
                                </div>
                            )}
                            {taxData.breakdown.igst > 0 && (
                                <div className="flex justify-between items-center text-gray-400">
                                    <span>IGST ({taxData.gstRate}%)</span>
                                    <span className="text-white font-medium">{formatMoney(taxData.breakdown.igst)}</span>
                                </div>
                            )}
                        </div>
                    )}
                    
                    <div className="pt-4 border-t border-white/10">
                        <div className="flex justify-between items-end">
                            <span className="text-gray-300 font-medium font-sans">Grand Total</span>
                            <span className="text-3xl text-cyan-400 tracking-tight font-bold">
                                {formatMoney(grandTotal)}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-white/5 space-y-4">
                    {/* Bank Selection */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Receiving Bank Account</label>
                        <select
                            className="input-dark w-full appearance-none bg-white/5 text-sm"
                            value={selectedBankId}
                            onChange={handleBankChange}
                        >
                            <option value="">Select Bank...</option>
                            {banks.map(bank => (
                                <option key={bank.id} value={bank.id}>
                                    {bank.label} ({bank.currency})
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 pt-1">
                            Selecting a bank auto-sets the currency below.
                        </p>
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
                                className="input-dark w-full border-cyan-500/30 bg-cyan-500/5 focus:border-cyan-400 focus:ring-cyan-400"
                                value={exchangeRate}
                                onChange={e => setExchangeRate(Number(e.target.value))}
                            />
                            <p className="text-xs text-gray-500 pt-1">
                                1 {currency} = ₹{exchangeRate.toFixed(2)}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}

export default function EditInvoicePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-cyan-400"/></div>}>
      <EditInvoiceContent />
    </Suspense>
  );
}