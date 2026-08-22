"use client";

import React, { useEffect, useState, useMemo } from 'react';
import api from "@/lib/api";
import { generateLedgerPdfBlob } from '@/lib/pdfGenerator';
import { AVAILABLE_CURRENCIES } from '@/lib/currencies';
import { 
  ArrowDownLeft, ArrowUpRight, Download, Loader2, FileSpreadsheet, Filter, PlusCircle, Trash2, AlertCircle, X
} from "lucide-react";
import { 
  format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subMonths, 
  isWithinInterval, endOfDay, startOfDay 
} from "date-fns";
import { useToast } from "@/components/ui/toast-context"; 

export default function LedgerPage() {
  const { toast } = useToast(); 
  
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [timeRange, setTimeRange] = useState("monthly");

  // State for "Add Income" Modal
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [savingIncome, setSavingIncome] = useState(false);
  const [newIncome, setNewIncome] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    amount: '',
    category: 'Bank Interest',
    description: ''
  });

  // State for "Delete" Modal
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 1. Load Data
  const fetchLedger = () => {
    setLoading(true);
    api.get('/ledger').then(res => {
        setAllTransactions(res.data || []);
        setLoading(false);
    }).catch(e => {
        console.error("Failed to load ledger", e);
        setLoading(false);
    });
  };

  useEffect(() => {
    fetchLedger();
  }, []);

  // 2. DYNAMIC FINANCIAL YEARS LOGIC
  const availableFYs = useMemo(() => {
      const years = new Set<number>();
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth(); 
      
      const currentFYStart = currentMonth < 3 ? currentYear - 1 : currentYear;
      years.add(currentFYStart);
      years.add(currentFYStart - 1); 

      allTransactions.forEach(t => {
          const d = new Date(t.date);
          const month = d.getMonth();
          const year = d.getFullYear();
          const fyStart = month < 3 ? year - 1 : year;
          years.add(fyStart);
      });

      return Array.from(years).sort((a, b) => b - a);
  }, [allTransactions]);

  // 3. Helper: Get Date Range
  const getDateRangeForFilter = (filter: string) => {
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null; 

    if (filter.startsWith("FY-")) {
        const startYear = parseInt(filter.split("-")[1]);
        start = new Date(startYear, 3, 1); 
        end = new Date(startYear + 1, 2, 31, 23, 59, 59); 
    } else {
        switch(filter) {
            case 'daily': 
                start = startOfDay(now); 
                end = endOfDay(now);
                break;
            case 'monthly': 
                start = startOfMonth(now); 
                end = endOfMonth(now); 
                break;
            case 'quarterly': 
                start = startOfQuarter(now); 
                end = endOfQuarter(now); 
                break;
            case 'semi-annually': 
                start = subMonths(now, 6); 
                end = endOfDay(now); 
                break;
            case 'yearly': 
                start = startOfYear(now); 
                end = endOfYear(now); 
                break;
            case 'all': 
                start = null; 
                end = null;
                break;
        }
    }
    return { start, end };
  };

  // 4. Filtering Logic
  useEffect(() => {
    if (!Array.isArray(allTransactions)) return;

    const { start, end } = getDateRangeForFilter(timeRange);

    const filtered = allTransactions.filter(t => {
        if (!start || !end) return true;
        const d = new Date(t.date);
        return isWithinInterval(d, { start, end });
    });
    setFilteredTransactions(filtered);
  }, [timeRange, allTransactions]);

  // 5. Actions
  const handleExportPdf = async () => {
    setExporting(true);
    try {
        const { start, end } = getDateRangeForFilter(timeRange);
        let dateRangeStr = timeRange === 'all' ? 'All Time' : 
                          `${start ? format(start, 'dd MMM yyyy') : 'Beginning'} - ${end ? format(end, 'dd MMM yyyy') : 'Present'}`;

        const [profileRes, localizationRes] = await Promise.all([
            api.get('/settings/company').catch(() => null),
            api.get('/settings/LOCALIZATION').catch(() => null)
        ]);

        const companyName = profileRes?.data?.json_value?.company_name || 'My Company';
        const loc = localizationRes?.data?.json_value || {};
        const baseCurrencyCode = loc.base_currency || 'INR';
        const baseCurrencySymbol = AVAILABLE_CURRENCIES.find(c => c.code === baseCurrencyCode)?.symbol || '₹';

        const pdfData = {
            transactions: filteredTransactions,
            totalIncome,
            totalExpense,
            companyName,
            dateRange: dateRangeStr,
            baseCurrencySymbol
        };

        const blob = await generateLedgerPdfBlob(pdfData);
        
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const safeRange = encodeURIComponent(timeRange.replace(/[^a-zA-Z0-9_-]/g, ''));
        link.setAttribute('download', `ledger-${safeRange}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (e) {
        console.error(e);
        toast("Failed to export PDF", "error");
    } finally {
        setExporting(false);
    }
  };

  const handleCreateIncome = async () => {
    if (!newIncome.amount || !newIncome.date) {
        toast("Please fill in Date and Amount", "warning");
        return;
    }

    setSavingIncome(true);
    try {
        await api.post('/income', {
            ...newIncome,
            amount: parseFloat(newIncome.amount),
            date: new Date(newIncome.date).toISOString()
        });
        toast("Income recorded successfully", "success");
        
        setIsIncomeModalOpen(false);
        setNewIncome({ date: format(new Date(), 'yyyy-MM-dd'), amount: '', category: 'Bank Interest', description: '' });
        fetchLedger(); // Refresh Data
    } catch (e) {
        console.error(e);
        toast("Failed to record income", "error");
    } finally {
        setSavingIncome(false);
    }
  };

  // Delete Handlers
  const confirmDelete = (id: string) => {
      setDeleteId(id);
      setIsDeleteModalOpen(true);
  };

  const executeDelete = async () => {
      if (!deleteId) return;
      setDeleting(true);

      const [type, idStr] = deleteId.split('-'); // e.g., "EXP-5" -> ["EXP", "5"]
      const id = parseInt(idStr);

      try {
          if (type === 'EXP') {
              await api.delete(`/expenses/${id}`);
          } else if (type === 'INC') {
              await api.delete(`/income/${id}`);
          } else {
              toast("Cannot delete Invoices here. Use Invoice Management.", "error");
              setDeleting(false);
              setIsDeleteModalOpen(false);
              return;
          }

          toast("Entry deleted successfully", "success");
          fetchLedger(); // Refresh
      } catch (e) {
          console.error(e);
          toast("Failed to delete entry", "error");
      } finally {
          setDeleting(false);
          setIsDeleteModalOpen(false);
          setDeleteId(null);
      }
  };

  // Metrics
  const totalIncome = filteredTransactions.reduce((sum, t) => sum + (Number(t.credit) || 0), 0);
  const totalExpense = filteredTransactions.reduce((sum, t) => sum + (Number(t.debit) || 0), 0);
  const netBalance = totalIncome - totalExpense;

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
            <h1 className="text-3xl font-bold text-white mb-1">Financial Ledger</h1>
            <p className="text-gray-400">Consolidated view of Income and Expenses</p>
        </div>
        
        {/* ACTION BAR: Responsive Layout */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            
            {/* Filter Dropdown */}
            <div className="relative w-full sm:w-[180px]">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Filter className="h-4 w-4 text-gray-400" />
                </div>
                <select 
                    className="input-dark w-full pl-10 appearance-none text-sm"
                    value={timeRange} 
                    onChange={(e) => setTimeRange(e.target.value)}
                >
                    <optgroup label="Standard Ranges">
                        <option value="daily">Daily (Today)</option>
                        <option value="monthly">This Month</option>
                        <option value="quarterly">This Quarter</option>
                        <option value="yearly">This Year (Jan-Dec)</option>
                        <option value="all">All Time</option>
                    </optgroup>
                    <optgroup label="Financial Years">
                        {availableFYs.map(year => (
                            <option key={year} value={`FY-${year}`}>
                                FY {year}-{year.toString().slice(-2) === '99' ? '00' : (year+1).toString().slice(-2)}
                            </option>
                        ))}
                    </optgroup>
                </select>
            </div>

            {/* BUTTONS GROUP */}
            <div className="flex gap-2 w-full sm:w-auto">
                <button 
                    onClick={() => setIsIncomeModalOpen(true)}
                    className="flex-1 sm:flex-none px-4 py-2 rounded-md border border-green-500/30 text-green-400 hover:bg-green-500/10 hover:text-green-300 transition-colors flex justify-center items-center gap-2"
                >
                    <PlusCircle className="w-4 h-4" />
                    <span className="whitespace-nowrap">Add Income</span>
                </button>

                <button 
                    onClick={handleExportPdf} 
                    disabled={exporting} 
                    className="flex-1 sm:flex-none px-4 py-2 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 text-on-surface transition-colors flex justify-center items-center gap-2"
                >
                    {exporting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4" />}
                    <span className="hidden sm:inline">Export PDF</span>
                    <span className="sm:hidden">PDF</span>
                </button>
            </div>
        </div>
      </div>

      {/* METRICS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 bg-green-500/5 border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.05)]">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/10 rounded-full text-green-400 border border-green-500/20"><ArrowDownLeft className="w-6 h-6" /></div>
                <div>
                    <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">Income</p>
                    <h3 className="text-2xl font-bold text-white mt-1">{formatCurrency(totalIncome)}</h3>
                </div>
            </div>
        </div>
        
        <div className="glass-panel p-6 bg-red-500/5 border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.05)]">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-red-500/10 rounded-full text-red-400 border border-red-500/20"><ArrowUpRight className="w-6 h-6" /></div>
                <div>
                    <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">Expenses</p>
                    <h3 className="text-2xl font-bold text-white mt-1">{formatCurrency(totalExpense)}</h3>
                </div>
            </div>
        </div>

        <div className="glass-panel p-6">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-cyan-500/10 rounded-full text-cyan-400 border border-cyan-500/20"><FileSpreadsheet className="w-6 h-6" /></div>
                <div>
                    <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">Net Balance</p>
                    <h3 className="text-2xl font-bold text-white mt-1">{formatCurrency(netBalance)}</h3>
                </div>
            </div>
        </div>
      </div>

      {/* TABLE SECTION */}
      <div className="glass-panel overflow-hidden min-w-0">
        <div className="p-6 border-b border-white/5">
            <h2 className="text-xl font-bold text-white">Transaction History</h2>
        </div>
        <div className="overflow-x-auto">
            {loading ? (
                <div className="p-10 text-center flex justify-center text-gray-400 items-center"><Loader2 className="animate-spin w-5 h-5 mr-3 text-cyan-400"/> Loading...</div>
            ) : (
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-white/5 bg-white/[0.02]">
                            <th className="p-4 text-xs font-medium text-gray-300 uppercase tracking-wider whitespace-nowrap w-[120px]">Date</th>
                            <th className="p-4 text-xs font-medium text-gray-300 uppercase tracking-wider min-w-[150px]">Description</th>
                            <th className="p-4 text-xs font-medium text-gray-300 uppercase tracking-wider hidden md:table-cell w-[100px]">Ref #</th>
                            <th className="p-4 text-xs font-medium text-gray-300 uppercase tracking-wider text-right text-green-400 whitespace-nowrap">Credit (Income)</th>
                            <th className="p-4 text-xs font-medium text-gray-300 uppercase tracking-wider text-right text-red-400 whitespace-nowrap">Debit (Expense)</th>
                            <th className="p-4 text-xs font-medium text-gray-300 uppercase tracking-wider hidden md:table-cell w-[50px]"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {filteredTransactions.length === 0 && (
                            <tr><td colSpan={6} className="text-center py-8 text-gray-400">No transactions found for this period.</td></tr>
                        )}
                        {filteredTransactions.map((t) => (
                            <tr key={t.id} className="group hover:bg-white/[0.02] transition-colors">
                                <td className="p-4 font-mono text-xs text-gray-400 whitespace-nowrap">
                                    {format(new Date(t.date), "dd MMM yyyy")}
                                </td>
                                <td className="p-4">
                                    <div className="font-medium text-sm text-white truncate max-w-[200px] md:max-w-none">{t.description}</div>
                                    <div className="text-[10px] uppercase tracking-wider text-gray-500 mt-1">{t.type} • {t.category}</div>
                                </td>
                                <td className="p-4 text-xs text-gray-500 hidden md:table-cell">{t.ref}</td>
                                <td className="p-4 text-right font-medium text-green-400 whitespace-nowrap">
                                    {t.credit > 0 ? formatCurrency(t.credit) : '-'}
                                </td>
                                <td className="p-4 text-right font-medium text-red-400 whitespace-nowrap">
                                    {t.debit > 0 ? formatCurrency(t.debit) : '-'}
                                </td>
                                <td className="p-4 hidden md:table-cell text-right">
                                    {/* Only Allow Deleting EXP (Expenses) and INC (Other Income) */}
                                    {(t.id.startsWith('EXP') || t.id.startsWith('INC')) && (
                                        <button 
                                            className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-full opacity-100 md:opacity-0 group-hover:opacity-100 transition-all"
                                            onClick={() => confirmDelete(t.id)}
                                            title="Delete Entry"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
      </div>

      {/* Add Income Modal */}
      {isIncomeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="glass-panel w-full max-w-md p-6 relative flex flex-col gap-6">
                <button 
                  onClick={() => setIsIncomeModalOpen(false)}
                  className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                
                <div>
                    <h2 className="text-xl font-bold text-white mb-2">Record Other Income</h2>
                    <p className="text-sm text-gray-400">Record non-invoice income here.</p>
                </div>
                
                <div className="space-y-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-gray-300">Date</label>
                        <input 
                            type="date"
                            className="input-dark w-full"
                            value={newIncome.date}
                            onChange={(e) => setNewIncome({...newIncome, date: e.target.value})}
                        />
                    </div>
                    
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-gray-300">Amount (₹ INR)</label>
                        <input 
                            type="number"
                            step="0.01"
                            className="input-dark w-full"
                            placeholder="0.00"
                            value={newIncome.amount}
                            onChange={(e) => setNewIncome({...newIncome, amount: e.target.value})}
                        />
                    </div>
                    
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-gray-300">Category</label>
                        <select 
                            className="input-dark w-full"
                            value={newIncome.category}
                            onChange={(e) => setNewIncome({...newIncome, category: e.target.value})}
                        >
                            <option value="Bank Interest">Bank Interest</option>
                            <option value="Asset Sale">Asset Sale</option>
                            <option value="Refund">Refund</option>
                            <option value="Capital Injection">Capital Injection</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-gray-300">Description (Optional)</label>
                        <input 
                            className="input-dark w-full"
                            placeholder="Optional details..."
                            value={newIncome.description}
                            onChange={(e) => setNewIncome({...newIncome, description: e.target.value})}
                        />
                    </div>
                </div>
                
                <div className="flex justify-end gap-3 mt-4">
                    <button className="btn-ghost" onClick={() => setIsIncomeModalOpen(false)}>Cancel</button>
                    <button className="btn-primary flex items-center gap-2" onClick={handleCreateIncome} disabled={savingIncome}>
                        {savingIncome && <Loader2 className="w-4 h-4 animate-spin" />}
                        Save Record
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="glass-panel w-full max-w-sm p-6 relative flex flex-col gap-6">
                <div className="flex items-center gap-3 text-red-400 mb-2">
                    <AlertCircle className="w-6 h-6" />
                    <h2 className="text-xl font-bold">Confirm Deletion</h2>
                </div>
                <p className="text-sm text-gray-300">
                    Are you sure you want to delete this ledger entry? This action cannot be undone and will affect your financial reports.
                </p>
                <div className="flex justify-end gap-3 mt-4">
                    <button className="btn-ghost" onClick={() => setIsDeleteModalOpen(false)}>Cancel</button>
                    <button className="btn-primary bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 flex items-center gap-2" onClick={executeDelete} disabled={deleting}>
                        {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                        Delete Entry
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}