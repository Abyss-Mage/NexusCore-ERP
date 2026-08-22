"use client";

import React, { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import api from "@/lib/api";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [password, setPassword] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPass) return setError("Passwords do not match");
    if (!token) return setError("Invalid or missing token");

    setLoading(true);
    setError("");

    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setSuccess(true);
      // Redirect to login after 3 seconds
      setTimeout(() => router.push('/login'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to reset password. Token may be expired.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
      return (
        <div className="glass-panel w-full max-w-md text-center p-8 rounded-2xl flex flex-col items-center gap-4 relative z-10">
            <div className="flex justify-center mb-2">
                <span className="material-symbols-outlined text-[64px] text-primary">check_circle</span>
            </div>
            <h2 className="font-display-lg text-[24px] font-bold text-on-surface">Password Updated!</h2>
            <p className="font-body-md text-sm text-on-surface-variant">Redirecting you to the login page...</p>
        </div>
      )
  }

  return (
    <div className="glass-panel w-full max-w-md p-8 rounded-2xl flex flex-col gap-6 relative z-10">
      <div className="text-center space-y-2">
        <h1 className="font-display-lg text-[28px] font-bold text-on-surface">Set New Password</h1>
        <p className="font-body-md text-sm text-on-surface-variant">Create a strong password for your account.</p>
      </div>
      <div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">New Password</label>
            <input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="input-dark w-full px-4 py-2.5 rounded-lg font-body-md bg-black/20 focus:bg-black/40 border-white/5"
                required 
            />
          </div>
          <div className="space-y-2">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Confirm Password</label>
            <input 
                type="password" 
                value={confirmPass} 
                onChange={e => setConfirmPass(e.target.value)} 
                className="input-dark w-full px-4 py-2.5 rounded-lg font-body-md bg-black/20 focus:bg-black/40 border-white/5"
                required 
            />
          </div>
          
          {error && <p className="text-error text-sm text-center">{error}</p>}
          
          <button type="submit" className="btn-primary w-full py-3 rounded-lg font-semibold flex items-center justify-center" disabled={loading}>
            {loading ? <span className="material-symbols-outlined animate-spin text-[18px] mr-2">progress_activity</span> : "Reset Password"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[30%] -right-[10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
            </div>
            <Suspense fallback={<div className="text-on-surface-variant">Loading...</div>}>
                <ResetPasswordForm />
            </Suspense>
        </div>
    )
}