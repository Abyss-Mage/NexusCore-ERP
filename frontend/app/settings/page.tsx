"use client";

import React, { useEffect, useState } from 'react';
import api from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Wallet, Upload, Mail, Users, FileText, Shield, Code, Palette, Download } from "lucide-react";
import { GeneralSettings } from '@/components/settings/GeneralSettings';
import { BrandingSettings } from '@/components/settings/BrandingSettings';
import { DocumentSettings } from '@/components/settings/DocumentSettings';
import { TemplateSettings } from '@/components/settings/TemplateSettings';
import { BankSettings } from '@/components/settings/BankSettings';
import { EmailSettings } from '@/components/settings/EmailSettings';
import { TeamSettings } from '@/components/settings/TeamSettings';
import { BackupSettings } from '@/components/settings/BackupSettings';
import { UpdateSettings } from '@/components/settings/UpdateSettings';
import { LocalizationSettings } from '@/components/settings/LocalizationSettings';
import { useRole } from "@/hooks/use-role";
import { useToast } from "@/components/ui/toast-context";

export default function SettingsPage() {
  const { isSudo } = useRole(); // True only if SUDO_ADMIN (Owner)
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>({});
  const [loading, setLoading] = useState(false);

  // Load Core Profile
  useEffect(() => {
    api.get('/settings/company').then(res => {
        if (res.data) setProfile(res.data);
    });
  }, []);

  // Handle Inputs (Blocked for non-Sudo)
  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (!isSudo) return; 
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  // Handle Save (Blocked for non-Sudo)
  const handleSaveProfile = async () => {
    // Corrected: Use simple message/type signature for toast
    if (!isSudo) return toast("Access Denied: Only the Owner can edit settings.", "error"); 
    
    setLoading(true);
    try { 
      await api.put('/settings/company', profile); 
      // Corrected: Use simple message/type signature for toast
      toast("Profile updated successfully!", "success"); 
    } catch (e) { 
      // Corrected: Use simple message/type signature for toast
      toast("Failed to update profile.", "error"); 
    } finally { 
      setLoading(false); 
    }
  };

  // Handle Uploads (Blocked for non-Sudo)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    // Corrected: Use simple message/type signature for toast
    if (!isSudo) return toast("Access Denied: Only the Owner can upload files.", "error");
    
    const file = e.target.files?.[0];
    if (!file) return;
    
    const formData = new FormData(); 
    formData.append('file', file);
    
    try {
      const res = await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setProfile((prev: any) => ({ ...prev, [field]: res.data.filePath }));
      // Corrected: Use simple message/type signature for toast
      toast("File uploaded successfully", "success");
    } catch (err) { 
      // Corrected: Use simple message/type signature for toast
      toast("Upload failed", "error"); 
    }
  };

  // Read-Only Flag (True for Admins, False for Owner)
  const isReadOnly = !isSudo;

  return (
    <div className="p-6 space-y-8 max-w-[1600px] mx-auto">
      
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage company profile and system configurations.</p>
        {isReadOnly && (
          <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 w-fit mt-2">
            View Only Mode
          </div>
        )}
      </div>

      <Tabs defaultValue="general" className="w-full space-y-6">
        
        <div className="bg-card p-1 rounded-xl border border-border inline-flex shadow-sm overflow-x-auto max-w-full">
          <TabsList className="bg-transparent h-auto p-0 gap-1 flex">
            <TabItem value="general" icon={<Building2 className="w-4 h-4"/>} label="Profile" />
            <TabItem value="branding" icon={<Upload className="w-4 h-4"/>} label="Branding" />
            <TabItem value="documents" icon={<FileText className="w-4 h-4"/>} label="Documents" />
            <TabItem value="templates" icon={<Palette className="w-4 h-4"/>} label="Templates" />
            <TabItem value="bank" icon={<Wallet className="w-4 h-4"/>} label="Banking" />
            <TabItem value="email" icon={<Mail className="w-4 h-4"/>} label="Email" />
            <TabItem value="localization" icon={<Building2 className="w-4 h-4"/>} label="Localization" />
            <TabItem value="team" icon={<Users className="w-4 h-4"/>} label="Team" />
            {/* Backup & Updates are strictly hidden for non-Owners */}
            {isSudo && <TabItem value="backup" icon={<Shield className="w-4 h-4"/>} label="Data" />}
            {isSudo && <TabItem value="updates" icon={<Download className="w-4 h-4"/>} label="Updates" />}
          </TabsList>
        </div>

        {/* CONTENT TABS (Passing disabled={isReadOnly} to all) */}
        
        <TabsContent value="general">
           <GeneralSettings profile={profile} handleChange={handleProfileChange} handleSave={handleSaveProfile} loading={loading} disabled={isReadOnly} />
        </TabsContent>
        
        <TabsContent value="branding">
           <BrandingSettings profile={profile} handleFileUpload={handleFileUpload} handleSave={handleSaveProfile} loading={loading} disabled={isReadOnly} />
        </TabsContent>

        <TabsContent value="documents">
          <DocumentSettings disabled={isReadOnly} />
        </TabsContent>

        <TabsContent value="templates">
          <TemplateSettings disabled={isReadOnly} />
        </TabsContent>

        <TabsContent value="bank">
          <BankSettings disabled={isReadOnly} />
        </TabsContent>

        <TabsContent value="email">
          <EmailSettings disabled={isReadOnly} />
        </TabsContent>

        <TabsContent value="localization">
          <LocalizationSettings disabled={isReadOnly} />
        </TabsContent>

        <TabsContent value="team">
          <TeamSettings disabled={isReadOnly} />
        </TabsContent>

        {isSudo && (
          <TabsContent value="backup">
            <BackupSettings />
          </TabsContent>
        )}

        {isSudo && (
          <TabsContent value="updates">
            <UpdateSettings disabled={isReadOnly} />
          </TabsContent>
        )}

      </Tabs>
    </div>
  );
}

function TabItem({ value, icon, label }: any) {
    return (
        <TabsTrigger 
            value={value} 
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
        >
            {icon} <span>{label}</span>
        </TabsTrigger>
    )
}
