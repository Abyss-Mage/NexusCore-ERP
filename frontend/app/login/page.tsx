"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from "next/link";
import api from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpToken, setTotpToken] = useState("");
  
  // State to track if 2FA is required
  const [show2fa, setShow2fa] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // FORCE DARK THEME ON MOUNT
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('dark');
    
    // Optional: Cleanup if you want to revert when leaving (commented out to persist)
    // return () => root.removeAttribute('data-style');
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Payload changes based on whether we are in step 1 or step 2
      const payload = show2fa 
        ? { email, password, totp_code: totpToken } 
        : { email, password };

      const res = await api.post('/auth/login', payload);
      
      // Case A: 2FA Required
      if (res.data.require2fa) {
          setShow2fa(true);
          setLoading(false);
          return;
      }

      // Case B: Success (JWT Received)
      if (res.data.token) {
          localStorage.setItem('token', res.data.token);
          localStorage.setItem('user', JSON.stringify(res.data.user));
          router.push('/');
      }
      
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.error || "Invalid credentials";
      if (errMsg === "2FA code required") {
         setShow2fa(true);
      } else {
         setError(errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 transition-colors duration-500 relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
             <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px]" />
             <div className="absolute bottom-[0%] -right-[10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[100px]" />
        </div>
      
      <div className="glass-panel w-full max-w-sm p-8 rounded-2xl flex flex-col gap-6 relative z-10">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-6">
             <div className="bg-primary/10 p-4 rounded-full ring-1 ring-primary/20 shadow-[0_0_15px_rgba(78,222,163,0.1)]">
                <span className="material-symbols-outlined text-primary text-3xl">lock</span>
             </div>
          </div>
          <h1 className="font-display-lg text-[28px] font-bold text-on-surface">
              {show2fa ? "Two-Factor Auth" : "Welcome Back"}
          </h1>
          <p className="font-body-md text-sm text-on-surface-variant">
              {show2fa ? "Enter the code from your authenticator app." : "Sign in to access your dashboard."}
          </p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-6">
          
          {/* Step 1: Email & Password */}
          <div className={show2fa ? "hidden" : "space-y-4"}>
              <div className="space-y-2">
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Email</label>
                <input 
                    type="email" 
                    placeholder="admin@invoicecore.com" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    className="input-dark w-full px-4 py-2.5 rounded-lg font-body-md bg-black/20 focus:bg-black/40 border-white/5"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Password</label>
                    <Link href="/forgot-password" className="text-xs text-primary hover:text-primary/80 hover:underline transition-colors">
                      Forgot password?
                    </Link>
                </div>
                <input 
                    type="password" 
                    placeholder="••••••" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    className="input-dark w-full px-4 py-2.5 rounded-lg font-body-md bg-black/20 focus:bg-black/40 border-white/5"
                />
              </div>
          </div>

          {/* Step 2: TOTP Input */}
          {show2fa && (
              <div className="space-y-2 animate-[slide_0.3s_ease-out]">
                  <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Authenticator Code</label>
                  <input 
                      type="text" 
                      placeholder="000 000" 
                      value={totpToken} 
                      onChange={(e) => setTotpToken(e.target.value)} 
                      className="input-dark w-full px-4 py-3 rounded-lg font-mono text-center tracking-[0.5em] text-lg bg-black/20 border-white/5 focus:border-primary/50"
                      maxLength={6}
                      autoFocus
                  />
              </div>
          )}
          
          {error && (
              <div className="p-3 bg-error/10 border border-error/20 rounded-md text-error text-xs text-center font-medium">
                  {error}
              </div>
          )}
          
          <button type="submit" className="btn-primary w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2" disabled={loading}>
              {loading ? "Processing..." : (show2fa ? "Verify & Login" : "Sign In")}
              {!loading && !show2fa && <span className="material-symbols-outlined text-[18px]">arrow_forward</span>}
          </button>
        </form>
        
        {show2fa && (
            <div className="pt-2">
                <button type="button" className="w-full text-sm text-on-surface-variant hover:text-on-surface transition-colors" onClick={() => setShow2fa(false)}>
                    Back to Login
                </button>
            </div>
        )}
      </div>
    </div>
  );
}