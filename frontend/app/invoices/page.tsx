"use client";

import React, { useEffect, useState, useMemo } from 'react';
import api from "@/lib/api";
import { 
  Plus, MoreHorizontal, Loader2, Search, Calendar as CalendarIcon, X
} from "lucide-react";
import Link from "next/link";
import { 
  format, isWithinInterval, startOfDay, endOfDay,
  startOfMonth, startOfQuarter, startOfYear
} from "date-fns";
import { useRouter } from 'next/navigation';
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast-context";
import MarkAsPaidDialog from '@/components/invoices/MarkAsPaidDialog';
import { generateInvoicePdfBlob } from '@/lib/pdfGenerator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Invoice {
  id: number;
  invoice_number: string;
  issue_date: string;
  grand_total: string;
  status: string;
  currency?: string;
  exchange_rate?: number;
  category?: string;
  client: {
    company_name: string;
    email?: string;
  };
}

export default function InvoiceListPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // --- FILTER STATE ---
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  
  // Mutually Exclusive Date Logic
  const [periodFilter, setPeriodFilter] = useState("ALL");
  const [dateRange, setDateRange] = useState<{from?: Date, to?: Date} | undefined>();
  const [dropdownOpen, setDropdownOpen] = useState<number | null>(null);

  // --- PAYMENT DIALOG STATE ---
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);

  // --- 1. LOAD DATA ---
  const fetchInvoices = async () => {
    try {
      const res = await api.get('/invoices?limit=500');
      setInvoices(res.data.data || []);
    } catch (err) {
      console.error("Failed to load invoices", err);
      toast("Failed to load invoices", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  // --- 2. CALCULATE FINANCIAL YEARS ---
  const availableFYs = useMemo(() => {
      const years = new Set<number>();
      const currentYear = new Date().getFullYear();
      years.add(currentYear);
      
      invoices.forEach(inv => {
          const d = new Date(inv.issue_date);
          const month = d.getMonth();
          const year = d.getFullYear();
          // FY Logic: If Jan-Mar (0-2), it belongs to previous year's FY start
          years.add(month < 3 ? year - 1 : year);
      });
      return Array.from(years).sort((a, b) => b - a);
  }, [invoices]);

  // --- 3. FILTER HANDLERS (Mutually Exclusive) ---
  const handlePeriodChange = (val: string) => {
      setPeriodFilter(val);
      setDateRange(undefined); // Clear Range when Preset is chosen
  };

  // --- Helper: Format Currency correctly ---
  const formatMoney = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // --- 4. FILTERING LOGIC ---
  useEffect(() => {
    let temp = invoices;

    // A. Search
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        temp = temp.filter(inv => 
            inv.invoice_number.toLowerCase().includes(lower) || 
            inv.client.company_name.toLowerCase().includes(lower)
        );
    }

    // B. Status
    if (statusFilter !== "ALL") {
        temp = temp.filter(inv => inv.status === statusFilter);
    }

    // C. Date Filter (Mutually Exclusive)
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = endOfDay(now);

    if (dateRange?.from) {
        // CASE 1: Custom Range
        start = startOfDay(dateRange.from);
        end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
    } else if (periodFilter !== "CUSTOM" && periodFilter !== "ALL") {
        // CASE 2: Preset Period
        if (periodFilter.startsWith("FY-")) {
            const startYear = parseInt(periodFilter.split("-")[1]);
            start = new Date(startYear, 3, 1); // April 1st
            end = new Date(startYear + 1, 2, 31, 23, 59, 59); // March 31st next year
        } else {
             switch (periodFilter) {
                case 'monthly': start = startOfMonth(now); break;
                case 'quarterly': start = startOfQuarter(now); break;
                case 'yearly': start = startOfYear(now); break;
            }
        }
    }

    if (start && end) {
        temp = temp.filter(inv => isWithinInterval(new Date(inv.issue_date), { start, end: end! }));
    }

    setFilteredInvoices(temp);
  }, [invoices, searchTerm, statusFilter, periodFilter, dateRange]);

  // --- ACTION HANDLERS ---
  const handleViewPdf = async (id: number) => {
    try {
      setActionLoadingId(id);
      const blob = await generateInvoicePdfBlob(id);
      const pdfUrl = window.URL.createObjectURL(blob);
      window.open(pdfUrl, '_blank');
    } catch (e) { 
        toast("Failed to load PDF.", "error"); 
        console.error(e);
    } finally { 
        setActionLoadingId(null); 
    }
  };

  const handleDownloadPdf = async (id: number, num: string) => {
    try {
      setActionLoadingId(id);
      const blob = await generateInvoicePdfBlob(id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice-${num}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) { 
        toast("Failed to download PDF", "error"); 
        console.error(e);
    } finally { 
        setActionLoadingId(null); 
    }
  };

  const handleSendEmail = async (inv: Invoice) => {
    if (!inv.client.email) {
        return toast("Client has no registered email address.", "error");
    }

    setActionLoadingId(inv.id);
    try { 
        // 1. Generate PDF on frontend
        const blob = await generateInvoicePdfBlob(inv.id);
        
        // 2. Prepare Form Data
        const formData = new FormData();
        formData.append('email', inv.client.email);
        formData.append('file', blob, `invoice-${inv.invoice_number}.pdf`);

        // 3. Send to backend
        await api.post(`/mail/invoice/${inv.id}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        }); 
        
        toast(`Email sent to ${inv.client.email}`, "success");
        if (inv.status === 'DRAFT') handleStatusChange(inv.id, 'SENT');
    } 
    catch (e) { 
        toast("Failed to send email", "error"); 
        console.error(e);
    } finally { 
        setActionLoadingId(null); 
    }
  };

  const handleStatusChange = async (id: number, status: string) => {
    try { 
        await api.patch(`/invoices/${id}/status`, { status }); 
        setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status } : inv));
        toast(`Status updated to ${status}`, "success");
    } 
    catch (e) { 
        toast("Failed to update status", "error"); 
    }
  };

  // --- NEW: Handle Success from Child Component ---
  const handlePaymentSuccess = () => {
    toast("Payment recorded successfully", "success");
    setSelectedInvoiceForPayment(null); // Close Dialog
    fetchInvoices(); // Refresh List to show 'PAID' status
  };

  const handleDelete = async (id: number) => {
      if (!confirm("Are you sure you want to delete this invoice? This action cannot be undone.")) return;
      try {
          await api.delete(`/invoices/${id}`);
          setInvoices(prev => prev.filter(inv => inv.id !== id));
          toast("Invoice deleted successfully", "success");
      } catch (e) {
          toast("Failed to delete invoice", "error");
      }
  };

  const handleDeletePdf = async (id: number) => {
      try {
          await api.delete(`/invoices/${id}/pdf`);
          toast("Cached PDF deleted", "success");
      } catch {
          toast("Failed to delete cached PDF", "error");
      }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Page Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Invoices</h1>
          <p className="text-gray-400">Manage and track client billing</p>
        </div>
        <Link href="/invoices/new">
          <button className="btn-primary flex items-center">
            <Plus className="w-4 h-4 mr-2" /> Create Invoice
          </button>
        </Link>
      </div>

      {/* FILTER BAR */}
      <div className="flex flex-col xl:flex-row gap-4 glass-panel p-4 items-center">
         {/* Search */}
         <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
                placeholder="Search Invoice # or Client..." 
                className="input-dark w-full pl-10"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
         </div>
         
         <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            {/* Status Filter */}
            <div className="relative w-[140px]">
                <select 
                    className="input-dark w-full appearance-none text-sm"
                    value={statusFilter} 
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="ALL">All Status</option>
                    <option value="PAID">Paid</option>
                    <option value="SENT">Sent</option>
                    <option value="SHARED">Shared</option>
                    <option value="DRAFT">Draft</option>
                    <option value="OVERDUE">Overdue</option>
                </select>
            </div>

            {/* PRESET SELECTOR (Month, Quarter, FY) */}
            <div className="relative w-[150px]">
                <select 
                    className="input-dark w-full appearance-none text-sm"
                    value={periodFilter} 
                    onChange={(e) => handlePeriodChange(e.target.value)}
                >
                    <option value="ALL">All Time</option>
                    <option value="monthly">This Month</option>
                    <option value="quarterly">This Quarter</option>
                    <option value="yearly">This Year</option>
                    {availableFYs.map(year => (
                        <option key={year} value={`FY-${year}`}>FY {year}-{year.toString().slice(-2) === '99' ? '00' : (year+1).toString().slice(-2)}</option>
                    ))}
                </select>
            </div>

            <span className="text-gray-500 text-xs font-bold uppercase px-1">OR</span>

            {/* Date Range Picker (Native) */}
            <div className="flex items-center gap-2">
                <input 
                    type="date"
                    className="input-dark w-[130px] text-xs"
                    value={dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : ''}
                    onChange={(e) => {
                        const from = e.target.value ? new Date(e.target.value) : undefined;
                        setDateRange(prev => ({ ...prev, from }));
                        if (from) setPeriodFilter("CUSTOM");
                    }}
                />
                <span className="text-gray-500 text-sm">-</span>
                <input 
                    type="date"
                    className="input-dark w-[130px] text-xs"
                    value={dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : ''}
                    onChange={(e) => {
                        const to = e.target.value ? new Date(e.target.value) : undefined;
                        setDateRange(prev => ({ ...prev, to }));
                        if (to) setPeriodFilter("CUSTOM");
                    }}
                />
            </div>

            {/* Clear Filter Button */}
            {(dateRange?.from || dateRange?.to || periodFilter !== 'ALL') && (
                <button 
                    className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors" 
                    onClick={() => {
                        setDateRange(undefined);
                        handlePeriodChange('ALL');
                    }}
                >
                    <X className="w-4 h-4" />
                </button>
            )}
         </div>
      </div>

      {/* TABLE */}
      <div className="glass-panel overflow-hidden min-w-0">
          <div className="overflow-x-auto">
            {loading ? (
                <div className="p-10 text-center text-gray-400 flex justify-center items-center">
                    <Loader2 className="animate-spin w-5 h-5 mr-3 text-cyan-400" /> Loading records...
                </div>
            ) : (
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-white/5 bg-white/[0.02]">
                            <th className="p-4 text-xs font-medium text-gray-300 uppercase tracking-wider">Invoice #</th>
                            <th className="p-4 text-xs font-medium text-gray-300 uppercase tracking-wider">Category</th>
                            <th className="p-4 text-xs font-medium text-gray-300 uppercase tracking-wider">Client</th>
                            <th className="p-4 text-xs font-medium text-gray-300 uppercase tracking-wider">Date</th>
                            <th className="p-4 text-xs font-medium text-gray-300 uppercase tracking-wider text-right">Amount</th>
                            <th className="p-4 text-xs font-medium text-gray-300 uppercase tracking-wider text-center">Status</th>
                            <th className="p-4 text-xs font-medium text-gray-300 uppercase tracking-wider text-right"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {filteredInvoices.length === 0 && (
                            <tr><td colSpan={7} className="text-center py-10 text-gray-400">No invoices match your filters.</td></tr>
                        )}
                        
                        {filteredInvoices.map((inv) => (
                            <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors">
                                <td className="p-4 font-mono text-sm text-white whitespace-nowrap">{inv.invoice_number}</td>
                                <td className="p-4">
                                    {inv.category ? (
                                        <span className="bg-cyan-500/10 text-cyan-400 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border border-cyan-500/20 whitespace-nowrap">
                                            {inv.category}
                                        </span>
                                    ) : (
                                        <span className="text-gray-500 text-[10px] uppercase tracking-wider italic">None</span>
                                    )}
                                </td>
                                <td className="p-4 font-medium text-sm text-white">{inv.client?.company_name}</td>
                                <td className="p-4 text-sm text-gray-400 whitespace-nowrap">{format(new Date(inv.issue_date), "dd MMM yyyy")}</td>
                                
                                {/* --- CURRENCY AWARE AMOUNT COLUMN --- */}
                                <td className="p-4 text-right">
                                    <div className="flex flex-col items-end">
                                        <span className="font-medium text-sm text-white whitespace-nowrap">
                                            {formatMoney(Number(inv.grand_total), inv.currency || 'INR')}
                                        </span>
                                        {/* Show Approximate Ledger Value if Foreign Currency */}
                                        {inv.currency && inv.currency !== 'INR' && inv.exchange_rate && (
                                            <span className="text-[10px] text-gray-500 font-normal whitespace-nowrap">
                                                ≈ {formatMoney(Number(inv.grand_total) * Number(inv.exchange_rate), 'INR')}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                
                                <td className="p-4 text-center">
                                    <span className={cn(
                                        "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border shadow-sm whitespace-nowrap",
                                        inv.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-500/10' : '',
                                        inv.status === 'SENT' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 shadow-indigo-500/10' : '',
                                        inv.status === 'SHARED' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-purple-500/10' : '',
                                        inv.status === 'DRAFT' ? 'bg-white/10 text-gray-300 border-white/20' : '',
                                        inv.status === 'OVERDUE' ? 'bg-red-500/10 text-red-400 border-red-500/20 shadow-red-500/10' : ''
                                    )}>
                                        {inv.status}
                                    </span>
                                </td>
                                
                                <td className="p-4 text-right relative">
                                    <div className="flex justify-end items-center gap-1">
                                        <button className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors" onClick={() => handleViewPdf(inv.id)}>
                                            {actionLoadingId === inv.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>}
                                        </button>
                                        <Link href={`/invoices/view?id=${inv.id}`}>
                                            <button className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
                                        </Link>
                                        
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors outline-none focus:outline-none focus:ring-0">
                                                    <MoreHorizontal className="w-4 h-4" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48 glass-panel border-white/10 p-0 rounded-lg overflow-hidden shadow-xl !bg-[#1a1f2e]/80 backdrop-blur-xl">
                                                <DropdownMenuItem className="w-full text-left px-4 py-2.5 text-sm text-gray-200 focus:bg-white/10 transition-colors cursor-pointer rounded-none border-0" onClick={() => handleDownloadPdf(inv.id, inv.invoice_number)}>Download PDF</DropdownMenuItem>
                                                <DropdownMenuItem className="w-full text-left px-4 py-2.5 text-sm text-gray-200 focus:bg-white/10 transition-colors cursor-pointer rounded-none border-0" onClick={() => handleSendEmail(inv)}>Send Email</DropdownMenuItem>
                                                <DropdownMenuItem className="w-full text-left px-4 py-2.5 text-sm text-gray-200 focus:bg-white/10 transition-colors cursor-pointer rounded-none border-0" onClick={() => setSelectedInvoiceForPayment(inv)}>Mark Paid</DropdownMenuItem>
                                                <DropdownMenuItem className="w-full text-left px-4 py-2.5 text-sm text-gray-200 focus:bg-white/10 transition-colors cursor-pointer rounded-none border-0" onClick={() => handleStatusChange(inv.id, 'SHARED')}>Mark Shared</DropdownMenuItem>
                                                <DropdownMenuItem className="w-full text-left px-4 py-2.5 text-sm text-gray-200 focus:bg-white/10 transition-colors cursor-pointer rounded-none border-0" onClick={() => handleStatusChange(inv.id, 'DRAFT')}>Mark Draft</DropdownMenuItem>
                                                <DropdownMenuSeparator className="bg-white/10 m-0" />
                                                <DropdownMenuItem className="w-full text-left px-4 py-2.5 text-sm text-gray-200 focus:bg-white/10 transition-colors cursor-pointer rounded-none border-0" onClick={() => handleDeletePdf(inv.id)}>Delete Cached PDF</DropdownMenuItem>
                                                <DropdownMenuItem className="w-full text-left px-4 py-2.5 text-sm text-red-400 focus:bg-red-400/10 focus:text-red-400 transition-colors cursor-pointer rounded-none border-0" onClick={() => handleDelete(inv.id)}>Delete</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
          </div>
      </div>

      {/* --- PAYMENT DIALOG --- */}
      {selectedInvoiceForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md p-6 flex flex-col gap-6 relative">
            <button 
              onClick={() => setSelectedInvoiceForPayment(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Record Payment</h2>
              <p className="text-sm text-gray-400">
                Enter the actual INR amount received for this invoice.
              </p>
            </div>
            
            <MarkAsPaidDialog 
                invoiceId={selectedInvoiceForPayment.id}
                outstandingBalance={Number(selectedInvoiceForPayment.grand_total)}
                currencySymbol={selectedInvoiceForPayment.currency || 'INR'}
                onSuccess={handlePaymentSuccess}
            />
          </div>
        </div>
      )}

    </div>
  );
}