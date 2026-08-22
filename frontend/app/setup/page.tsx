// frontend/app/setup/page.tsx

"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';

// Use raw axios as the regular API client relies on a pre-existing token
const rawApi = axios.create({ baseURL: '/api' });

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  
  // Form State
  const [dbConfig, setDbConfig] = useState({
    dbHost: 'localhost', dbPort: '5432', dbUser: 'postgres', dbPassword: '', dbName: 'invoicecore'
  });
  const [adminConfig, setAdminConfig] = useState({
    adminEmail: 'owner@company.com', adminPassword: ''
  });

const handleSetup = async () => {
    // UPDATED VALIDATION: Added check for dbPort, dbUser, and dbName
    if (!dbConfig.dbHost || !dbConfig.dbPort || !dbConfig.dbUser || !dbConfig.dbName || !adminConfig.adminPassword || !adminConfig.adminEmail) {
      return setError("Please fill in all required fields.");
    }
    if (adminConfig.adminPassword.length < 8) {
      return setError("Password must be at least 8 characters.");
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
      };
      
      const res = await rawApi.post('/auth/setup', payload);
      
      setSuccessMsg(`System initialized! Sudo Admin User created with email: ${adminConfig.adminEmail}`);

      
    } catch (err: any) {
        console.error("Setup Error:", err);
        if (err.response?.status === 403) {
            setError("System is already installed. Redirecting to Login...");
            setTimeout(() => router.push('/login'), 3000);
        } else {
            setError(err.response?.data?.error || "Installation failed. Check PostgreSQL details and ensure the database exists.");
        }
    } finally {
      setLoading(false);
    }
  };

  const getStepContent = () => {
    switch(step) {
      case 1:
        return (
          <div className="space-y-6">
            <h3 className="font-headline-md text-xl font-bold flex items-center gap-2 text-on-surface">
                <span className="material-symbols-outlined text-primary text-[24px]">database</span> 1. Database Connection
            </h3>
            <p className="font-body-md text-sm text-on-surface-variant">These details will be saved to the <code>.env</code> file.</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                  <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Host</label>
                  <input className="input-dark w-full px-4 py-2.5 rounded-lg font-body-md" value={dbConfig.dbHost} onChange={e => setDbConfig({...dbConfig, dbHost: e.target.value})} />
              </div>
              <div className="space-y-2">
                  <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Port</label>
                  <input className="input-dark w-full px-4 py-2.5 rounded-lg font-body-md" type="number" value={dbConfig.dbPort} onChange={e => setDbConfig({...dbConfig, dbPort: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Database Name</label>
                <input className="input-dark w-full px-4 py-2.5 rounded-lg font-body-md" value={dbConfig.dbName} onChange={e => setDbConfig({...dbConfig, dbName: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                  <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">User</label>
                  <input className="input-dark w-full px-4 py-2.5 rounded-lg font-body-md" value={dbConfig.dbUser} onChange={e => setDbConfig({...dbConfig, dbUser: e.target.value})} />
              </div>
              <div className="space-y-2">
                  <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Password</label>
                  <input className="input-dark w-full px-4 py-2.5 rounded-lg font-body-md" type="password" value={dbConfig.dbPassword} onChange={e => setDbConfig({...dbConfig, dbPassword: e.target.value})} />
              </div>
            </div>
            <button onClick={() => setStep(2)} className="btn-primary w-full py-3 mt-6 rounded-lg font-semibold flex items-center justify-center gap-2">
                Next: Create Admin User <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6">
            <h3 className="font-headline-md text-xl font-bold flex items-center gap-2 text-on-surface">
                <span className="material-symbols-outlined text-primary text-[24px]">person_add</span> 2. Create System Owner
            </h3>
            <p className="font-body-md text-sm text-on-surface-variant">This account will have full access and control.</p>
            <div className="space-y-2">
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Email</label>
                <input className="input-dark w-full px-4 py-2.5 rounded-lg font-body-md" type="email" value={adminConfig.adminEmail} onChange={e => setAdminConfig({...adminConfig, adminEmail: e.target.value})} />
            </div>
            <div className="space-y-2">
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Password</label>
                <input className="input-dark w-full px-4 py-2.5 rounded-lg font-body-md" type="password" value={adminConfig.adminPassword} onChange={e => setAdminConfig({...adminConfig, adminPassword: e.target.value})} />
            </div>
            <button onClick={handleSetup} disabled={loading} className="btn-primary w-full py-3 mt-6 rounded-lg font-semibold flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(78,222,163,0.1)]">
                {loading ? <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> : <span className="material-symbols-outlined text-[18px]">check_circle</span>}
                Run Final Setup
            </button>
            <div className="pt-2">
                <button onClick={() => setStep(1)} className="w-full text-sm text-on-surface-variant hover:text-on-surface transition-colors flex items-center justify-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">arrow_back</span> Back to DB Config
                </button>
            </div>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px]" />
            <div className="absolute bottom-[0%] -left-[10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[100px]" />
        </div>
      <div className="glass-panel w-full max-w-lg p-8 rounded-2xl flex flex-col gap-6 relative z-10">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-6">
             <div className="bg-primary/10 p-4 rounded-full ring-1 ring-primary/20 shadow-[0_0_15px_rgba(78,222,163,0.1)]">
                <span className="material-symbols-outlined text-primary text-3xl">key</span>
             </div>
          </div>
          <h1 className="font-display-lg text-[28px] font-bold text-on-surface">InvoiceCore Setup</h1>
          <p className="font-body-md text-sm text-on-surface-variant">Initialize your self-hosted system.</p>
        </div>
        
        <div>
          {successMsg ? (
            <div className="p-6 space-y-4 bg-primary/10 border border-primary/20 rounded-lg text-primary text-center">
                <p className="font-bold text-lg flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[24px]">check_circle</span> Installation Successful!
                </p>
                <p className="text-sm text-on-surface-variant">{successMsg}</p>
                <Link href="/login">
                    <button className="btn-primary mt-4 py-2 w-full rounded-lg font-medium">Go to Login</button>
                </Link>
            </div>
          ) : (
            <>
              {error && (
                  <div className="p-3 mb-6 bg-error/10 border border-error/20 rounded-md text-error text-sm text-center">
                      {error}
                  </div>
              )}
              {getStepContent()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}