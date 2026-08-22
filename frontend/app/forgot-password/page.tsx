"use client";

import React, { useState } from 'react';
import api from "@/lib/api";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await api.post('/auth/forgot-password', { email });
      setMessage("If that email exists, a reset link has been sent.");
    } catch (err: any) {
      // Security: You might not want to show detailed errors here, but for self-hosted it helps debugging.
      setError(err.response?.data?.error || "Failed to send request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
             <div className="absolute top-[30%] -right-[10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
        </div>
      <div className="glass-panel w-full max-w-md p-8 rounded-2xl flex flex-col gap-6 relative z-10">
        <div className="text-center space-y-2">
          <h1 className="font-display-lg text-[28px] font-bold text-on-surface">Recover Password</h1>
          <p className="font-body-md text-sm text-on-surface-variant">Enter your email to receive a reset link.</p>
        </div>
        
        <div>
          {!message ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Email Address</label>
                <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-on-surface-variant">mail</span>
                    <input 
                        type="email" 
                        placeholder="admin@example.com" 
                        className="input-dark w-full pl-10 pr-4 py-2.5 rounded-lg font-body-md bg-black/20 focus:bg-black/40 border-white/5"
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        required
                    />
                </div>
              </div>
              {error && <p className="text-error text-sm text-center">{error}</p>}
              <button type="submit" className="btn-primary w-full py-3 rounded-lg font-semibold flex items-center justify-center" disabled={loading}>
                {loading ? <span className="material-symbols-outlined animate-spin text-[18px] mr-2">progress_activity</span> : "Send Reset Link"}
              </button>
            </form>
          ) : (
            <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg text-center text-primary">
                <p>{message}</p>
            </div>
          )}
        </div>
        <div className="flex justify-center pt-2 border-t border-white/5">
            <Link href="/login" className="text-sm text-on-surface-variant hover:text-on-surface flex items-center gap-1 transition-colors">
                <span className="material-symbols-outlined text-[16px]">arrow_back</span> Back to Login
            </Link>
        </div>
      </div>
    </div>
  );
}