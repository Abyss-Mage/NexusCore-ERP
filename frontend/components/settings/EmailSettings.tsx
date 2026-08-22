"use client";

import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Save, Loader2, Send } from "lucide-react";
import { useToast } from "@/components/ui/toast-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";

interface EmailSettingsProps {
  disabled?: boolean;
}

export function EmailSettings({ disabled }: EmailSettingsProps) {
  const { toast } = useToast();
  const [smtp, setSmtp] = useState<any>({});
  const [templates, setTemplates] = useState<any>({ invoice: {}, quotation: {} });
  const [loading, setLoading] = useState(false);
  
  const [sending, setSending] = useState(false);
  const [testEmailAddr, setTestEmailAddr] = useState("");
  const [isTestOpen, setIsTestOpen] = useState(false);

  useEffect(() => {
    api.get('/mail/config').then(res => setSmtp(res.data || {}));
    api.get('/mail/templates').then(res => setTemplates(res.data || { invoice: {}, quotation: {} }));
  }, []);

  const saveSmtp = async () => {
     setLoading(true);
     try { await api.post('/mail/config', smtp); toast("SMTP Saved", "success"); } 
     catch(e) { toast("Failed", "error"); } finally { setLoading(false); }
  };

  const saveTemplates = async () => {
     setLoading(true);
     try { await api.post('/mail/templates', templates); toast("Templates Saved", "success"); } 
     catch(e) { toast("Failed", "error"); } finally { setLoading(false); }
  };

  const handleTestEmail = async () => {
    setSending(true);
    try { await api.post('/mail/test', { email: testEmailAddr }); toast("Sent!", "success"); setIsTestOpen(false); } 
    catch(e) { toast("Error sending", "error"); } finally { setSending(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
            <Card className="shadow-horizon border-none bg-card">
                <CardHeader><CardTitle>SMTP Config</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2"><Label>Host</Label><Input value={smtp.host || ''} onChange={e => setSmtp({...smtp, host: e.target.value})} disabled={disabled} /></div>
                    <div className="space-y-2"><Label>Port</Label><Input value={smtp.port || ''} onChange={e => setSmtp({...smtp, port: e.target.value})} disabled={disabled} /></div>
                    <div className="space-y-2"><Label>User</Label><Input value={smtp.user || ''} onChange={e => setSmtp({...smtp, user: e.target.value})} disabled={disabled} /></div>
                    <div className="space-y-2"><Label>Password</Label><Input type="password" value={smtp.password || ''} onChange={e => setSmtp({...smtp, password: e.target.value})} disabled={disabled} /></div>
                    <div className="space-y-2"><Label>From Email</Label><Input value={smtp.fromEmail || ''} onChange={e => setSmtp({...smtp, fromEmail: e.target.value})} disabled={disabled} /></div>
                    
                    {!disabled && (
                        <Button className="w-full mt-2" onClick={saveSmtp} disabled={loading}>Save Config</Button>
                    )}
                    
                    {!disabled && (
                        <Dialog open={isTestOpen} onOpenChange={setIsTestOpen}>
                            <DialogTrigger asChild><Button variant="outline" className="w-full">Test Connection</Button></DialogTrigger>
                            <DialogContent className="sm:max-w-[400px]">
                                <DialogHeader><DialogTitle>Test Email</DialogTitle><DialogDescription>Send a test to:</DialogDescription></DialogHeader>
                                <div className="py-4"><Input placeholder="Email" value={testEmailAddr} onChange={e => setTestEmailAddr(e.target.value)} /></div>
                                <DialogFooter><Button onClick={handleTestEmail} disabled={sending}>Send</Button></DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}
                </CardContent>
            </Card>
        </div>
        <div className="lg:col-span-2">
            <Card className="shadow-horizon border-none bg-card h-full">
                <CardHeader><CardTitle>Email Templates</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-3">
                        <Label>Invoice Template</Label>
                        <Input placeholder="Subject" value={templates.invoice?.subject || ''} onChange={e => setTemplates({...templates, invoice: {...templates.invoice, subject: e.target.value}})} disabled={disabled} />
                        <Textarea placeholder="Body..." className="h-32 font-mono text-xs" value={templates.invoice?.body || ''} onChange={e => setTemplates({...templates, invoice: {...templates.invoice, body: e.target.value}})} disabled={disabled} />
                    </div>
                    <div className="space-y-3 pt-4 border-t">
                        <Label>Quotation Template</Label>
                        <Input placeholder="Subject" value={templates.quotation?.subject || ''} onChange={e => setTemplates({...templates, quotation: {...templates.quotation, subject: e.target.value}})} disabled={disabled} />
                        <Textarea placeholder="Body..." className="h-32 font-mono text-xs" value={templates.quotation?.body || ''} onChange={e => setTemplates({...templates, quotation: {...templates.quotation, body: e.target.value}})} disabled={disabled} />
                    </div>
                    {!disabled && (
                        <div className="flex justify-end"><Button onClick={saveTemplates} disabled={loading}>Save Templates</Button></div>
                    )}
                </CardContent>
            </Card>
        </div>
    </div>
  );
}