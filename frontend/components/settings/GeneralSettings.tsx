"use client";

import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

interface GeneralSettingsProps {
  profile: any;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  handleSave: () => void;
  loading: boolean;
  disabled?: boolean;
}

export function GeneralSettings({ profile, handleChange, handleSave, loading, disabled }: GeneralSettingsProps) {
  const [states, setStates] = useState<any[]>([]);

  // Fetch States for the Dropdown
  useEffect(() => {
    const fetchStates = async () => {
      try {
        const res = await api.get('/utils/states');
        if (Array.isArray(res.data)) {
            setStates(res.data);
        }
      } catch (error) {
        console.error("Failed to load states", error);
      }
    };
    fetchStates();
  }, []);

  // Helper to bridge Shadcn Select (which returns string) to your existing handleChange
  const handleSelectChange = (value: string) => {
    const syntheticEvent = {
      target: {
        name: 'state_code',
        value: value
      }
    } as unknown as React.ChangeEvent<HTMLSelectElement>;
    
    handleChange(syntheticEvent);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2">
        <Card className="shadow-horizon border-none bg-card">
          <CardHeader>
            <CardTitle>Company Details</CardTitle>
            <CardDescription>Legal information used on invoices.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Top Grid: Name, GSTIN, CIN */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input 
                  name="company_name" 
                  value={profile.company_name || ''} 
                  onChange={handleChange} 
                  disabled={disabled}
                />
              </div>
              <div className="space-y-2">
                <Label>GSTIN / Tax ID</Label>
                <Input 
                  name="gstin" 
                  value={profile.gstin || ''} 
                  onChange={handleChange} 
                  disabled={disabled}
                />
              </div>
              <div className="space-y-2">
                <Label>CIN Number</Label>
                <Input 
                  name="cin" 
                  value={profile.cin || ''} 
                  onChange={handleChange} 
                  placeholder="U12345MH..."
                  disabled={disabled}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Office Address</Label>
              <Textarea 
                name="address" 
                value={profile.address || ''} 
                onChange={handleChange} 
                className="min-h-[100px]" 
                disabled={disabled}
              />
            </div>

            {/* Bottom Grid: Contact Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                    <Label>State (Place of Supply)</Label>
                    <Select 
                        value={profile.state_code ? String(profile.state_code) : ""} 
                        onValueChange={handleSelectChange}
                        disabled={disabled}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select State" />
                        </SelectTrigger>
                        {/* FIXED: Added max-h-[200px] to force scrolling */}
                        <SelectContent className="max-h-[200px]">
                            {states.map((state) => (
                                <SelectItem key={state.code} value={String(state.code)}>
                                    {state.code} - {state.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input 
                        name="phone" 
                        value={profile.phone || ''} 
                        onChange={handleChange} 
                        disabled={disabled}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Email</Label>
                    <Input 
                        name="email" 
                        value={profile.email || ''} 
                        onChange={handleChange} 
                        disabled={disabled}
                    />
                </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t border-border">
              {!disabled ? (
                  <Button onClick={handleSave} disabled={loading} className="bg-primary text-primary-foreground min-w-[140px]">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Save Changes"}
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
      </div>
      
      {/* Help Panel */}
      <div className="xl:col-span-1">
          <Card className="bg-primary/5 border-primary/10">
              <CardHeader>
                  <CardTitle className="text-primary">Help & Tips</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-4 text-muted-foreground">
                  <p>
                      <strong>State Code:</strong> Essential for GST calculation. Selecting your state ensures that local sales (Same State) are taxed as CGST+SGST, while out-of-state sales are IGST.
                  </p>
                  <p>
                      <strong>CIN:</strong> Corporate Identity Number is required for registered companies in India.
                  </p>
                  <p>
                      <strong>Logo:</strong> Upload your logo in the &quot;Branding&quot; tab to see it on invoices.
                  </p>
              </CardContent>
          </Card>
      </div>
    </div>
  );
}
