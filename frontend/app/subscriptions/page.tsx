"use client";

import React, { useEffect, useState } from 'react';
import api from "@/lib/api";
import { 
  Plus, MoreHorizontal, Loader2, Calendar as CalendarIcon
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { useRouter } from 'next/navigation';
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Subscription {
  id: number;
  client: {
    company_name: string;
    email?: string;
  };
  frequency: string;
  currency: string;
  subtotal: number;
  next_run_date: string;
  status: string;
}

export default function SubscriptionsListPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const fetchSubscriptions = async () => {
    try {
      const res = await api.get('/subscriptions');
      setSubscriptions(res.data.data || []);
    } catch (err) {
      console.error("Failed to load subscriptions", err);
      toast("Failed to load subscriptions", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const formatCurrency = (val: number, currencyCode: string) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currencyCode || 'INR',
        minimumFractionDigits: 2
    }).format(val);
  };

  const deleteSubscription = async (id: number) => {
    if (!confirm("Are you sure you want to delete this subscription?")) return;
    setActionLoadingId(id);
    try {
      await api.delete(`/subscriptions/${id}`);
      toast("Subscription deleted", "success");
      fetchSubscriptions();
    } catch (e) {
      toast("Failed to delete", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const toggleStatus = async (sub: Subscription) => {
      setActionLoadingId(sub.id);
      const newStatus = sub.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
      try {
          await api.put(`/subscriptions/${sub.id}`, { ...sub, status: newStatus });
          toast(`Subscription ${newStatus.toLowerCase()}`, "success");
          fetchSubscriptions();
      } catch (e) {
          toast("Failed to update status", "error");
      } finally {
          setActionLoadingId(null);
      }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-headline-sm text-headline-sm font-bold text-on-surface">Subscriptions</h1>
          <p className="text-on-surface-variant mt-1 text-sm">Automated Recurring Billing Profiles</p>
        </div>
        <Link 
          href="/subscriptions/new" 
          className="btn-primary flex items-center gap-2 px-4 py-2 bg-primary text-on-primary hover:bg-primary/90 rounded-md transition-colors"
        >
          <Plus className="w-4 h-4" /> New Subscription
        </Link>
      </div>

      {/* Main Table Card */}
      <div className="card p-0 overflow-hidden shadow-lg border-surface-variant/30">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left text-sm text-on-surface">
            <thead className="bg-surface-variant/20 text-on-surface-variant font-medium border-b border-surface-variant/30">
              <tr>
                <th className="px-6 py-4">Client</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Frequency</th>
                <th className="px-6 py-4 hidden md:table-cell">Next Run Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-variant/30">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading subscriptions...
                  </td>
                </tr>
              ) : subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant">
                    <div className="flex justify-center mb-3">
                        <CalendarIcon className="w-10 h-10 text-on-surface-variant opacity-30" />
                    </div>
                    No subscriptions found.
                  </td>
                </tr>
              ) : (
                subscriptions.map((sub) => (
                  <tr 
                    key={sub.id} 
                    className="hover:bg-surface-variant/10 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-on-surface">{sub.client?.company_name || 'Unknown'}</div>
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {formatCurrency(sub.subtotal, sub.currency)}
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant capitalize">
                      {sub.frequency.toLowerCase()}
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell text-on-surface-variant">
                      {sub.next_run_date ? format(new Date(sub.next_run_date), "dd MMM yyyy") : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium border",
                        sub.status === 'ACTIVE' ? "bg-green-500/10 text-green-400 border-green-500/20" :
                        "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                      )}>
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {actionLoadingId === sub.id ? (
                        <Loader2 className="w-4 h-4 animate-spin ml-auto text-primary" />
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-2 hover:bg-surface-variant/30 rounded-md transition-colors outline-none focus:outline-none focus:ring-0">
                              <MoreHorizontal className="w-4 h-4 text-on-surface-variant" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40 border border-surface-variant/50 bg-surface shadow-xl">
                            <DropdownMenuItem 
                              className="cursor-pointer text-sm font-medium hover:bg-primary hover:text-on-primary transition-colors focus:bg-primary focus:text-on-primary"
                              onClick={() => toggleStatus(sub)}
                            >
                                {sub.status === 'ACTIVE' ? 'Pause' : 'Activate'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-surface-variant/30" />
                            <DropdownMenuItem 
                              className="cursor-pointer text-sm font-medium text-red-400 focus:bg-red-500/20 focus:text-red-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                              onClick={() => deleteSubscription(sub.id)}
                            >
                              Delete Profile
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
