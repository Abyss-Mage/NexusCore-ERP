"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, useAnimation } from "framer-motion";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import api from "@/lib/api";
import { useToast } from "@/components/ui/toast-context";

interface VaultOTPProps {
  onUnlock: () => void;
}

export function VaultOTP({ onUnlock }: VaultOTPProps) {
  const { toast } = useToast();
  const router = useRouter();
  // 6 digits for Authenticator
  const [pin, setPin] = useState(["", "", "", "", "", ""]);
  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error">("idle");
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const controls = useAnimation();

  useEffect(() => {
    // Focus first input on mount
    inputsRef.current[0]?.focus();
    
    // Quick check if 2FA is enabled; if not, we can unlock immediately or warn
    // Actually, we can let them type anything, the backend will return success: true, message: "2FA not enabled"
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newPin = [...pin];
    newPin[index] = value.slice(-1); // Only keep the last character
    setPin(newPin);

    // Auto focus next
    if (value && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }

    // If fully filled, verify
    if (newPin.every((p) => p !== "")) {
      verifyPin(newPin.join(""));
    } else {
      setStatus("idle");
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const verifyPin = async (enteredPin: string) => {
    setStatus("verifying");
    
    // Spin animation
    const spinPromise = controls.start({
      rotate: 360 * 2,
      scale: 0.8,
      transition: { duration: 1, ease: "easeInOut" }
    });

    try {
      await api.post('/vault/verify-otp', { token: enteredPin });
      await spinPromise;
      setStatus("success");
      controls.start({ scale: 1.2, opacity: 0, transition: { duration: 0.5 } }).then(() => {
        onUnlock();
      });
    } catch (err: any) {
      await spinPromise;
      setStatus("error");
      setPin(["", "", "", "", "", ""]);
      inputsRef.current[0]?.focus();
      toast(err.response?.data?.error || "Invalid verification code", "error");
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "verifying": return "border-tertiary text-tertiary shadow-[0_0_15px_rgba(192,193,255,0.5)]";
      case "success": return "border-primary text-primary shadow-[0_0_15px_rgba(78,222,163,0.5)]";
      case "error": return "border-error text-error shadow-[0_0_15px_rgba(255,180,171,0.5)]";
      default: return "border-white/20 text-on-surface focus-within:border-primary focus-within:shadow-[0_0_10px_rgba(78,222,163,0.3)]";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-xl">
      <button 
        onClick={() => router.back()}
        className="absolute top-8 left-8 flex items-center gap-2 text-on-surface-variant hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="font-medium">Go Back</span>
      </button>

      <div className="text-center mb-12 space-y-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surface-container border border-white/10 shadow-2xl mb-4"
        >
          <ShieldCheck className={`h-8 w-8 ${status === 'success' ? 'text-primary' : 'text-on-surface'}`} />
        </motion.div>
        <motion.h2 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          className="text-3xl font-headline-lg font-bold tracking-tight text-on-surface"
        >
          Unlock Credential Vault
        </motion.h2>
        <motion.p 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          transition={{ delay: 0.1 }}
          className="text-on-surface-variant font-body-md"
        >
          Enter your Security PIN or Authenticator 2FA code
        </motion.p>
      </div>

      <motion.div 
        animate={controls}
        className="relative flex items-center justify-center w-[300px] h-[300px]"
      >
        {/* Orbit Ring */}
        <svg className="absolute inset-0 w-full h-full animate-[spin-slow_15s_linear_infinite]" viewBox="0 0 100 100">
          <circle 
            cx="50" cy="50" r="48" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="0.5" 
            className={`text-white/10 ${status === 'verifying' ? 'text-tertiary/50' : ''} ${status === 'success' ? 'text-primary/50' : ''}`}
            strokeDasharray="2 4"
          />
        </svg>

        {/* Center Hub */}
        <div className={`absolute w-6 h-6 rounded-full transition-all duration-500 flex items-center justify-center ${status === 'success' ? 'bg-primary shadow-[0_0_20px_#4edea3]' : status === 'error' ? 'bg-error shadow-[0_0_20px_#ffb4ab]' : status === 'verifying' ? 'bg-tertiary shadow-[0_0_20px_#c0c1ff]' : 'bg-surface-container-high border border-white/20'}`}>
           {status === 'verifying' && <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />}
        </div>

        {/* 6 Orbiting Slots */}
        {pin.map((digit, index) => {
          // 6 slots = 60 degrees apart. Starting at -90deg (top)
          const angle = (index * 60 - 90) * (Math.PI / 180);
          const radius = 100; // Distance from center
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;

          return (
            <motion.div
              key={index}
              className="absolute"
              animate={{ x, y }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <input
                ref={(el) => { inputsRef.current[index] = el; }}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                disabled={status === "verifying" || status === "success"}
                className={`w-14 h-14 text-center text-2xl font-bold bg-surface-container/80 backdrop-blur-md rounded-[20px] border-2 transition-all outline-none ${getStatusColor()}`}
              />
            </motion.div>
          );
        })}
      </motion.div>

    </div>
  );
}
