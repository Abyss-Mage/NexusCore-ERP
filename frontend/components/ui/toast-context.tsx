"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { X, CheckCircle, AlertTriangle, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 3000); // Auto-dismiss after 3s
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border animate-in slide-in-from-right-full duration-300",
              "bg-background/95 backdrop-blur text-sm font-medium min-w-[300px]",
              t.type === "success" && "border-green-500/50 text-green-600 dark:text-green-400 bg-green-50/90 dark:bg-green-900/20",
              t.type === "error" && "border-red-500/50 text-red-600 dark:text-red-400 bg-red-50/90 dark:bg-red-900/20",
              t.type === "warning" && "border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-50/90 dark:bg-amber-900/20",
              t.type === "info" && "border-border text-foreground"
            )}
          >
            {t.type === "success" && <CheckCircle className="w-4 h-4" />}
            {t.type === "error" && <XCircle className="w-4 h-4" />}
            {t.type === "warning" && <AlertTriangle className="w-4 h-4" />}
            {t.type === "info" && <Info className="w-4 h-4" />}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => removeToast(t.id)} className="opacity-50 hover:opacity-100">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider");
  return context;
};