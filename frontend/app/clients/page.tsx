"use client";

import React, { useEffect, useState } from 'react';
import api from "@/lib/api";
import { Plus, Search, Loader2, MoreHorizontal, Mail, Phone, MapPin, Filter } from "lucide-react";
import Link from "next/link";
import { useRouter } from 'next/navigation';

// --- Static Map for Indian States (GST Codes) ---
const STATE_MAP: Record<number, string> = {
  1: "Jammu & Kashmir", 2: "Himachal Pradesh", 3: "Punjab", 4: "Chandigarh",
  5: "Uttarakhand", 6: "Haryana", 7: "Delhi", 8: "Rajasthan", 9: "Uttar Pradesh",
  10: "Bihar", 11: "Sikkim", 12: "Arunachal Pradesh", 13: "Nagaland", 14: "Manipur",
  15: "Mizoram", 16: "Tripura", 17: "Meghalaya", 18: "Assam", 19: "West Bengal",
  20: "Jharkhand", 21: "Odisha", 22: "Chhattisgarh", 23: "Madhya Pradesh",
  24: "Gujarat", 25: "Daman & Diu", 26: "Dadra & Nagar Haveli", 27: "Maharashtra",
  29: "Karnataka", 30: "Goa", 31: "Lakshadweep", 32: "Kerala", 33: "Tamil Nadu",
  34: "Puducherry", 35: "Andaman & Nicobar", 36: "Telangana", 37: "Andhra Pradesh",
  38: "Ladakh", 97: "Other Territory", 99: "International"
};

export default function ClientListPage() {
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [filteredClients, setFilteredClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("ALL");
  const [dropdownOpen, setDropdownOpen] = useState<number | null>(null);

  const fetchClients = async () => {
    try {
      const res = await api.get('/clients?limit=500');
      setClients(res.data.data || []);
      setFilteredClients(res.data.data || []);
    } catch (err) {
      console.error("Failed to load clients", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  // Filter Logic
  useEffect(() => {
    let temp = clients;

    // 1. Search
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        temp = temp.filter(c => 
            c.company_name.toLowerCase().includes(lower) || 
            (c.email && c.email.toLowerCase().includes(lower))
        );
    }

    // 2. Location
    if (locationFilter !== "ALL") {
        temp = temp.filter(c => {
            if (locationFilter === 'DOMESTIC') return c.country === 'India';
            if (locationFilter === 'INTERNATIONAL') return c.country !== 'India';
            return true;
        });
    }

    setFilteredClients(temp);
  }, [clients, searchTerm, locationFilter]);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure? This will delete the client and unlink their invoices.")) return;
    try {
        await api.delete(`/clients/${id}`);
        fetchClients(); // Refresh list
    } catch (e) {
        alert("Failed to delete client");
    }
  };

  // Helper to format location display
  const getLocationDisplay = (client: any) => {
    // 1. Try City + Country
    if (client.addresses?.billing?.city) {
        return `${client.addresses.billing.city}, ${client.country}`;
    }
    
    // 2. If India, try State Name
    if (client.country === 'India' && client.state_code) {
        return `${STATE_MAP[client.state_code] || client.state_code} - India`;
    }

    // 3. Fallback to Country only
    return client.country;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Clients</h1>
          <p className="text-gray-400 mt-1">Manage your customer database</p>
        </div>
        <Link href="/clients/new">
          <button className="btn-primary flex items-center">
            <Plus className="w-4 h-4 mr-2" /> Add Client
          </button>
        </Link>
      </div>

      {/* Filters Bar */}
      <div className="glass-panel p-4 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input 
                placeholder="Search clients..." 
                className="input-dark w-full pl-10" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
          </div>
          <div className="relative w-full md:w-[200px]">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select 
                className="input-dark w-full pl-10 appearance-none"
                value={locationFilter} 
                onChange={(e) => setLocationFilter(e.target.value)}
              >
                  <option value="ALL">All Locations</option>
                  <option value="DOMESTIC">Domestic (India)</option>
                  <option value="INTERNATIONAL">International</option>
              </select>
          </div>
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="p-6 border-b border-white/5">
            <h2 className="text-xl font-semibold text-white">All Clients</h2>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-10 text-center text-gray-400 flex justify-center items-center">
                <Loader2 className="animate-spin w-5 h-5 mr-3 text-cyan-400" /> Loading records...
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="p-4 text-sm font-medium text-gray-300">Company Name</th>
                  <th className="p-4 text-sm font-medium text-gray-300">Tax ID / GSTIN</th>
                  <th className="p-4 text-sm font-medium text-gray-300">Location</th>
                  <th className="p-4 text-sm font-medium text-gray-300">Contact Info</th>
                  <th className="p-4 text-sm font-medium text-gray-300 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredClients.length === 0 && (
                   <tr>
                     <td colSpan={5} className="text-center py-10 text-gray-400">
                        No clients match your search.
                     </td>
                   </tr>
                )}
                
                {filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-4 font-medium text-white">
                        {client.company_name}
                    </td>
                    <td className="p-4 font-mono text-xs text-gray-400">
                        {client.tax_id || "N/A"}
                    </td>
                    <td className="p-4">
                        <div className="flex items-center text-gray-400 text-sm">
                            <MapPin className="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
                            {getLocationDisplay(client)}
                        </div>
                    </td>
                    <td className="p-4">
                        <div className="flex flex-col gap-1.5 text-xs text-gray-400">
                            {client.email && <span className="flex items-center"><Mail className="w-3.5 h-3.5 mr-1.5 text-gray-500"/> {client.email}</span>}
                            {client.phone && <span className="flex items-center"><Phone className="w-3.5 h-3.5 mr-1.5 text-gray-500"/> {client.phone}</span>}
                        </div>
                    </td>
                    <td className="p-4 text-right">
                       <div className="relative inline-block text-left">
                          <button 
                            onClick={() => setDropdownOpen(dropdownOpen === client.id ? null : client.id)}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors"
                          >
                              <MoreHorizontal className="w-4 h-4 text-gray-400" />
                          </button>
                          {dropdownOpen === client.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(null)}></div>
                              <div className="absolute right-0 mt-2 w-32 rounded-lg shadow-xl glass-panel border border-white/10 z-20 overflow-hidden">
                                <button 
                                  onClick={() => router.push(`/clients/view?id=${client.id}`)}
                                  className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-white/10 transition-colors"
                                >
                                    Edit Details
                                </button>
                                <button 
                                  onClick={() => handleDelete(client.id)}
                                  className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-400/10 transition-colors"
                                >
                                    Delete
                                </button>
                              </div>
                            </>
                          )}
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}