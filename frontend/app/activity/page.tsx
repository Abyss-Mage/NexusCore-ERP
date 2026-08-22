"use client";

import React, { useEffect, useState } from 'react';
import api from "@/lib/api";
import { Activity, Loader2, User, Monitor } from "lucide-react";

export default function ActivityPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Formatter to display date with explicit Timezone (IST)
  const formatActivityDate = (dateString: string) => {
    if (!dateString) return "-";
    
    const date = new Date(dateString);
    
    return new Intl.DateTimeFormat('en-IN', { 
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata', // Forces IST display
      timeZoneName: 'short'     // Appends "IST"
    }).format(date);
  };

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await api.get('/activities?limit=200');
        setLogs(res.data.data || []);
      } catch (e) {
        console.error("Failed to load activity logs");
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const getActionColor = (action: string) => {
      const act = action ? action.toUpperCase() : "";
      if (act.includes("LOGIN")) return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
      if (act.includes("CREATE")) return "bg-green-500/10 text-green-400 border-green-500/20";
      if (act.includes("DELETE")) return "bg-red-500/10 text-red-400 border-red-500/20";
      if (act.includes("UPDATE")) return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      return "bg-white/10 text-gray-300 border-white/20";
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      
      <div className="flex items-center gap-4">
        <div className="p-3 bg-cyan-500/10 rounded-full border border-cyan-500/20">
          <Activity className="w-6 h-6 text-cyan-400" />
        </div>
        <div>
            <h1 className="text-3xl font-bold text-white mb-1">Activity Log</h1>
            <p className="text-gray-400">Audit trail of system usage.</p>
        </div>
      </div>

      <div className="glass-panel overflow-hidden min-w-0">
        <div className="p-6 border-b border-white/5">
            <h2 className="text-xl font-bold text-white">Recent Actions</h2>
        </div>
        <div className="overflow-x-auto">
            {loading ? (
                <div className="p-10 text-center flex justify-center items-center text-gray-400">
                  <Loader2 className="animate-spin w-5 h-5 mr-3 text-cyan-400"/> Loading logs...
                </div>
            ) : (
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-white/5 bg-white/[0.02]">
                            <th className="p-4 text-xs font-medium text-gray-300 uppercase tracking-wider w-[200px]">User</th>
                            <th className="p-4 text-xs font-medium text-gray-300 uppercase tracking-wider w-[150px]">Action</th>
                            <th className="p-4 text-xs font-medium text-gray-300 uppercase tracking-wider">Description</th>
                            <th className="p-4 text-xs font-medium text-gray-300 uppercase tracking-wider text-right w-[220px]">Timestamp</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {logs.length === 0 && (
                            <tr>
                              <td colSpan={4} className="text-center py-10 text-gray-400">
                                No activity recorded yet.
                              </td>
                            </tr>
                        )}
                        {logs.map((log) => (
                            <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-gray-400">
                                            <User className="w-4 h-4" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-xs text-white">{log.user?.email || 'System'}</span>
                                            <span className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                                                <Monitor className="w-3 h-3"/> {log.ip_address || 'Unknown IP'}
                                            </span>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border ${getActionColor(log.action)}`}>
                                        {log.action}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <div className="text-sm text-gray-200">{log.description}</div>
                                    {log.entity_type && (
                                        <div className="text-[11px] text-gray-500 mt-1">
                                            Ref: {log.entity_type} #{log.entity_id}
                                        </div>
                                    )}
                                </td>
                                <td className="p-4 text-right whitespace-nowrap font-mono text-xs text-gray-400">
                                    {/* Using log.createdAt (Prisma default) with fallback to log.created_at just in case */}
                                    {formatActivityDate(log.createdAt || log.created_at)}
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