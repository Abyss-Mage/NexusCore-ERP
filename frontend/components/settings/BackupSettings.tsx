"use client";

import React, { useState } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Upload, Loader2, HelpCircle, FileText } from "lucide-react";
import { useToast } from "@/components/ui/toast-context";

export function BackupSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const downloadBackup = async () => {
    try {
        const res = await api.get('/backup/export', { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `backup-${new Date().toISOString().slice(0,10)}.iec`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast("Backup download started.", "success");
    } catch(e) { 
        toast("Failed to download backup.", "error"); 
    }
  };

  const restoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !confirm("This will OVERWRITE your current data. Are you sure?")) return;
    
    const fd = new FormData(); 
    fd.append('file', file);
    
    setLoading(true);
    try { 
        await api.post('/backup/import', fd, { headers: {'Content-Type': 'multipart/form-data'} }); 
        toast("System restored successfully! Refreshing...", "success"); 
        setTimeout(() => window.location.reload(), 1500);
    } 
    catch(e) { 
        toast("Restore failed. Invalid file or server error.", "error"); 
    } finally { 
        setLoading(false); 
    }
  };

  const importCsv = async (e: React.ChangeEvent<HTMLInputElement>, url: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const fd = new FormData(); 
    fd.append('file', file);
    
    setImporting(true);
    try { 
        const res = await api.post(url, fd, { headers: {'Content-Type': 'multipart/form-data'} }); 
        toast(`Success! Imported ${res.data.imported} records.`, "success"); 
    } 
    catch(e) { 
        toast("Import failed. Check CSV format.", "error"); 
    } finally { 
        setImporting(false); 
        e.target.value = ''; 
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: ACTIONS */}
        <div className="xl:col-span-2 space-y-6">
            {/* CARD 1: SYSTEM BACKUP */}
            <Card className="shadow-horizon border-none bg-card">
                <CardHeader>
                    <CardTitle>System Backup</CardTitle>
                    <CardDescription>Full system snapshot (Encrypted .iec file)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="p-4 border rounded-lg bg-background dark:bg-background flex justify-between items-center">
                        <div><h4 className="font-bold text-sm">Export Data</h4></div>
                        <Button variant="outline" onClick={downloadBackup}>
                            <Download className="w-4 h-4 mr-2"/> Download
                        </Button>
                    </div>
                    <div className="p-4 border border-red-200 bg-red-50 dark:bg-red-950/10 rounded-lg flex justify-between items-center">
                        <div>
                            <h4 className="font-bold text-sm text-red-700 dark:text-red-400">Restore Data</h4>
                            <p className="text-xs text-red-600/70 dark:text-red-400/70">Overwrites existing database</p>
                        </div>
                        <div className="relative">
                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={restoreBackup} accept=".iec" />
                            <Button className="bg-red-600 hover:bg-red-700 text-white shadow-sm" disabled={loading}>
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Select File"}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
