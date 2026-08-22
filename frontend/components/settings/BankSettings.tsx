"use client";

import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast-context";

interface BankSettingsProps {
  disabled?: boolean;
}

// defined locally for portability, can be moved to @/lib/currencies.ts
const AVAILABLE_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: 'US$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'AU$' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
];

export function BankSettings({ disabled }: BankSettingsProps) {
  const { toast } = useToast();
  const [banks, setBanks] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<any>({});

  useEffect(() => { loadBanks(); }, []);
  
  const loadBanks = () => api.get('/banks').then(res => setBanks(res.data.data || []));

  const getCurrencySymbol = (code: string) => {
    return AVAILABLE_CURRENCIES.find(c => c.code === code)?.symbol || code;
  };

  const openDialog = (bank?: any) => {
    if (disabled) return;
    setEditingId(bank ? bank.id : null);
    
    setForm(bank || { 
        label: '', 
        currency: 'USD', 
        is_default: false,
        bank_name: '',
        account_holder: '',
        account_number: '',
        routing_number: '',
        swift_code: '',
        ifsc_code: '',
        iban: '',
        sort_code: '',
        upi_id: '',
        branch_address: '',
        payment_method: '' 
    });
    setIsOpen(true);
  };

  const saveBank = async () => {
    if(!form.label || !form.account_number) {
        return toast("Missing required fields (Label & Account #)", "warning");
    }
    
    try {
        if(editingId) await api.put(`/banks/${editingId}`, form);
        else await api.post('/banks', form);
        
        setIsOpen(false); 
        loadBanks();
        toast("Bank Account Saved", "success");
    } catch(e) { 
        console.error(e);
        toast("Failed to save bank", "error"); 
    }
  };

  const deleteBank = async (id: number) => {
     if(!confirm("Delete this bank account? This may affect existing invoices.")) return;
     try { 
         await api.delete(`/banks/${id}`); 
         loadBanks(); 
         toast("Bank deleted", "success"); 
     } catch(e) { 
         toast("Failed to delete bank", "error"); 
     }
  };

  const setDefault = async (id: number) => {
     if (disabled) return;
     try { 
         await api.patch(`/banks/${id}/default`); 
         loadBanks(); 
         toast("Default bank updated", "success"); 
     } catch(e) { 
         toast("Failed to set default", "error"); 
     }
  };

  return (
    <Card className="shadow-horizon border-none bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Bank Accounts</CardTitle>
                <CardDescription>Manage multi-currency accounts for invoices.</CardDescription>
            </div>
            {!disabled && (
                <Button onClick={() => openDialog()} className="bg-primary text-primary-foreground">
                    <Plus className="w-4 h-4 mr-2"/> Add Bank
                </Button>
            )}
        </CardHeader>
        <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
                {banks.map(bank => (
                    <div key={bank.id} className={`p-5 rounded-xl border-2 transition-all ${bank.is_default ? 'border-primary bg-primary/5' : 'border-border bg-background hover:border-primary/20'}`}>
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-base">{bank.label}</h4>
                                    {bank.is_default && <Badge>Default</Badge>}
                                    <Badge variant="outline" className="font-mono text-xs">
                                        {getCurrencySymbol(bank.currency)}
                                    </Badge>
                                </div>
                                
                                <p className="text-sm font-semibold">{bank.bank_name}</p>
                                <p className="text-xs text-muted-foreground">
                                    Acct: <span className="font-mono">{bank.account_number}</span>
                                </p>
                                
                                {bank.payment_method && (
                                    <p className="text-xs text-primary font-medium mt-1">
                                        Method: {bank.payment_method}
                                    </p>
                                )}

                                <div className="text-[10px] text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                                    {bank.routing_number && <span>Routing: {bank.routing_number}</span>}
                                    {bank.swift_code && <span>SWIFT: {bank.swift_code}</span>}
                                    {bank.iban && <span>IBAN: {bank.iban}</span>}
                                    {bank.sort_code && <span>Sort: {bank.sort_code}</span>}
                                    {bank.ifsc_code && <span>IFSC: {bank.ifsc_code}</span>}
                                    {bank.upi_id && <span>UPI: {bank.upi_id}</span>}
                                </div>
                            </div>
                            {!disabled && (
                                <Button variant="ghost" size="icon" onClick={() => openDialog(bank)}>
                                    <Pencil className="w-4 h-4"/>
                                </Button>
                            )}
                        </div>
                        
                        {!disabled && (
                            <div className="mt-4 pt-3 border-t flex justify-between items-center">
                                {!bank.is_default && (
                                    <Button variant="link" size="sm" className="p-0 h-auto text-primary" onClick={() => setDefault(bank.id)}>
                                        Make Default
                                    </Button>
                                )}
                                <Button variant="ghost" size="sm" className="text-red-500 ml-auto hover:bg-red-50 hover:text-red-600" onClick={() => deleteBank(bank.id)}>
                                    <Trash2 className="w-4 h-4 mr-1"/> Delete
                                </Button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </CardContent>
        
        {/* Add/Edit Dialog */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{editingId ? "Edit" : "Add"} Account</DialogTitle>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Label (e.g. Primary Operations)</Label>
                            <Input 
                                value={form.label} 
                                onChange={e => setForm({...form, label: e.target.value})} 
                                placeholder="Primary Operations" 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Currency</Label>
                            <Select 
                                value={form.currency} 
                                onValueChange={(val) => setForm({...form, currency: val})}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Currency" />
                                </SelectTrigger>
                                <SelectContent>
                                    {AVAILABLE_CURRENCIES.map((curr) => (
                                        <SelectItem key={curr.code} value={curr.code}>
                                            <span className="font-medium">{curr.code}</span> - {curr.name} ({curr.symbol})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Bank Identity */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Bank Name</Label>
                            <Input value={form.bank_name} onChange={e => setForm({...form, bank_name: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <Label>Account Holder Name</Label>
                            <Input value={form.account_holder} onChange={e => setForm({...form, account_holder: e.target.value})} />
                        </div>
                    </div>

                    {/* Account Numbers */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Account Number</Label>
                            <Input value={form.account_number} onChange={e => setForm({...form, account_number: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <Label>Payment Method</Label>
                            <Input 
                                value={form.payment_method || ''} 
                                onChange={e => setForm({...form, payment_method: e.target.value})} 
                                placeholder="e.g. ACH / FEDWIRE / SWIFT"
                            />
                        </div>
                    </div>

                    {/* International Codes (Grid) */}
                    <div className="grid grid-cols-3 gap-4 bg-background dark:bg-muted/50 p-3 rounded-lg border">
                         <div className="space-y-2">
                            <Label className="text-xs">Routing Number</Label>
                            <Input className="h-8 text-sm" value={form.routing_number || ''} onChange={e => setForm({...form, routing_number: e.target.value})} placeholder="021..." />
                        </div>
                         <div className="space-y-2">
                            <Label className="text-xs">SWIFT / BIC</Label>
                            <Input className="h-8 text-sm" value={form.swift_code || ''} onChange={e => setForm({...form, swift_code: e.target.value})} placeholder="CHAS..." />
                        </div>
                         <div className="space-y-2">
                            <Label className="text-xs">IBAN</Label>
                            <Input className="h-8 text-sm" value={form.iban || ''} onChange={e => setForm({...form, iban: e.target.value})} placeholder="GB89..." />
                        </div>
                         <div className="space-y-2">
                            <Label className="text-xs">Sort Code</Label>
                            <Input className="h-8 text-sm" value={form.sort_code || ''} onChange={e => setForm({...form, sort_code: e.target.value})} placeholder="04-14..." />
                        </div>
                         <div className="space-y-2">
                            <Label className="text-xs">IFSC</Label>
                            <Input className="h-8 text-sm" value={form.ifsc_code || ''} onChange={e => setForm({...form, ifsc_code: e.target.value})} placeholder="SBIN..." />
                        </div>
                         <div className="space-y-2">
                            <Label className="text-xs">UPI ID</Label>
                            <Input className="h-8 text-sm" value={form.upi_id || ''} onChange={e => setForm({...form, upi_id: e.target.value})} placeholder="user@bank" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Branch Address</Label>
                        <Textarea 
                            value={form.branch_address || ''} 
                            onChange={e => setForm({...form, branch_address: e.target.value})} 
                            placeholder="Full address of the bank branch..."
                            className="min-h-[60px]"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={saveBank}>Save Account</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </Card>
  );
}