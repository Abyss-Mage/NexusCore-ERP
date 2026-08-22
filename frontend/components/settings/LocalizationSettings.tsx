"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, Plus, Trash2 } from "lucide-react";
import api from "@/lib/api";
import { useToast } from "@/components/ui/toast-context";

interface TaxLayer {
  name: string;
  rate: number;
}

interface LocalizationProfile {
  base_currency: string;
  item_code_label: string;
  layers: TaxLayer[];
}

export function LocalizationSettings({ disabled }: { disabled: boolean }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<LocalizationProfile>({
    base_currency: "INR",
    item_code_label: "HSN / SAC",
    layers: []
  });

  useEffect(() => {
    api.get('/settings/LOCALIZATION').then(res => {
      if (res.data && res.data.value) {
        try {
          const parsed = typeof res.data.value === 'string' ? JSON.parse(res.data.value) : res.data.value;
          setProfile(parsed);
        } catch(e) {}
      }
    });
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.post('/settings/LOCALIZATION', profile);
      toast("Localization settings updated", "success");
      // Also save TAX_SETTINGS for backward compatibility if needed, but we can just use LOCALIZATION or map it.
      // Wait, the backend looks for TAX_SETTINGS in tax.go! Let's save a copy to TAX_SETTINGS.
      await api.post('/settings/TAX_SETTINGS', { layers: profile.layers });
    } catch (e) {
      toast("Failed to update settings", "error");
    } finally {
      setLoading(false);
    }
  };

  const addLayer = () => {
    setProfile({
      ...profile,
      layers: [...profile.layers, { name: "", rate: 0 }]
    });
  };

  const removeLayer = (idx: number) => {
    const newLayers = [...profile.layers];
    newLayers.splice(idx, 1);
    setProfile({ ...profile, layers: newLayers });
  };

  const updateLayer = (idx: number, field: keyof TaxLayer, value: any) => {
    const newLayers = [...profile.layers];
    newLayers[idx] = { ...newLayers[idx], [field]: value };
    setProfile({ ...profile, layers: newLayers });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Regional Preferences</CardTitle>
          <CardDescription>Configure your base currency and terminology.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Base Currency (e.g., USD, INR, EUR)</Label>
              <select
                value={profile.base_currency}
                onChange={(e) => setProfile({...profile, base_currency: e.target.value})}
                disabled={disabled}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="INR">INR - Indian Rupee</option>
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="AUD">AUD - Australian Dollar</option>
                <option value="CAD">CAD - Canadian Dollar</option>
                <option value="JPY">JPY - Japanese Yen</option>
              </select>
              <p className="text-xs text-muted-foreground">Invoices in other currencies will be tracked against this base using live exchange rates.</p>
            </div>
            <div className="space-y-2">
              <Label>Item Code Label</Label>
              <Input 
                value={profile.item_code_label} 
                onChange={(e) => setProfile({...profile, item_code_label: e.target.value})}
                disabled={disabled}
                placeholder="e.g. HSN, SKU, Item Code"
              />
              <p className="text-xs text-muted-foreground">This label will be displayed on invoice tables.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Global Tax Layers</CardTitle>
          <CardDescription>Define the standard taxes that apply to your invoices (e.g. VAT @ 20%).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {profile.layers.map((layer, idx) => (
            <div key={idx} className="flex gap-4 items-end bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border">
              <div className="space-y-1 flex-1">
                <Label>Tax Name</Label>
                <Input 
                  placeholder="e.g. VAT, State Tax" 
                  value={layer.name} 
                  onChange={(e) => updateLayer(idx, 'name', e.target.value)}
                  disabled={disabled}
                />
              </div>
              <div className="space-y-1 flex-1">
                <Label>Rate (%)</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={layer.rate} 
                  onChange={(e) => updateLayer(idx, 'rate', parseFloat(e.target.value) || 0)}
                  disabled={disabled}
                />
              </div>
              <Button variant="ghost" size="icon" className="text-red-500" onClick={() => removeLayer(idx)} disabled={disabled}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" className="w-full border-dashed" onClick={addLayer} disabled={disabled}>
            <Plus className="w-4 h-4 mr-2" /> Add Tax Layer
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={loading || disabled}>
          <Save className="w-4 h-4 mr-2" /> Save Settings
        </Button>
      </div>
    </div>
  );
}
