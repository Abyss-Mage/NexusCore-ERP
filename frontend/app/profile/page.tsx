"use client";

import React, { useEffect, useState } from 'react';
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { Shield, Lock, User, Loader2, CheckCircle, AlertTriangle, QrCode } from "lucide-react";
import { useToast } from "@/components/ui/toast-context";

export default function ProfilePage() {
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Profile Form State
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Security PIN / Vault Passcode State
  const [vaultPIN, setVaultPIN] = useState("");
  const [vaultCurrentPassword, setVaultCurrentPassword] = useState("");
  const [hasVaultPIN, setHasVaultPIN] = useState(false);
  const [isSavingPIN, setIsSavingPIN] = useState(false);

  // 2FA State
  const [is2faModalOpen, setIs2faModalOpen] = useState(false);
  const [isDisableDialogOpen, setIsDisableDialogOpen] = useState(false); // <--- NEW STATE
  const [qrCode, setQrCode] = useState("");
  const [totpToken, setTotpToken] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);

  // 1. Fetch User Data
  const loadProfile = async () => {
    try {
      const [res, pinRes] = await Promise.all([
        api.get('/profile'),
        api.get('/vault/pin-status').catch(() => ({ data: { has_pin: false } }))
      ]);
      setUser(res.data);
      setEmail(res.data.email);
      setHasVaultPIN(pinRes.data?.has_pin || false);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    loadProfile();
  }, []);

  // 2. Update Profile Handler
  const handleUpdateProfile = async () => {
    if (!currentPassword) return toast("Current Password is required", "error");
    setIsSaving(true);
    try {
      await api.put('/profile', { email, currentPassword, newPassword });
      toast("Profile updated successfully!", "success");
      setNewPassword(""); 
      setCurrentPassword("");
    } catch (e: any) {
      toast(e.response?.data?.error || "Update failed", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // 3. Security PIN / Vault Passcode Handler
  const handleSavePIN = async () => {
    if (!vaultPIN || !/^\d{6}$/.test(vaultPIN)) return toast("Security PIN must be exactly 6 digits (0-9)", "error");
    if (!vaultCurrentPassword) return toast("Current Password is required", "error");
    setIsSavingPIN(true);
    try {
      await api.post('/vault/set-pin', { pin: vaultPIN, currentPassword: vaultCurrentPassword });
      toast("Security PIN updated successfully!", "success");
      setVaultPIN("");
      setVaultCurrentPassword("");
      setHasVaultPIN(true);
    } catch (e: any) {
      toast(e.response?.data?.error || "Failed to update Security PIN", "error");
    } finally {
      setIsSavingPIN(false);
    }
  };

  // 4. 2FA Handlers
  const initiate2fa = async () => {
    try {
      const res = await api.post('/2fa/generate');
      setQrCode(res.data.qrCode);
      setIs2faModalOpen(true);
    } catch (e) { toast("Failed to generate 2FA", "error"); }
  };

  const verify2fa = async () => {
    setIsVerifying(true);
    try {
      await api.post('/2fa/enable', { token: totpToken });
      toast("2FA Enabled Successfully!", "success");
      setIs2faModalOpen(false);
      loadProfile(); 
    } catch (e) {
      toast("Invalid Code. Try again.", "error");
    } finally {
      setIsVerifying(false);
    }
  };

  // Replaces native confirm()
  const handleDisableClick = () => {
      setIsDisableDialogOpen(true);
  };

  const confirmDisable2fa = async () => {
    setIsDisabling(true);
    try {
      await api.post('/2fa/disable');
      toast("Two-Factor Authentication Disabled", "info");
      loadProfile();
      setIsDisableDialogOpen(false);
    } catch (e) { 
      toast("Failed to disable 2FA", "error"); 
    } finally {
      setIsDisabling(false);
    }
  };

  if (loading) return <div className="p-10 text-center">Loading profile...</div>;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-foreground">My Profile</h1>
        <p className="text-muted-foreground">Manage your account settings and security.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* LEFT: ACCOUNT DETAILS */}
        <Card className="shadow-horizon border-none bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><User className="w-5 h-5 text-primary"/> Account Details</CardTitle>
            <CardDescription>Update your login credentials.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="space-y-2">
                <Label>Email Address</Label>
                <Input value={email} onChange={e => setEmail(e.target.value)} />
             </div>
             
             <div className="pt-4 border-t space-y-4">
                <h4 className="text-sm font-semibold text-foreground">Change Password</h4>
                <div className="space-y-2">
                    <Label>New Password</Label>
                    <Input type="password" placeholder="Leave blank to keep current" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                </div>
             </div>

             <div className="pt-4 border-t space-y-2">
                <Label className="text-red-500">Current Password (Required)</Label>
                <Input type="password" placeholder="Verify identity to save" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
             </div>
          </CardContent>
          <CardFooter className="justify-end">
             <Button onClick={handleUpdateProfile} disabled={isSaving} className="bg-primary text-primary-foreground">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <CheckCircle className="w-4 h-4 mr-2"/>}
                Save Changes
             </Button>
          </CardFooter>
        </Card>

        {/* RIGHT COLUMN: SECURITY (PIN & 2FA) */}
        <div className="space-y-6">
          {/* SECURITY PIN / VAULT PASSCODE CARD */}
          <Card className="shadow-horizon border-none bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Lock className="w-5 h-5 text-primary"/> Security PIN / Vault Passcode</CardTitle>
              <CardDescription>Set a 6-digit master PIN for Vault &amp; 2FA login.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-border">
                  <span className="text-sm font-medium">PIN Status</span>
                  {hasVaultPIN 
                     ? <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Configured</Badge>
                     : <Badge variant="destructive">Not Set</Badge>
                  }
               </div>

               <div className="space-y-2">
                  <Label>Master Security PIN (6 digits)</Label>
                  <Input 
                    type="password" 
                    placeholder="Enter 6-digit PIN (e.g. 849201)" 
                    maxLength={6} 
                    inputMode="numeric"
                    value={vaultPIN} 
                    onChange={e => setVaultPIN(e.target.value.replace(/\D/g, '').slice(0, 6))} 
                  />
               </div>

               <div className="space-y-2">
                  <Label className="text-red-500">Current Password (Required)</Label>
                  <Input 
                    type="password" 
                    placeholder="Enter password to confirm" 
                    value={vaultCurrentPassword} 
                    onChange={e => setVaultCurrentPassword(e.target.value)} 
                  />
               </div>
            </CardContent>
            <CardFooter className="justify-end">
               <Button onClick={handleSavePIN} disabled={isSavingPIN || vaultPIN.length !== 6} className="bg-primary text-primary-foreground">
                  {isSavingPIN ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <CheckCircle className="w-4 h-4 mr-2"/>}
                  Set Security PIN
               </Button>
            </CardFooter>
          </Card>


          {/* TWO-FACTOR AUTH (2FA) */}
          <Card className="shadow-horizon border-none bg-card h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-primary"/> Two-Factor Authentication (2FA)</CardTitle>
              <CardDescription>Authenticator app integration (Google Authenticator / Authy).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
               
               <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-border">
                  <div className="space-y-1">
                      <span className="text-sm font-medium">Status</span>
                      <div className="flex items-center gap-2">
                          {user.two_factor_enabled 
                             ? <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Enabled</Badge> 
                             : <Badge variant="secondary">Disabled</Badge>
                          }
                      </div>
                  </div>
                  <Lock className={`w-8 h-8 ${user.two_factor_enabled ? 'text-green-500' : 'text-slate-300'}`} />
               </div>

               <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                      {user.two_factor_enabled 
                         ? "Authenticator 2FA is active. You can sign in using either your Authenticator app code or your Security PIN."
                         : "Scan a QR code with an authenticator app for secondary verification."
                      }
                  </p>
                  
                  {user.two_factor_enabled ? (
                      <Button variant="destructive" onClick={handleDisableClick} className="w-full">Disable 2FA</Button>
                  ) : (
                      <Button variant="outline" onClick={initiate2fa} className="w-full border-primary text-primary hover:bg-primary/10">Enable 2FA</Button>
                  )}
               </div>

            </CardContent>
          </Card>
        </div>
      </div>


      {/* 2FA SETUP MODAL */}
      <Dialog open={is2faModalOpen} onOpenChange={setIs2faModalOpen}>
         <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><QrCode className="w-5 h-5"/> Setup 2FA</DialogTitle>
                <DialogDescription>Scan the QR code with Google Authenticator or Authy.</DialogDescription>
            </DialogHeader>
            
            <div className="flex flex-col items-center space-y-4 py-4">
                {qrCode ? (
                    <img src={qrCode} alt="2FA QR" className="w-48 h-48 border rounded-lg" />
                ) : <Loader2 className="animate-spin" />}
                
                <div className="w-full space-y-2">
                    <Label>Enter Code</Label>
                    <Input 
                        placeholder="000 000" 
                        className="text-center text-lg tracking-widest font-mono"
                        value={totpToken}
                        onChange={e => setTotpToken(e.target.value)}
                        maxLength={6}
                    />
                </div>
            </div>

            <DialogFooter>
                <Button onClick={verify2fa} disabled={isVerifying || totpToken.length < 6} className="w-full bg-primary">
                    {isVerifying ? "Verifying..." : "Verify & Activate"}
                </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      {/* DISABLE 2FA CONFIRMATION MODAL */}
      <Dialog open={isDisableDialogOpen} onOpenChange={setIsDisableDialogOpen}>
         <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="w-5 h-5"/> Disable Security?</DialogTitle>
                <DialogDescription>
                    Are you sure you want to disable Two-Factor Authentication? 
                    <br/><br/>
                    This will make your account less secure. You will rely solely on your password for login.
                </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setIsDisableDialogOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={confirmDisable2fa} disabled={isDisabling}>
                    {isDisabling ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : "Yes, Disable 2FA"}
                </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

    </div>
  );
}