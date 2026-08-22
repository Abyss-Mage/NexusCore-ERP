"use client";

import React, { useState, useEffect } from 'react';
import api from "@/lib/api";
import { Save, Loader2, ArrowLeft, Globe, MapPin, Building2, Receipt, Phone, Mail, Hash } from "lucide-react";
import { useRouter, useSearchParams } from 'next/navigation'; 
import Link from "next/link";
import { Suspense } from 'react';
import { useToast } from "@/components/ui/toast-context";

function EditClientContent() {
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams(); 
  const id = searchParams.get('id');
  
  const [loading, setLoading] = useState(true); // Page loading
  const [saving, setSaving] = useState(false);  // Save button loading
  const [statesLoading, setStatesLoading] = useState(false);

  const [countries, setCountries] = useState<any[]>([]);
  const [states, setStates] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    company_name: '',
    tax_id: '',
    cin: '', 
    state: '',
    country: '',
    email: '',
    phone: '',
    address_street: '',
    address_city: '',
    address_zip: ''
  });

  // 1. Fetch Countries & Client Data
  useEffect(() => {
    const init = async () => {
        try {
            // Fetch Countries first
            const countriesRes = await api.get('/utils/countries');
            setCountries(countriesRes.data);

            // Fetch Client
            const clientRes = await api.get(`/clients/${id}`);
            const c = clientRes.data;

            // Set Form Data
            setFormData({
                company_name: c.company_name,
                tax_id: c.tax_id || '',
                cin: c.cin || '',
                state: c.state || '',
                country: c.country,
                email: c.email || '',
                phone: c.phone || '',
                address_street: c.addresses?.billing?.street || '',
                address_city: c.addresses?.billing?.city || '',
                address_zip: c.addresses?.billing?.zip || ''
            });

            // Fetch States for the saved country immediately
            if (c.country) {
                fetchStates(c.country);
            }

        } catch (e) {
            console.error(e);
            toast("Failed to load data", "error");
        } finally {
            setLoading(false);
        }
    };

    if (id) init();
  }, [id]);

  // Helper: Fetch States
  const fetchStates = async (countryName: string) => {
    setStatesLoading(true);
    try {
      const res = await api.get(`/utils/states?country=${encodeURIComponent(countryName)}`);
      setStates(res.data);
    } catch (e) {
      console.error("Failed to load states");
    } finally {
      setStatesLoading(false);
    }
  };

  // 2. Handle Changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === "country") {
        // Country changed -> Reset state -> Fetch new states
        setFormData(prev => ({ ...prev, country: value, state: "" }));
        fetchStates(value);
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // 3. Submit
  const handleSubmit = async () => {
    if (!formData.company_name) return toast("Company Name is required.", "error");
    if (states.length > 0 && !formData.state) return toast("Please select a State/Province.", "error");

    setSaving(true);
    try {
      await api.put(`/clients/${id}`, formData);
      toast("Client updated successfully!", "success");
      router.push('/clients');
    } catch (e) {
      toast("Update failed", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
      return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-cyan-400"/></div>;
  }

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto space-y-6">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="flex items-center gap-4">
          <Link href="/clients">
             <button className="p-2 glass-panel hover:bg-white/10 text-gray-400 hover:text-white transition-colors rounded-xl">
                 <ArrowLeft className="w-5 h-5" />
             </button>
          </Link>
          <div>
             <h1 className="text-3xl font-bold text-white mb-1">Edit Client</h1>
             <p className="text-sm text-gray-400">Update customer information</p>
          </div>
        </div>
        
        <button onClick={handleSubmit} disabled={saving} className="btn-primary flex items-center shadow-lg shadow-cyan-500/20">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Update Client
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Company Details */}
        <div className="glass-panel p-6 space-y-6">
          <div className="border-b border-white/5 pb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-cyan-400" />
                Company Details
            </h2>
            <p className="text-sm text-gray-400 mt-1">Legal information for tax & invoicing</p>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Company Name *</label>
              <input 
                name="company_name" 
                value={formData.company_name} 
                onChange={handleChange} 
                className="input-dark w-full"
                placeholder="e.g. Acme Corp" 
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Country</label>
                <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <select
                        name="country"
                        className="input-dark w-full pl-10 appearance-none text-sm"
                        value={formData.country}
                        onChange={handleChange}
                    >
                        <option value="India">India</option>
                        {countries.filter(c => c.name !== 'India').map(c => (
                            <option key={c.iso_code} value={c.name}>{c.name}</option>
                        ))}
                    </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">State / Province {states.length > 0 && "*"}</label>
                <div className="relative">
                    {statesLoading && <Loader2 className="absolute right-8 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-cyan-400" />}
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    {states.length > 0 ? (
                        <select 
                            name="state" 
                            className="input-dark w-full pl-10 appearance-none text-sm disabled:opacity-50"
                            onChange={handleChange}
                            value={formData.state}
                            disabled={statesLoading}
                        >
                            <option value="">Select State...</option>
                            {states.map((state) => (
                                <option key={state.code} value={state.name}>
                                    {state.name}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <input 
                            name="state" 
                            className="input-dark w-full pl-10 text-sm disabled:opacity-50"
                            placeholder="e.g. California"
                            onChange={handleChange}
                            value={formData.state}
                            disabled={statesLoading}
                        />
                    )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                        <Receipt className="w-3.5 h-3.5 text-gray-500" /> 
                        Tax ID (GSTIN/VAT)
                    </label>
                    <input 
                        name="tax_id" 
                        value={formData.tax_id} 
                        onChange={handleChange} 
                        className="input-dark w-full"
                        placeholder="Optional" 
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                        <Hash className="w-3.5 h-3.5 text-gray-500" />
                        CIN / Reg No
                    </label>
                    <input 
                        name="cin" 
                        value={formData.cin} 
                        onChange={handleChange} 
                        className="input-dark w-full"
                        placeholder="Optional" 
                    />
                </div>
            </div>

          </div>
        </div>

        {/* Contact Info */}
        <div className="glass-panel p-6 space-y-6">
            <div className="border-b border-white/5 pb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Mail className="w-5 h-5 text-cyan-400" />
                    Contact Info
                </h2>
                <p className="text-sm text-gray-400 mt-1">Communication and billing details</p>
            </div>
            
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input 
                                name="email" 
                                type="email" 
                                className="input-dark w-full pl-10"
                                placeholder="client@example.com"
                                value={formData.email}
                                onChange={handleChange} 
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Phone</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input 
                                name="phone" 
                                type="tel" 
                                className="input-dark w-full pl-10"
                                placeholder="+1 (555) 000-0000"
                                value={formData.phone}
                                onChange={handleChange} 
                            />
                        </div>
                    </div>
                </div>
                
                <div className="pt-4 mt-2 border-t border-white/5 space-y-4">
                     <label className="flex items-center gap-2 text-sm font-bold text-cyan-400 uppercase tracking-wider">
                         <MapPin className="w-4 h-4"/> Billing Address
                     </label>
                     <div className="space-y-3">
                         <input 
                             name="address_street" 
                             className="input-dark w-full"
                             placeholder="Street Address"
                             value={formData.address_street} 
                             onChange={handleChange} 
                         />
                         <div className="grid grid-cols-2 gap-4">
                            <input 
                                name="address_city" 
                                className="input-dark w-full"
                                placeholder="City"
                                value={formData.address_city} 
                                onChange={handleChange} 
                            />
                            <input 
                                name="address_zip" 
                                className="input-dark w-full"
                                placeholder="Postal Code"
                                value={formData.address_zip} 
                                onChange={handleChange} 
                            />
                         </div>
                     </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}

export default function EditClientPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-cyan-400"/></div>}>
      <EditClientContent />
    </Suspense>
  );
}
