"use client";

import React, { useState, useEffect } from 'react';
import { Save, Loader2, PlusCircle, Calendar as CalendarIcon, User, Hash, Tag, FileText, CheckCircle2, ChevronRight, Calculator, Building } from "lucide-react";
import { InvoiceItemsTable, LineItem } from "./invoice-items";
import api from "@/lib/api"; 
import Link from "next/link";
import { useRouter } from 'next/navigation';
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

export default function NewInvoicePage() {
  const router = useRouter();
  const { toast } = useToast();

  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>("");
  
  const [isManual, setIsManual] = useState(false);
  const [manualNumber, setManualNumber] = useState("");
  const [remarks, setRemarks] = useState("");
  const [category, setCategory] = useState("");

  const [clients, setClients] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]); 
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  
  // Multi-Currency State
  const [currency, setCurrency] = useState("INR");
  const [exchangeRate, setExchangeRate] = useState<number>(1.0);

  const [isCalculating, setIsCalculating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [items, setItems] = useState<LineItem[]>([
    { id: 1, description: "Service Charge", hsn: "", quantity: 1, rate: 0, amount: 0 }
  ]);
  const [subtotal, setSubtotal] = useState(0);
  const [taxData, setTaxData] = useState({
    tax_type: "NONE", rate: 0, amount: 0, taxes: {} as Record<string, number>
  });
  const [grandTotal, setGrandTotal] = useState(0);
  const [itemCodeLabel, setItemCodeLabel] = useState("Item Code / HSN");

  // --- Fetch Data ---
  useEffect(() => {
    const fetchData = async () => {
        try {
            const [clientsRes, banksRes, localizationRes] = await Promise.all([
                api.get('/clients?limit=500'),
                api.get('/banks?limit=200'),
                api.get('/settings/LOCALIZATION')
            ]);
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
            
            // Auto-select default bank and set its currency
            const defaultBank = (banksRes.data.data || []).find((b:any) => b.is_default);
            if (defaultBank) {
                setSelectedBankId(defaultBank.id);
                setCurrency(defaultBank.currency);
            }
        } catch (e) {
            console.error(e);
        }
    };
    fetchData();
  }, []);

  // --- Handle Bank Change ---
  const handleBankChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const bankId = e.target.value;
    setSelectedBankId(bankId);
    
    const bank = banks.find(b => b.id.toString() === bankId);
    if (bank) {
        setCurrency(bank.currency);
    }
  };

  // --- Calculations ---
  useEffect(() => {
    const newSubtotal = items.reduce((sum, item) => sum + item.amount, 0);
    setSubtotal(newSubtotal);
  }, [items]);

  useEffect(() => {
    const fetchTaxLogic = async () => {
      if (!selectedClientId) return;
      const client = clients.find(c => c.id.toString() === selectedClientId);
      if (!client) return;

      setIsCalculating(true);
      try {
        const response = await api.post('/invoices/calculate-tax', {
          clientStateCode: client.state_code,
          clientCountry: client.country
        });
        const backendTax = response.data; 
        
        setTaxData({
            tax_type: backendTax.tax_type || "NONE",
            rate: backendTax.rate || 0,
            amount: backendTax.amount || 0,
            taxes: backendTax.taxes || {}
        });
      } catch (error) {
        console.error(error);
      } finally {
        setIsCalculating(false);
      }
    };
    fetchTaxLogic();
  }, [selectedClientId, subtotal, clients]);

  useEffect(() => {
    setGrandTotal(subtotal + taxData.amount);
  }, [subtotal, taxData]);

  // --- Save Handler ---
  const handleSave = async () => {
    if (!selectedClientId) return toast("Select a client", "error");
    if (!selectedBankId) return toast("Select a bank account for payment details", "error");
    if (items.length === 0 || subtotal === 0) return toast("Add items", "error");

    try {
      setIsSaving(true);
      const payload = {
        client_id: Number(selectedClientId),
        bank_account_id: Number(selectedBankId),
        issue_date: issueDate ? new Date(issueDate).toISOString() : undefined,
        due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
        line_items: items,
        remarks: remarks,
        category: category || undefined,
        currency,
        exchange_rate: exchangeRate,
        is_manual_entry: isManual,
        invoice_number: isManual ? manualNumber : undefined,
      };

      const response = await api.post('/invoices', payload);
      
      toast(`Success! Invoice ${response.data.invoice_number} Created`, "success");
      router.push('/invoices');

    } catch (error: any) {
      console.error(error);
      toast(error.response?.data?.error || "Failed to save invoice", "error");
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

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto space-y-6">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
        <div>
            <div className="flex items-center gap-2 mb-1">
                <Link href="/invoices" className="text-gray-400 hover:text-white transition-colors">Invoices</Link>
                <ChevronRight className="w-4 h-4 text-gray-600" />
                <span className="text-cyan-400 font-medium">New Draft</span>
            </div>
            <h1 className="text-3xl font-bold text-white">Create Invoice</h1>
            <p className="text-sm text-gray-400">Generate a new billing document</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleSave} disabled={isSaving} className="btn-primary shadow-lg shadow-cyan-500/20">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Invoice
          </button>
        </div>
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
                    <Link href="/clients/new" className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center">
                        <PlusCircle className="w-3 h-3 mr-1" /> New Client
                    </Link>
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
                
                {/* Manual Override */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between mb-0.5">
                        <label className="text-sm font-medium text-gray-300">Invoice Number</label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-400 hover:text-gray-300">
                            <input 
                                type="checkbox" 
                                className="rounded border-gray-600 bg-white/5 text-cyan-500 focus:ring-cyan-500/20"
                                checked={isManual}
                                onChange={(e) => setIsManual(e.target.checked)} 
                            />
                            Manual Mode
                        </label>
                    </div>
                    <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input 
                          value={isManual ? manualNumber : "Auto-generated"} 
                          onChange={(e) => setManualNumber(e.target.value)}
                          disabled={!isManual}
                          className={!isManual ? "input-dark w-full pl-10 bg-white/[0.02] cursor-not-allowed text-gray-500" : "input-dark w-full pl-10"}
                        />
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
                    {taxData.tax_type !== 'NONE' && Object.keys(taxData.taxes).length > 0 && (
                        <div className="space-y-2 py-3 border-y border-white/5">
                            {Object.entries(taxData.taxes).map(([taxName, amount]) => (
                                <div key={taxName} className="flex justify-between items-center text-gray-400">
                                    <span>{taxName}</span>
                                    <span className="text-white font-medium">{formatMoney(amount)}</span>
                                </div>
                            ))}
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