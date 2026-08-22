"use client";

import React, { useState, useEffect } from 'react';
import { Save, Loader2, PlusCircle, Calendar as CalendarIcon, User, Building, Clock, Mail } from "lucide-react";
import { InvoiceItemsTable, LineItem } from "../../invoices/new/invoice-items";
import api from "@/lib/api"; 
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { useToast } from "@/components/ui/toast-context";
import { AVAILABLE_CURRENCIES } from "@/lib/currencies";

export default function NewSubscriptionPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [frequency, setFrequency] = useState("MONTHLY");
  const [nextRunDate, setNextRunDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [autoEmail, setAutoEmail] = useState(false);
  
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
    { id: 1, description: "Subscription Charge", hsn: "", quantity: 1, rate: 0, amount: 0 }
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
            
            // Auto-select default bank
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
    
    if (bankId) {
      const bank = banks.find(b => b.id.toString() === bankId);
      if (bank && bank.currency) {
        setCurrency(bank.currency);
      }
    }
  };

  // --- Live Calculations ---
  useEffect(() => {
    const calculateTotals = async () => {
      if (!selectedClientId || items.length === 0) return;

      const newSubtotal = items.reduce((acc, item) => acc + (item.amount || 0), 0);
      setSubtotal(newSubtotal);

      setIsCalculating(true);
      try {
        const res = await api.post('/invoices/calculate-tax', {
          client_id: parseInt(selectedClientId),
          subtotal: newSubtotal
        });
        setTaxData(res.data);
        setGrandTotal(res.data.grand_total);
      } catch (err) {
        console.error("Tax calc failed", err);
      } finally {
        setIsCalculating(false);
      }
    };
    
    const timeout = setTimeout(calculateTotals, 500);
    return () => clearTimeout(timeout);
  }, [items, selectedClientId]);

  // --- Save Subscription ---
  const handleSave = async () => {
    if (!selectedClientId) return toast("Please select a client", "error");
    if (!selectedBankId) return toast("Please select a bank account", "error");
    if (items.length === 0 || items.some(i => !i.description || i.amount <= 0)) {
        return toast("Please provide valid line items", "error");
    }

    setIsSaving(true);
    
    // We assume the base currency is INR for this instance
    const payload = {
      client_id: parseInt(selectedClientId),
      bank_account_id: parseInt(selectedBankId),
      currency: currency,
      base_currency: "INR",
      exchange_rate: Number(exchangeRate),
      status: "ACTIVE",
      frequency: frequency,
      next_run_date: nextRunDate + "T00:00:00Z",
      auto_email: autoEmail,
      line_items: items,
      tax_summary: taxData,
      subtotal: subtotal,
      grand_total: grandTotal,
      remarks: remarks,
      category: category,
    };

    try {
      await api.post('/subscriptions', payload);
      toast("Subscription created successfully", "success");
      router.push('/subscriptions');
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to create subscription", "error");
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-headline-sm text-headline-sm font-bold text-on-surface">New Subscription</h1>
          <p className="text-on-surface-variant mt-1 text-sm">Create a recurring billing profile</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column - Core Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card space-y-6 shadow-sm border-surface-variant/30">
            <h2 className="text-lg font-bold text-on-surface mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-primary" /> Client Details
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-on-surface-variant">Client <span className="text-red-500">*</span></label>
                <select 
                  className="input w-full"
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                >
                  <option value="">Select a Client</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.company_name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-on-surface-variant">Receiving Bank <span className="text-red-500">*</span></label>
                <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                    <select 
                    className="input w-full pl-10"
                    value={selectedBankId}
                    onChange={handleBankChange}
                    >
                    <option value="">Select a Bank Account</option>
                    {banks.map(b => (
                        <option key={b.id} value={b.id}>{b.bank_name} ({b.account_number.slice(-4)}) - {b.currency}</option>
                    ))}
                    </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-surface-variant/20">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-on-surface-variant">Currency</label>
                <select 
                  className="input w-full"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  {Object.entries(AVAILABLE_CURRENCIES).map(([code, name]) => (
                    <option key={code} value={code}>{code} - {name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-on-surface-variant">Exchange Rate (to Base)</label>
                <input 
                  type="number" 
                  className="input w-full"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(parseFloat(e.target.value))}
                  step="0.0001"
                  min="0"
                />
              </div>
            </div>
          </div>

          <div className="card space-y-4 shadow-sm border-surface-variant/30 overflow-visible relative z-10">
            <h2 className="text-lg font-bold text-on-surface mb-2">Line Items</h2>
            <InvoiceItemsTable items={items} setItems={setItems} currencyCode={currency} itemCodeLabel={itemCodeLabel} />
          </div>

          <div className="card space-y-4 shadow-sm border-surface-variant/30">
             <div className="space-y-1.5">
                <label className="text-sm font-medium text-on-surface-variant">Remarks / Notes</label>
                <textarea 
                  className="input w-full min-h-[100px] resize-y"
                  placeholder="Terms, conditions, or payment instructions for this subscription..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                ></textarea>
              </div>
          </div>
        </div>

        {/* Right Column - Settings & Totals */}
        <div className="space-y-6">
          <div className="card space-y-4 shadow-sm border-surface-variant/30">
             <h2 className="text-lg font-bold text-on-surface mb-2 flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" /> Schedule
            </h2>

            <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-on-surface-variant">Billing Frequency</label>
                  <select 
                    className="input w-full"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                  >
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-on-surface-variant">Start / Next Run Date</label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                    <input 
                      type="date" 
                      className="input w-full pl-10"
                      value={nextRunDate}
                      onChange={(e) => setNextRunDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                    <input 
                        type="checkbox" 
                        id="autoEmail"
                        checked={autoEmail}
                        onChange={(e) => setAutoEmail(e.target.checked)}
                        className="w-4 h-4 rounded text-primary focus:ring-primary border-surface-variant"
                    />
                    <label htmlFor="autoEmail" className="text-sm font-medium text-on-surface-variant flex items-center gap-2 cursor-pointer">
                        <Mail className="w-4 h-4" /> Send Invoice to Client Automatically
                    </label>
                </div>
            </div>
          </div>

          {/* Totals Summary */}
          <div className="card shadow-sm border-surface-variant/30">
            <h3 className="font-bold text-on-surface mb-4">Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center text-on-surface-variant">
                <span>Subtotal</span>
                <span>{subtotal.toFixed(2)}</span>
              </div>
              
              {isCalculating ? (
                 <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
              ) : (
                <>
                  {taxData.rate > 0 && (
                    Object.entries(taxData.taxes).map(([tName, tAmt]) => (
                      <div key={tName} className="flex justify-between items-center text-on-surface-variant">
                        <span>{tName}</span>
                        <span>{tAmt.toFixed(2)}</span>
                      </div>
                    ))
                  )}
                  <div className="pt-3 border-t border-surface-variant/30 flex justify-between items-center font-bold text-lg text-on-surface">
                    <span>Total Amount</span>
                    <span>{currency} {grandTotal.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>
            
            <button 
              onClick={handleSave} 
              disabled={isSaving || isCalculating || items.length === 0}
              className="btn-primary w-full mt-6 py-3 flex justify-center items-center gap-2 shadow-lg shadow-primary/20"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {isSaving ? "Saving..." : "Create Subscription"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
