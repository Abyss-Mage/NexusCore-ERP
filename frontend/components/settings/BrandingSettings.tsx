"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Image as ImageIcon, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SoftwareNameSetting } from './SoftwareNameSetting'; // <-- ADDED IMPORT

interface BrandingSettingsProps {
  profile: any;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>, field: string) => void;
  handleSave: () => void;
  loading: boolean;
  disabled?: boolean; // Controls Read-Only Mode (true for Admins, false for Sudo)
}

export function BrandingSettings({ profile, handleFileUpload, handleSave, loading, disabled }: BrandingSettingsProps) {
  return (
    <Card className="shadow-horizon border-none bg-card">
      <CardHeader>
        <CardTitle>Branding Assets</CardTitle>
        <CardDescription>Upload logos and signatures for your documents.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* ADDED: Application Name Setting */}
        <SoftwareNameSetting /> 
        
        <h3 className="font-bold text-lg border-t pt-6">Document Assets</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <UploadCard 
             title="Company Logo" 
             desc="Top-left of invoice" 
             src={profile.logo} 
             onUpload={(e: any) => handleFileUpload(e, 'logo')}
             disabled={disabled}
          />
          <UploadCard 
             title="Signature" 
             desc="Bottom-right (Auth)" 
             src={profile.signature} 
             onUpload={(e: any) => handleFileUpload(e, 'signature')}
             disabled={disabled}
          />
          <UploadCard 
             title="Official Stamp" 
             desc="Overlays signature" 
             src={profile.stamp} 
             onUpload={(e: any) => handleFileUpload(e, 'stamp')}
             disabled={disabled}
          />
        </div>

        {/* Footer Action Area (For Logo/Signature Saves) */}
        <div className="flex justify-end pt-4 border-t border-border">
           {!disabled ? (
               <Button onClick={handleSave} disabled={loading} className="bg-primary text-primary-foreground min-w-[140px]">
                 {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <><Save className="w-4 h-4 mr-2" /> Save Asset Changes</>}
               </Button>
           ) : (
               <p className="text-sm text-muted-foreground italic flex items-center">
                  <span className="w-2 h-2 bg-amber-500 rounded-full mr-2"></span>
                  View Only Mode (Contact Owner to edit)
               </p>
           )}
        </div>

      </CardContent>
    </Card>
  );
}

function UploadCard({ title, desc, src, onUpload, disabled }: any) {
    return (
        <div className="rounded-xl border border-border p-4 flex flex-col gap-4 bg-background/50 hover:border-primary/50 transition-colors">
            <div className="flex justify-between items-start">
                <div><h4 className="font-semibold text-sm">{title}</h4><p className="text-xs text-muted-foreground">{desc}</p></div>
                <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground"><ImageIcon className="w-4 h-4"/></div>
            </div>
            
            <div className="relative aspect-video bg-slate-100 dark:bg-slate-900 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden group">
                {src ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={src} alt="Preview" className="w-full h-full object-contain p-2" />
                ) : <span className="text-xs text-muted-foreground">Empty</span>}
                
                {/* Only show upload overlay if NOT disabled */}
                {!disabled && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <label className="cursor-pointer bg-white text-black px-4 py-2 rounded-full text-xs font-bold hover:scale-105 transition-transform shadow-lg">
                            Upload
                            <input type="file" className="hidden" accept="image/*" onChange={onUpload} />
                        </label>
                    </div>
                )}
            </div>
        </div>
    )
}