"use client";

import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RotateCcw, Save, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast-context";

interface DocumentSettingsProps {
  disabled?: boolean;
}

export function DocumentSettings({ disabled }: DocumentSettingsProps) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<any>({});
  const [nextInvoiceSeq, setNextInvoiceSeq] = useState("");
  const [nextQuoteSeq, setNextQuoteSeq] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/settings/documents').then(res => setSettings(res.data || {}));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({ ...settings, [e.target.name]: e.target.value });
  };

  const saveSettings = async () => {
    setLoading(true);
    try { 
        await api.put('/settings/documents', settings); 
        toast("Configuration Saved!", "success");
    } catch (e) { 
        toast("Failed to save settings", "error"); 
    } finally { 
        setLoading(false); 
    }
  };

  const updateSeq = async (type: string, val: string) => {
     if(!val || isNaN(Number(val))) return toast("Please enter a valid number", "warning");
     try { 
         await api.put('/settings/sequence', { type, next_number: val }); 
         toast(`Success! Next ${type.toLowerCase()} will be ${val}`, "success");
         if (type === 'INVOICE') setNextInvoiceSeq("");
         else setNextQuoteSeq("");
     } catch (e) { toast("Failed to update sequence", "error"); }
  };

  const handleReset = async (type: string) => {
      try {
          await api.put('/settings/sequence', { type, next_number: "1" });
          toast(`${type} sequence reset to 1.`, "success");
      } catch (e) { toast("Reset failed", "error"); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
       
       {/* INVOICE CONFIG */}
       <Card className="shadow-horizon border-none bg-card">
            <CardHeader>
                <CardTitle>Invoice Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label>Number Format</Label>
                    <Input 
                        name="invoice_format" 
                        value={settings.invoice_format || ''} 
                        onChange={handleChange} 
                        disabled={disabled} // <--- Disabled
                    />
                </div>
                <div className="space-y-2">
                    <Label>Document Label</Label>
                    <Input 
                        name="invoice_label" 
                        value={settings.invoice_label || ''} 
                        onChange={handleChange} 
                        disabled={disabled} // <--- Disabled
                    />
                </div>
                
                {/* Hide Sequence Controls if Disabled */}
                {!disabled && (
                    <div className="pt-4 border-t space-y-3">
                        <Label className="text-sm font-semibold">Sequence Management</Label>
                        <div className="flex items-center gap-2">
                            <Input value={nextInvoiceSeq} onChange={e => setNextInvoiceSeq(e.target.value)} placeholder="Set next #" className="flex-1" />
                            <Button variant="secondary" onClick={() => updateSeq('INVOICE', nextInvoiceSeq)}>Set</Button>
                            <Button variant="outline" size="icon" onClick={() => handleReset('INVOICE')}><RotateCcw className="w-4 h-4 text-red-500" /></Button>
                        </div>
                    </div>
                )}
            </CardContent>
       </Card>

       {/* QUOTATION CONFIG */}
       <Card className="shadow-horizon border-none bg-card">
            <CardHeader>
                <CardTitle>Quotation Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label>Number Format</Label>
                    <Input 
                        name="quotation_format" 
                        value={settings.quotation_format || ''} 
                        onChange={handleChange} 
                        disabled={disabled}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Document Label</Label>
                    <Input 
                        name="quotation_label" 
                        value={settings.quotation_label || ''} 
                        onChange={handleChange} 
                        disabled={disabled}
                    />
                </div>

                {!disabled && (
                    <div className="pt-4 border-t space-y-3">
                        <Label className="text-sm font-semibold">Sequence Management</Label>
                        <div className="flex items-center gap-2">
                            <Input value={nextQuoteSeq} onChange={e => setNextQuoteSeq(e.target.value)} placeholder="Set next #" className="flex-1" />
                            <Button variant="secondary" onClick={() => updateSeq('QUOTATION', nextQuoteSeq)}>Set</Button>
                            <Button variant="outline" size="icon" onClick={() => handleReset('QUOTATION')}><RotateCcw className="w-4 h-4 text-red-500" /></Button>
                        </div>
                    </div>
                )}
            </CardContent>
       </Card>

       {!disabled && (
           <div className="lg:col-span-2 flex justify-end">
              <Button onClick={saveSettings} disabled={loading} className="bg-primary text-primary-foreground min-w-[150px]">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Configurations
              </Button>
           </div>
       )}
    </div>
  );
}