// frontend/app/setup/page.tsx

"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';
import { 
  Database, 
  UserPlus, 
  Building2, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  Code2, 
  Printer, 
  ShoppingBag, 
  ReceiptText, 
  Sparkles,
  Layers
} from 'lucide-react';

const rawApi = axios.create({ baseURL: '/api' });

const INDUSTRY_TEMPLATES = [
  {
    id: "software",
    name: "Software & IT Agency",
    icon: Code2,
    description: "Sprint Milestones, Retainers, Zero-Trust Vault & Project Proposals",
    modules: ["core", "software"]
  },
  {
    id: "3d",
    name: "3D Print Farm & Hardware",
    icon: Printer,
    description: "Bambu Lab Fleet Telemetry, Spool Inventory & Print Queues",
    modules: ["core", "3d"]
  },
  {
    id: "ecommerce",
    name: "E-Commerce & Retail",
    icon: ShoppingBag,
    description: "WooCommerce Ingestion, Auto Invoicing & Customer Fulfillment",
    modules: ["core", "ecommerce"]
  },
  {
    id: "invoicing",
    name: "Pure Invoicing & Accounting",
    icon: ReceiptText,
    description: "Professional Quotations, Multi-Currency Invoices & GST Reports",
    modules: ["core"]
  },
  {
    id: "hybrid",
    name: "Full Enterprise Suite",
    icon: Sparkles,
    description: "All Modules Enabled: Software, 3D Farm, E-Commerce & Invoicing",
    modules: ["core", "3d", "software", "ecommerce"]
  }
];

const CURRENCIES = [
  { code: "INR", label: "INR (₹) - Indian Rupee" },
  { code: "USD", label: "USD ($) - US Dollar" },
  { code: "EUR", label: "EUR (€) - Euro" },
  { code: "GBP", label: "GBP (£) - British Pound" },
  { code: "AED", label: "AED (د.إ) - UAE Dirham" },
  { code: "CAD", label: "CAD ($) - Canadian Dollar" },
  { code: "AUD", label: "AUD ($) - Australian Dollar" }
];

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  
  // Database Configuration
  const [dbConfig, setDbConfig] = useState({
    dbHost: 'postgres',
    dbPort: '5432',
    dbUser: 'postgres',
    dbPassword: '',
    dbName: 'nexus_db'
  });

  // Admin User Configuration
  const [adminConfig, setAdminConfig] = useState({
    adminEmail: 'admin@safehousestudios.tech',
    adminPassword: ''
  });

  // Initial Company Workspace Configuration
  const [companyConfig, setCompanyConfig] = useState({
    companyName: 'Safehouse Studios',
    companyCode: 'SHS',
    industry: 'software',
    currency: 'INR',
    taxId: '',
    modules: ['core', 'software']
  });

  const handleNameChange = (name: string) => {
    const code = name
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 4) || name.slice(0, 3).toUpperCase();

    setCompanyConfig(prev => ({
      ...prev,
      companyName: name,
      companyCode: prev.companyCode === '' || prev.companyCode === prev.companyName.slice(0, 3).toUpperCase() ? code : prev.companyCode
    }));
  };

  const handleIndustrySelect = (templateId: string) => {
    const selected = INDUSTRY_TEMPLATES.find(t => t.id === templateId);
    if (selected) {
      setCompanyConfig(prev => ({
        ...prev,
        industry: templateId,
        modules: selected.modules
      }));
    }
  };

  const handleSetup = async () => {
    if (!dbConfig.dbHost || !dbConfig.dbPort || !dbConfig.dbUser || !dbConfig.dbName) {
      setStep(1);
      return setError("Please fill in all database fields.");
    }
    if (!adminConfig.adminEmail || !adminConfig.adminPassword) {
      setStep(2);
      return setError("Please fill in admin email and password.");
    }
    if (adminConfig.adminPassword.length < 8) {
      setStep(2);
      return setError("Admin password must be at least 8 characters.");
    }
    if (!companyConfig.companyName.trim()) {
      setStep(3);
      return setError("Please enter your organization/company name.");
    }

    setLoading(true);
    setError("");

    try {
      const payload = {
        db_host: dbConfig.dbHost,
        db_port: dbConfig.dbPort,
        db_user: dbConfig.dbUser,
        db_password: dbConfig.dbPassword,
        db_name: dbConfig.dbName,
        email: adminConfig.adminEmail,
        password: adminConfig.adminPassword,
        company_name: companyConfig.companyName.trim(),
        company_code: companyConfig.companyCode.trim() || "ORG",
        industry: companyConfig.industry,
        currency: companyConfig.currency,
        tax_id: companyConfig.taxId.trim(),
        modules: companyConfig.modules
      };
      
      await rawApi.post('/auth/setup', payload);
      
      setSuccessMsg(`System initialized! Organization "${companyConfig.companyName}" and Admin User "${adminConfig.adminEmail}" ready.`);
      setTimeout(() => router.push('/login'), 2500);
      
    } catch (err: any) {
      console.error("Setup Error:", err);
      if (err.response?.status === 403 || err.response?.status === 400 && err.response?.data?.error === "System already configured") {
        setError("System is already configured. Redirecting to Login...");
        setTimeout(() => router.push('/login'), 2000);
      } else {
        setError(err.response?.data?.error || "Installation failed. Ensure PostgreSQL credentials are valid.");
      }
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch(step) {
      case 1:
        return (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                <Database className="w-5 h-5 text-primary" /> Step 1: Database Connection
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Connect to your PostgreSQL 16 server or Docker container.</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Host</label>
                <input 
                  className="w-full bg-secondary/60 border border-border focus:border-primary px-3.5 py-2 rounded-lg text-sm text-foreground outline-none transition-colors" 
                  value={dbConfig.dbHost} 
                  onChange={e => setDbConfig({...dbConfig, dbHost: e.target.value})} 
                  placeholder="postgres (or 127.0.0.1)"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Port</label>
                <input 
                  className="w-full bg-secondary/60 border border-border focus:border-primary px-3.5 py-2 rounded-lg text-sm text-foreground outline-none transition-colors" 
                  type="number" 
                  value={dbConfig.dbPort} 
                  onChange={e => setDbConfig({...dbConfig, dbPort: e.target.value})} 
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Database Name</label>
              <input 
                className="w-full bg-secondary/60 border border-border focus:border-primary px-3.5 py-2 rounded-lg text-sm text-foreground outline-none transition-colors" 
                value={dbConfig.dbName} 
                onChange={e => setDbConfig({...dbConfig, dbName: e.target.value})} 
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">User</label>
                <input 
                  className="w-full bg-secondary/60 border border-border focus:border-primary px-3.5 py-2 rounded-lg text-sm text-foreground outline-none transition-colors" 
                  value={dbConfig.dbUser} 
                  onChange={e => setDbConfig({...dbConfig, dbUser: e.target.value})} 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Password</label>
                <input 
                  className="w-full bg-secondary/60 border border-border focus:border-primary px-3.5 py-2 rounded-lg text-sm text-foreground outline-none transition-colors" 
                  type="password" 
                  value={dbConfig.dbPassword} 
                  onChange={e => setDbConfig({...dbConfig, dbPassword: e.target.value})} 
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button 
              onClick={() => {
                if (!dbConfig.dbHost || !dbConfig.dbName || !dbConfig.dbUser) {
                  return setError("Please fill in required database fields.");
                }
                setError("");
                setStep(2);
              }} 
              className="w-full py-2.5 mt-2 bg-primary hover:opacity-90 text-primary-foreground font-semibold rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all text-sm cursor-pointer"
            >
              Next: Create Super Admin <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        );

      case 2:
        return (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                <UserPlus className="w-5 h-5 text-primary" /> Step 2: System Super Admin
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">This root administrator account will have full access.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin Email</label>
              <input 
                className="w-full bg-secondary/60 border border-border focus:border-primary px-3.5 py-2 rounded-lg text-sm text-foreground outline-none transition-colors" 
                type="email" 
                value={adminConfig.adminEmail} 
                onChange={e => setAdminConfig({...adminConfig, adminEmail: e.target.value})} 
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin Password</label>
              <input 
                className="w-full bg-secondary/60 border border-border focus:border-primary px-3.5 py-2 rounded-lg text-sm text-foreground outline-none transition-colors" 
                type="password" 
                value={adminConfig.adminPassword} 
                onChange={e => setAdminConfig({...adminConfig, adminPassword: e.target.value})} 
                placeholder="Min 8 characters"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setStep(1)} 
                className="w-1/3 py-2.5 bg-secondary hover:bg-muted text-foreground font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors text-sm border border-border cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button 
                onClick={() => {
                  if (!adminConfig.adminEmail || adminConfig.adminPassword.length < 8) {
                    return setError("Please provide a valid email and password (min 8 characters).");
                  }
                  setError("");
                  setStep(3);
                }} 
                className="w-2/3 py-2.5 bg-primary hover:opacity-90 text-primary-foreground font-semibold rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all text-sm cursor-pointer"
              >
                Next: Initial Company <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                <Building2 className="w-5 h-5 text-primary" /> Step 3: Create Initial Company
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Customize your primary organization workspace and industry modules.</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Company Name</label>
                <input 
                  className="w-full bg-secondary/60 border border-border focus:border-primary px-3.5 py-2 rounded-lg text-sm text-foreground outline-none transition-colors" 
                  value={companyConfig.companyName} 
                  onChange={e => handleNameChange(e.target.value)} 
                  placeholder="e.g. Safehouse Studios"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Prefix / Code</label>
                <input 
                  className="w-full bg-secondary/60 border border-border focus:border-primary px-3.5 py-2 rounded-lg text-sm text-foreground outline-none transition-colors uppercase font-mono font-bold" 
                  value={companyConfig.companyCode} 
                  onChange={e => setCompanyConfig({...companyConfig, companyCode: e.target.value.toUpperCase()})} 
                  placeholder="SHS"
                  maxLength={5}
                />
              </div>
            </div>

            {/* Industry Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" /> Industry Workflow Template
              </label>
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                {INDUSTRY_TEMPLATES.map((tmpl) => {
                  const Icon = tmpl.icon;
                  const isSelected = companyConfig.industry === tmpl.id;
                  return (
                    <div
                      key={tmpl.id}
                      onClick={() => handleIndustrySelect(tmpl.id)}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all flex items-center gap-3 ${
                        isSelected 
                          ? 'border-primary bg-primary/10 ring-1 ring-primary/30' 
                          : 'border-border bg-secondary/40 hover:bg-secondary/70'
                      }`}
                    >
                      <div className={`p-2 rounded-md ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-foreground flex items-center gap-2">
                          {tmpl.name}
                          {isSelected && <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.2 rounded-full font-bold">Active</span>}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">{tmpl.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Currency</label>
                <select 
                  className="w-full bg-secondary/60 border border-border focus:border-primary px-3 py-2 rounded-lg text-xs text-foreground outline-none transition-colors"
                  value={companyConfig.currency}
                  onChange={e => setCompanyConfig({...companyConfig, currency: e.target.value})}
                >
                  {CURRENCIES.map(c => (
                    <option key={c.code} value={c.code} className="bg-background text-foreground">
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tax ID / GSTIN (Opt)</label>
                <input 
                  className="w-full bg-secondary/60 border border-border focus:border-primary px-3.5 py-2 rounded-lg text-sm text-foreground outline-none transition-colors" 
                  value={companyConfig.taxId} 
                  onChange={e => setCompanyConfig({...companyConfig, taxId: e.target.value})} 
                  placeholder="e.g. 27AAAAA0000A1Z5"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setStep(2)} 
                className="w-1/3 py-2.5 bg-secondary hover:bg-muted text-foreground font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors text-sm border border-border cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button 
                onClick={handleSetup} 
                disabled={loading} 
                className="w-2/3 py-2.5 bg-primary hover:opacity-90 text-primary-foreground font-semibold rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all text-sm cursor-pointer"
              >
                {loading ? <span className="animate-spin text-sm">⏳ Initializing...</span> : <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Complete Setup</span>}
              </button>
            </div>
          </div>
        );

      default: return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative select-none">
      <div className="w-full max-w-md bg-card/90 backdrop-blur-md border border-border p-7 rounded-2xl flex flex-col gap-5 relative z-10 shadow-2xl">
        <div className="text-center space-y-1.5">
          <div className="flex justify-center mb-3">
            <div className="bg-primary/10 p-3 rounded-2xl ring-1 ring-primary/20 text-primary">
              <Building2 className="w-7 h-7" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">NexusCore ERP Setup</h1>
          <p className="text-xs text-muted-foreground">Safehouse Studios • 1st AI Assisted Development Project</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between px-6 py-2 border-y border-border/40 text-xs">
          <div className={`flex items-center gap-1.5 ${step >= 1 ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
            <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px]">1</span> Database
          </div>
          <div className="w-6 h-px bg-border" />
          <div className={`flex items-center gap-1.5 ${step >= 2 ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
            <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px]">2</span> Admin
          </div>
          <div className="w-6 h-px bg-border" />
          <div className={`flex items-center gap-1.5 ${step >= 3 ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
            <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px]">3</span> Company
          </div>
        </div>
        
        <div>
          {successMsg ? (
            <div className="p-5 space-y-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-500 text-center animate-in zoom-in-95">
              <CheckCircle2 className="w-9 h-9 mx-auto text-emerald-500" />
              <p className="font-bold text-base">Setup Complete!</p>
              <p className="text-xs text-muted-foreground">{successMsg}</p>
              <Link href="/login">
                <button className="bg-primary hover:opacity-90 text-primary-foreground mt-3 py-2 px-6 rounded-lg font-semibold text-xs transition-all w-full cursor-pointer">
                  Go to Login →
                </button>
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-xs text-center font-medium">
                  {error}
                </div>
              )}
              {renderStep()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}