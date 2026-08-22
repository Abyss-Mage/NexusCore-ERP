"use client";

import React, { useEffect, useState, useMemo } from 'react';
import api from "@/lib/api";
import { Plus, Trash2, Wallet, Calendar as CalendarIcon, Loader2, Search, PenLine, ListFilter, Filter, X } from "lucide-react";
import { 
  format, isWithinInterval, startOfDay, endOfDay, 
  startOfMonth, startOfQuarter, startOfYear, subMonths 
} from "date-fns";

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // --- MUTUALLY EXCLUSIVE FILTER STATE ---
  const [searchTerm, setSearchTerm] = useState("");
  const [periodFilter, setPeriodFilter] = useState("monthly"); // Default: This Month
  const [dateRange, setDateRange] = useState<{from?: Date, to?: Date} | undefined>();

  // --- CREATE FORM STATE ---
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Category Mode (Select vs Input)
  const [isCustomCategory, setIsCustomCategory] = useState(false); 
  
  const [formData, setFormData] = useState({
    category: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    description: ''
  });

  // --- 1. LOAD DATA ---
  const loadExpenses = async () => {
    try {
      const res = await api.get('/expenses?limit=500');
      setExpenses(res.data.data || []);
      setFilteredExpenses(res.data.data || []);
    } catch (err) {
      console.error("Failed to load expenses", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  // --- 2. DERIVE CATEGORIES & FINANCIAL YEARS ---
  const { existingCategories, availableFYs } = useMemo(() => {
      const cats = new Set<string>();
      const years = new Set<number>();
      const currentYear = new Date().getFullYear();
      
      // Always show current FY
      years.add(currentYear); 
      
      expenses.forEach(e => {
          // Categories
          if (e.category) cats.add(e.category);
          
          // Financial Years
          const d = new Date(e.date);
          const month = d.getMonth();
          const year = d.getFullYear();
          // If month is Jan-March (0-2), it belongs to previous FY start
          years.add(month < 3 ? year - 1 : year);
      });

      return {
          existingCategories: Array.from(cats).sort(),
          availableFYs: Array.from(years).sort((a, b) => b - a)
      };
  }, [expenses]);

  // --- 3. FILTER HANDLERS (Mutually Exclusive) ---
  const handlePeriodChange = (val: string) => {
      setPeriodFilter(val);
      setDateRange(undefined); // Clear Custom Range
  };

  // --- 4. FILTER LOGIC ---
  useEffect(() => {
    let temp = expenses;

    // A. Search Filter
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        temp = temp.filter(e => 
            e.category.toLowerCase().includes(lower) || 
            e.description?.toLowerCase().includes(lower)
        );
    }

    // B. Date Filter (Either Preset OR Range)
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = endOfDay(now);

    if (dateRange?.from) {
        // CASE 1: Custom Date Range
        start = startOfDay(dateRange.from);
        end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
    } else if (periodFilter !== "CUSTOM") {
        // CASE 2: Preset Selector
        if (periodFilter.startsWith("FY-")) {
            const startYear = parseInt(periodFilter.split("-")[1]);
            start = new Date(startYear, 3, 1); // April 1st
            end = new Date(startYear + 1, 2, 31, 23, 59, 59); // March 31st next year
        } else {
            switch (periodFilter) {
                case 'daily': start = startOfDay(now); break;
                case 'monthly': start = startOfMonth(now); break;
                case 'quarterly': start = startOfQuarter(now); break;
                case 'semi-annually': start = subMonths(now, 6); break;
                case 'yearly': start = startOfYear(now); break;
                case 'all': start = null; end = null; break;
            }
        }
    }

    if (start && end) {
        temp = temp.filter(e => isWithinInterval(new Date(e.date), { start, end: end! }));
    }

    setFilteredExpenses(temp);
  }, [expenses, searchTerm, periodFilter, dateRange]);

  // --- 5. ACTIONS ---
  const handleSubmit = async () => {
    if (!formData.category || !formData.amount) return alert("Category and Amount are required");
    
    setIsSaving(true);
    try {
        await api.post('/expenses', {
            ...formData,
            amount: Number(formData.amount),
            date: new Date(formData.date).toISOString()
        });
        setIsDialogOpen(false);
        // Reset Form
        setFormData({ category: '', amount: '', date: format(new Date(), 'yyyy-MM-dd'), description: '' });
        setIsCustomCategory(false); // Reset mode
        loadExpenses(); 
    } catch (e) {
        alert("Failed to save expense");
    } finally {
        setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    try {
        await api.delete(`/expenses/${id}`);
        // Optimistic UI Update
        setExpenses(prev => prev.filter(e => e.id !== id));
    } catch (e) {
        alert("Delete failed");
    }
  };

  // Helper to open dialog and set defaults
  const openNewExpenseDialog = () => {
      // If we have categories, default to Select mode. If none, default to Input mode.
      setIsCustomCategory(existingCategories.length === 0);
      setFormData({ category: '', amount: '', date: format(new Date(), 'yyyy-MM-dd'), description: '' });
      setIsDialogOpen(true);
  }

  // Dynamic Total
  const totalExpense = filteredExpenses.reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <div className="p-4 md:p-6 space-y-6 w-full max-w-7xl mx-auto overflow-x-hidden">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Expenses</h1>
          <p className="text-gray-400 mt-1">Track company spending and overheads</p>
        </div>
        
        <button 
            onClick={openNewExpenseDialog}
            className="btn-primary flex items-center w-full md:w-auto justify-center"
        >
            <Plus className="w-4 h-4 mr-2" /> Record Expense
        </button>
      </div>

      {/* DIALOG */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md p-6 flex flex-col gap-6 relative">
            <button 
              onClick={() => setIsDialogOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-white">Add New Expense</h2>
            </div>
            
            <div className="grid gap-4">
                {/* CATEGORY SELECTION */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-300">Category</label>
                        <button 
                            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center transition-colors"
                            onClick={() => {
                                setIsCustomCategory(!isCustomCategory);
                                setFormData({...formData, category: ''}); // Clear on toggle
                            }}
                        >
                            {isCustomCategory ? (
                                <><ListFilter className="w-3 h-3 mr-1"/> Select Existing</>
                            ) : (
                                <><PenLine className="w-3 h-3 mr-1"/> Create New</>
                            )}
                        </button>
                    </div>

                    {isCustomCategory || existingCategories.length === 0 ? (
                        <input 
                            className="input-dark w-full"
                            placeholder="Type new category (e.g. Travel)" 
                            value={formData.category} 
                            onChange={(e) => setFormData({...formData, category: e.target.value})} 
                            autoFocus
                        />
                    ) : (
                        <select 
                            className="input-dark w-full appearance-none"
                            value={formData.category} 
                            onChange={(e) => setFormData({...formData, category: e.target.value})}
                        >
                            <option value="" disabled>Select a category</option>
                            {existingCategories.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {/* AMOUNT */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Amount</label>
                        <input 
                            className="input-dark w-full"
                            type="number" 
                            placeholder="0.00" 
                            value={formData.amount} 
                            onChange={(e) => setFormData({...formData, amount: e.target.value})} 
                        />
                    </div>

                    {/* DATE */}
                    <div className="space-y-2 flex flex-col">
                        <label className="text-sm font-medium text-gray-300">Date</label>
                        <input 
                            type="date"
                            className="input-dark w-full"
                            value={formData.date}
                            onChange={(e) => setFormData({...formData, date: e.target.value})}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Description</label>
                    <textarea 
                        className="input-dark w-full min-h-[100px] py-2"
                        placeholder="Optional notes..." 
                        value={formData.description} 
                        onChange={(e) => setFormData({...formData, description: e.target.value})} 
                    />
                </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-2 border-t border-white/5">
                <button 
                  className="px-4 py-2 rounded-lg font-medium text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-all"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </button>
                <button 
                  className="btn-primary flex items-center"
                  onClick={handleSubmit} 
                  disabled={isSaving}
                >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Save Expense"}
                </button>
            </div>
          </div>
        </div>
      )}

      {/* METRICS & FILTERS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Dynamic Metric */}
        <div className="glass-panel p-6 border-l-4 border-l-red-500/80 md:col-span-1">
            <div className="flex flex-row items-center justify-between pb-2">
                <h3 className="text-sm font-medium text-gray-400">Total Expenses</h3>
                <Wallet className="h-4 w-4 text-red-500" />
            </div>
            <div>
                <div className="text-2xl font-bold text-white">
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalExpense)}
                </div>
                <p className="text-xs text-gray-500 mt-1 capitalize">
                   {dateRange?.from ? 'Custom Range' : (periodFilter === 'all' ? 'All Time' : periodFilter)}
                </p>
            </div>
        </div>

        {/* Filters */}
        <div className="md:col-span-2 glass-panel p-4 flex flex-col justify-center gap-4">
            <div className="flex flex-col xl:flex-row gap-4">
                {/* Search */}
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input 
                        placeholder="Search category or description..." 
                        className="input-dark w-full pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Filter Controls - Responsive Stack */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
                    {/* Preset Selector */}
                    <div className="relative w-full sm:w-[180px]">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <select 
                            className="input-dark w-full pl-10 appearance-none text-sm"
                            value={periodFilter} 
                            onChange={(e) => handlePeriodChange(e.target.value)}
                        >
                            <option value="daily">Daily (Today)</option>
                            <option value="monthly">This Month</option>
                            <option value="quarterly">This Quarter</option>
                            <option value="semi-annually">Last 6 Months</option>
                            <option value="yearly">This Year</option>
                            <option value="all">All Time</option>
                            {availableFYs.map(year => (
                                <option key={year} value={`FY-${year}`}>FY {year}-{year.toString().slice(-2) === '99' ? '00' : (year+1).toString().slice(-2)}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center justify-center sm:hidden py-1">
                        <span className="text-gray-500 text-[10px] font-bold uppercase">OR</span>
                    </div>
                    <span className="hidden sm:inline text-gray-500 text-xs font-bold uppercase">OR</span>

                    {/* Date Range Picker (Native) */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <input 
                            type="date"
                            className="input-dark w-full sm:w-[130px] text-xs"
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
                            className="input-dark w-full sm:w-[130px] text-xs"
                            value={dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : ''}
                            onChange={(e) => {
                                const to = e.target.value ? new Date(e.target.value) : undefined;
                                setDateRange(prev => ({ ...prev, to }));
                                if (to) setPeriodFilter("CUSTOM");
                            }}
                        />
                    </div>
                    
                    {/* Clear Button */}
                    {(dateRange?.from || dateRange?.to || periodFilter === 'CUSTOM') && (
                        <button 
                            onClick={() => {
                                setDateRange(undefined);
                                handlePeriodChange('monthly');
                            }} 
                            className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors self-end sm:self-auto"
                        >
                            <X className="w-4 h-4"/>
                        </button>
                    )}
                </div>
            </div>
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="glass-panel overflow-hidden min-w-0">
        <div className="p-6 border-b border-white/5">
            <h2 className="text-xl font-semibold text-white">Transactions</h2>
        </div>
        <div className="overflow-x-auto">
            {loading ? (
                <div className="p-10 text-center text-gray-400 flex justify-center items-center">
                    <Loader2 className="animate-spin w-5 h-5 mr-3 text-cyan-400"/> Loading...
                </div>
            ) : (
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-white/5 bg-white/[0.02]">
                            <th className="p-4 text-sm font-medium text-gray-300 whitespace-nowrap">Date</th>
                            <th className="p-4 text-sm font-medium text-gray-300 whitespace-nowrap">Category</th>
                            <th className="p-4 text-sm font-medium text-gray-300 md:table-cell">Description</th>
                            <th className="p-4 text-sm font-medium text-gray-300 text-right whitespace-nowrap">Amount</th>
                            <th className="p-4 text-sm font-medium text-gray-300 w-[50px] hidden md:table-cell"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {filteredExpenses.length === 0 && (
                            <tr>
                                <td colSpan={5} className="text-center py-10 text-gray-400">
                                    No expenses found for this period.
                                </td>
                            </tr>
                        )}
                        {filteredExpenses.map((expense) => (
                            <tr key={expense.id} className="group hover:bg-white/[0.02] transition-colors">
                                <td className="p-4 font-mono text-xs text-gray-400 whitespace-nowrap">
                                    {format(new Date(expense.date), "dd MMM yyyy")}
                                </td>
                                <td className="p-4">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 text-gray-300 border border-white/10 whitespace-nowrap">
                                        {expense.category}
                                    </span>
                                </td>
                                <td className="p-4 text-gray-400 max-w-[200px] md:max-w-[300px] truncate text-sm md:table-cell" title={expense.description}>
                                    {expense.description || "-"}
                                </td>
                                <td className="p-4 text-right font-bold text-red-400 whitespace-nowrap">
                                    - {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(expense.amount))}
                                </td>
                                <td className="p-4 hidden md:table-cell text-right">
                                    <button 
                                        onClick={() => handleDelete(expense.id)} 
                                        className="p-2 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/20 hover:text-red-400 rounded-full text-gray-400"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
      </div>

    </div>
  );
}