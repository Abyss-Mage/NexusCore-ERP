"use client";

import React, { useEffect, useState, useMemo } from 'react';
import api from "@/lib/api";
import { 
  Plus, FileText, Loader2, Trash2, Eye, Pencil, Search, Calendar as CalendarIcon, X, MoreHorizontal, Download, Send, CheckCircle2, FileX 
} from "lucide-react";
import Link from "next/link";
import { 
  format, isWithinInterval, startOfDay, endOfDay, 
  startOfMonth, startOfQuarter, startOfYear 
} from "date-fns";
import { cn } from "@/lib/utils";
import { AVAILABLE_CURRENCIES } from "@/lib/currencies";
import { generateQuotationPdfBlob } from '@/lib/pdfGenerator';
import { useToast } from "@/components/ui/toast-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Types
interface QuoteItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface Quotation {
  id: number;
  quotation_number: string;
  issue_date: string;
  expiry_date?: string;
  grand_total: string;
  subtotal: string;
  currency?: string; 
  client: { 
    company_name: string;
    email?: string;
    phone?: string;
  };
  line_items: QuoteItem[] | string; 
  services_offered?: string;
  contract_terms?: string;
  remarks?: string;
}

export default function QuotationListPage() {
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [filteredQuotes, setFilteredQuotes] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  // --- VIEW MODAL STATE ---
  const [selectedQuote, setSelectedQuote] = useState<Quotation | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState<number | null>(null);

  // --- FILTER STATE ---
  const [searchTerm, setSearchTerm] = useState("");
  
  // Mutually Exclusive Date Logic
  const [periodFilter, setPeriodFilter] = useState("ALL"); 
  const [dateRange, setDateRange] = useState<{from?: Date, to?: Date} | undefined>();

  // --- 1. FETCH DATA ---
  const fetchData = async () => {
    try {
      const res = await api.get('/quotations?limit=500');
      setQuotes(res.data.data || []);
      setFilteredQuotes(res.data.data || []);
    } catch (err) {
      console.error("Failed to load data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- 2. CALCULATE FINANCIAL YEARS ---
  const availableFYs = useMemo(() => {
      const years = new Set<number>();
      const currentYear = new Date().getFullYear();
      years.add(currentYear);
      
      quotes.forEach(q => {
          const d = new Date(q.issue_date);
          const month = d.getMonth();
          const year = d.getFullYear();
          // FY Logic: If Jan-Mar (0-2), it belongs to previous year's FY start
          years.add(month < 3 ? year - 1 : year);
      });
      return Array.from(years).sort((a, b) => b - a);
  }, [quotes]);

  // --- 3. FILTER HANDLERS (Mutually Exclusive) ---
  const handlePeriodChange = (val: string) => {
      setPeriodFilter(val);
      setDateRange(undefined); // Clear Range when Preset is chosen
  };

  // --- 4. FILTER LOGIC ---
  useEffect(() => {
    let temp = quotes;

    // Search
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        temp = temp.filter(q => 
            q.quotation_number.toLowerCase().includes(lower) || 
            q.client.company_name.toLowerCase().includes(lower)
        );
    }

    // Date Logic (Mutually Exclusive)
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

    // Apply Date Filter if Start/End are set
    if (start && end) {
        temp = temp.filter(q => isWithinInterval(new Date(q.issue_date), { start, end: end! }));
    }

    setFilteredQuotes(temp);
  }, [quotes, searchTerm, periodFilter, dateRange]);

  // --- 5. ACTIONS ---
  const handleDelete = async (id: number) => {
      if (!confirm("Delete this quotation?")) return;
      try {
          await api.delete(`/quotations/${id}`);
          setQuotes(prev => prev.filter(q => q.id !== id));
          toast("Quotation deleted", "success");
      } catch (e) {
          toast("Failed to delete", "error");
      }
  };

  const openView = (quote: Quotation) => {
      const parsedItems = typeof quote.line_items === 'string' 
          ? JSON.parse(quote.line_items) 
          : quote.line_items;
      
      setSelectedQuote({ ...quote, line_items: parsedItems });
      setIsViewOpen(true);
  };

  const handleDownloadPdf = async (id: number, quotationNumber: string) => {
    try {
      const blob = await generateQuotationPdfBlob(id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${quotationNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast("Failed to generate PDF", "error");
      console.error(e);
    }
  };

  const handleSendEmail = async (q: Quotation) => {
    const email = q.client?.email;
    if (!email) return toast("Client has no email address", "error");
    try {
      const blob = await generateQuotationPdfBlob(q.id);
      const formData = new FormData();
      formData.append('email', email);
      formData.append('file', blob, `quotation-${q.quotation_number}.pdf`);
      
      await api.post(`/mail/quotation/${q.id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast(`Quotation sent to ${email}`, "success");
      fetchData();
    } catch (e) {
      toast("Failed to send email. Check SMTP settings.", "error");
      console.error(e);
    }
  };

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await api.patch(`/quotations/${id}/status`, { status });
      toast("Status updated", "success");
      fetchData();
    } catch {
      toast("Failed to update status", "error");
    }
  };

  const handleDeletePdf = async (id: number) => {
    try {
      await api.delete(`/quotations/${id}/pdf`);
      toast("Cached PDF deleted", "success");
    } catch {
      toast("Failed to delete PDF", "error");
    }
  };

  // UPDATED: Dynamic Currency Formatting
  const formatCurrency = (amount: number | string, currencyCode: string = "INR") => {
      const selectedCurr = AVAILABLE_CURRENCIES.find(c => c.code === currencyCode);
      return new Intl.NumberFormat(selectedCurr?.locale || 'en-IN', { 
          style: 'currency', 
          currency: currencyCode 
      }).format(Number(amount));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Quotations</h1>
          <p className="text-gray-400">Manage estimates and proposals</p>
        </div>
        
        <Link href="/quotations/new">
            <button className="btn-primary flex items-center">
                <Plus className="w-4 h-4 mr-2" /> Create Quote
            </button>
        </Link>
      </div>

      {/* FILTERS BAR */}
      <div className="flex flex-col xl:flex-row gap-4 glass-panel p-4 items-center">
          {/* Search */}
          <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input 
                placeholder="Search Quote # or Client..." 
                className="input-dark w-full pl-10" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
              />
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
             {/* PRESET SELECTOR */}
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
             
             {/* Clear Button */}
             {(dateRange?.from || dateRange?.to || periodFilter !== 'ALL') && (
                 <button 
                    className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors" 
                    onClick={() => { setDateRange(undefined); handlePeriodChange('ALL'); }}
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
                    <Loader2 className="animate-spin w-5 h-5 mr-3 text-cyan-400" /> Loading...
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.02]">
                      <th className="p-4 text-xs font-medium text-gray-300 uppercase tracking-wider">Quote #</th>
                      <th className="p-4 text-xs font-medium text-gray-300 uppercase tracking-wider">Client</th>
                      <th className="p-4 text-xs font-medium text-gray-300 uppercase tracking-wider">Date</th>
                      <th className="p-4 text-xs font-medium text-gray-300 uppercase tracking-wider">Amount</th>
                      <th className="p-4 text-xs font-medium text-gray-300 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredQuotes.length === 0 && (
                       <tr><td colSpan={5} className="text-center py-10 text-gray-400">No quotations match your filters.</td></tr>
                    )}
                    
                    {filteredQuotes.map((q) => (
                      <tr key={q.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-4 font-mono text-sm text-white whitespace-nowrap">{q.quotation_number}</td>
                        <td className="p-4 font-medium text-sm text-white">{q.client?.company_name}</td>
                        <td className="p-4 text-sm text-gray-400 whitespace-nowrap">{format(new Date(q.issue_date), "dd MMM yyyy")}</td>
                        <td className="p-4 font-medium text-sm text-white whitespace-nowrap">
                            {formatCurrency(q.grand_total, q.currency)}
                        </td>
                        
                        <td className="p-4 text-right relative">
                           <div className="flex justify-end items-center gap-1">
                              {/* Quick View */}
                              <button className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors" onClick={() => openView(q)} title="Quick View">
                                <Eye className="w-4 h-4"/>
                              </button>
                              
                              {/* Edit Page Link */}
                              <Link href={`/quotations/view?id=${q.id}`}>
                                <button className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors" title="Edit">
                                    <Pencil className="w-4 h-4"/>
                                </button>
                              </Link>
                              
                              {/* Triple-dot Menu */}
                              <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                      <button className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors outline-none focus:outline-none focus:ring-0">
                                          <MoreHorizontal className="w-4 h-4" />
                                      </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48 glass-panel border-white/10 p-0 rounded-lg overflow-hidden shadow-xl !bg-[#1a1f2e]/80 backdrop-blur-xl">
                                      <DropdownMenuItem className="w-full text-left px-4 py-2.5 text-sm text-gray-200 focus:bg-white/10 transition-colors cursor-pointer rounded-none border-0" onClick={() => handleDownloadPdf(q.id, q.quotation_number)}>
                                        <Download className="w-4 h-4 mr-2" /> Download PDF
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="w-full text-left px-4 py-2.5 text-sm text-gray-200 focus:bg-white/10 transition-colors cursor-pointer rounded-none border-0" onClick={() => handleSendEmail(q)}>
                                        <Send className="w-4 h-4 mr-2" /> Send Email
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator className="bg-white/10 m-0" />
                                      <DropdownMenuItem className="w-full text-left px-4 py-2.5 text-sm text-gray-200 focus:bg-white/10 transition-colors cursor-pointer rounded-none border-0" onClick={() => handleStatusChange(q.id, 'SENT')}>
                                        <Send className="w-4 h-4 mr-2" /> Mark Sent
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="w-full text-left px-4 py-2.5 text-sm text-gray-200 focus:bg-white/10 transition-colors cursor-pointer rounded-none border-0" onClick={() => handleStatusChange(q.id, 'ACCEPTED')}>
                                        <CheckCircle2 className="w-4 h-4 mr-2" /> Mark Accepted
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator className="bg-white/10 m-0" />
                                      <DropdownMenuItem className="w-full text-left px-4 py-2.5 text-sm text-gray-200 focus:bg-white/10 transition-colors cursor-pointer rounded-none border-0" onClick={() => handleDeletePdf(q.id)}>
                                        <FileX className="w-4 h-4 mr-2" /> Delete Cached PDF
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="w-full text-left px-4 py-2.5 text-sm text-red-400 focus:bg-red-400/10 focus:text-red-400 transition-colors cursor-pointer rounded-none border-0" onClick={() => handleDelete(q.id)}>
                                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                                      </DropdownMenuItem>
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

      {/* === VIEW ONLY MODAL === */}
      {isViewOpen && selectedQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="glass-panel w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 relative">
                <button 
                  onClick={() => setIsViewOpen(false)}
                  className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                
                <div className="mb-6 pr-8">
                    <h2 className="text-2xl font-bold text-white mb-1">
                        {selectedQuote.quotation_number}
                    </h2>
                    <p className="text-sm text-gray-400">
                        Issued on {format(new Date(selectedQuote.issue_date), "dd MMMM yyyy")}
                    </p>
                </div>

                <div className="space-y-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-white/[0.02] rounded-xl border border-white/5">
                        <div><p className="text-xs font-semibold text-gray-500 uppercase">Client</p><p className="text-sm font-bold text-white mt-1">{selectedQuote.client.company_name}</p></div>
                        <div><p className="text-xs font-semibold text-gray-500 uppercase">Contact</p><p className="text-sm text-gray-300 mt-1">{selectedQuote.client.phone || "—"}</p><p className="text-sm text-gray-300 mt-1">{selectedQuote.client.email || "—"}</p></div>
                        <div className="md:col-start-4">
                            <p className="text-xs font-semibold text-gray-500 uppercase">Total</p>
                            <p className="text-lg mt-1 font-bold text-cyan-400">
                                {formatCurrency(selectedQuote.grand_total, selectedQuote.currency)}
                            </p>
                        </div>
                    </div>
                    
                    <div>
                        <h3 className="font-bold text-white mb-3 flex items-center gap-2"><FileText className="w-4 h-4 text-cyan-400" /> Items</h3>
                        <div className="rounded-xl border border-white/10 overflow-hidden bg-white/[0.02]">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/10 bg-white/5">
                                        <th className="p-3 text-xs font-medium text-gray-300 w-[50%]">Description</th>
                                        <th className="p-3 text-xs font-medium text-gray-300 text-right">Qty</th>
                                        <th className="p-3 text-xs font-medium text-gray-300 text-right">Rate</th>
                                        <th className="p-3 text-xs font-medium text-gray-300 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {(Array.isArray(selectedQuote.line_items) ? selectedQuote.line_items : []).map((item, idx) => (
                                        <tr key={idx} className="hover:bg-white/[0.02]">
                                            <td className="p-3 text-sm text-white">{item.description}</td>
                                            <td className="p-3 text-sm text-gray-300 text-right">{item.quantity}</td>
                                            <td className="p-3 text-sm text-gray-300 text-right">
                                                {formatCurrency(item.rate, selectedQuote.currency)}
                                            </td>
                                            <td className="p-3 text-sm text-white font-bold text-right">
                                                {formatCurrency(item.amount, selectedQuote.currency)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2"><h4 className="text-sm font-bold text-white">Services</h4><div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-gray-300 min-h-[100px] whitespace-pre-wrap">{selectedQuote.services_offered || "N/A"}</div></div>
                        <div className="space-y-2"><h4 className="text-sm font-bold text-white">Terms</h4><div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-gray-300 min-h-[100px] whitespace-pre-wrap">{selectedQuote.contract_terms || "N/A"}</div></div>
                    </div>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}