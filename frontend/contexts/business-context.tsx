"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import api from "@/lib/api";

export interface BusinessUnit {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
  invoice_prefix: string;
  quotation_prefix: string;
  active_modules: string[];
  currency: string;
  tax_id?: string;
  email?: string;
  website?: string;
  is_default: boolean;
  invoice_count: number;
  client_count: number;
  total_revenue: number;
}

interface BusinessContextType {
  currentBusiness: string;
  activeUnit: BusinessUnit | null;
  businessUnits: BusinessUnit[];
  setBusinessUnit: (id: string) => void;
  isTYT: boolean;
  isSafehouse: boolean;
  isAll: boolean;
  hasModule: (moduleName: string) => boolean;
  refreshBusinessUnits: () => Promise<void>;
  createBusinessUnit: (data: Partial<BusinessUnit>) => Promise<BusinessUnit>;
}

const DEFAULT_UNITS: BusinessUnit[] = [
  {
    id: "safehouse",
    code: "SHS",
    name: "Safehouse Studios",
    category: "Software Agency",
    description: "Custom Web, Mobile & Cloud Engineering, Sprint Milestones, Retainers & Hosting",
    invoice_prefix: "SHS-INV-",
    quotation_prefix: "SHS-QT-",
    active_modules: ["core", "software"],
    currency: "INR",
    is_default: true,
    invoice_count: 0,
    client_count: 0,
    total_revenue: 0,
  },
  {
    id: "tytgear",
    code: "TYT",
    name: "TYTGEAR",
    category: "E-Commerce & 3D Prints",
    description: "Gaming Gear, Custom Mousepads, Tapestries, Posters, 3D Prints & Keyboards",
    invoice_prefix: "TYT-INV-",
    quotation_prefix: "TYT-QT-",
    active_modules: ["core", "3d", "ecommerce"],
    currency: "INR",
    is_default: false,
    invoice_count: 0,
    client_count: 0,
    total_revenue: 0,
  }
];

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const [currentBusiness, setCurrentBusinessState] = useState<string>("safehouse");
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>(DEFAULT_UNITS);
  const [activeUnit, setActiveUnit] = useState<BusinessUnit | null>(DEFAULT_UNITS[0]);

  const fetchUnits = async () => {
    try {
      const res = await api.get('/business-units');
      const units = res.data.data && res.data.data.length > 0 ? res.data.data : DEFAULT_UNITS;
      setBusinessUnits(units);

      let saved = typeof window !== "undefined" ? localStorage.getItem("active_business_unit") : null;
      if (saved === "all" || !saved || !units.some((u: BusinessUnit) => u.id === saved)) {
        saved = units.find((u: BusinessUnit) => u.is_default)?.id || units[0].id;
      }
      
      setBusinessUnit(saved, units);
    } catch (e) {
      console.error("Failed to load business units", e);
      let saved = typeof window !== "undefined" ? localStorage.getItem("active_business_unit") : null;
      if (saved === "all" || !saved) saved = "safehouse";
      setBusinessUnit(saved, DEFAULT_UNITS);
    }
  };

  const setBusinessUnit = (id: string, unitsList = businessUnits) => {
    const pool = unitsList && unitsList.length > 0 ? unitsList : DEFAULT_UNITS;
    const targetId = (id === "all" || !id) ? (pool.find(u => u.is_default)?.id || pool[0].id) : id;
    
    setCurrentBusinessState(targetId);
    if (typeof window !== "undefined") {
      localStorage.setItem("active_business_unit", targetId);
    }

    api.defaults.headers.common["X-Business-Unit-ID"] = targetId;
    const match = pool.find(u => u.id === targetId) || pool[0] || null;
    setActiveUnit(match);
  };

  const createBusinessUnit = async (data: Partial<BusinessUnit>): Promise<BusinessUnit> => {
    const res = await api.post('/business-units', data);
    const newUnit = res.data.data || res.data;
    await fetchUnits();
    if (newUnit && newUnit.id) {
      setBusinessUnit(newUnit.id);
    }
    return newUnit;
  };

  const hasModule = (moduleName: string): boolean => {
    if (!activeUnit || !activeUnit.active_modules) return true;
    return activeUnit.active_modules.includes(moduleName) || activeUnit.active_modules.includes("all");
  };

  useEffect(() => {
    fetchUnits();
  }, []);

  const value: BusinessContextType = {
    currentBusiness,
    activeUnit,
    businessUnits,
    setBusinessUnit,
    isTYT: currentBusiness === "tytgear",
    isSafehouse: currentBusiness === "safehouse",
    isAll: false, // Single company view strictly enforced
    hasModule,
    refreshBusinessUnits: fetchUnits,
    createBusinessUnit,
  };

  return (
    <BusinessContext.Provider value={value}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const context = useContext(BusinessContext);
  if (!context) {
    throw new Error("useBusiness must be used within a BusinessProvider");
  }
  return context;
}
