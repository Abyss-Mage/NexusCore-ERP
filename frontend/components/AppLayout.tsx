"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { TopNavbar } from "@/components/TopNavbar";
import { Loader2, ServerCrash } from "lucide-react";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
// 1. IMPORT REACT QUERY
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CommandPalette } from "@/components/CommandPalette";
import { AppShell } from "@astryxdesign/core/AppShell";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  
  // 2. CREATE QUERY CLIENT (Stable across re-renders)
  const [queryClient] = useState(() => new QueryClient());

  // States: 'loading', 'ready', 'error'
  const [appState, setAppState] = useState<'loading' | 'ready' | 'error'>('loading');

  const isAuthPage = pathname?.startsWith("/login") || 
                     pathname?.startsWith("/forgot-password") || 
                     pathname?.startsWith("/reset-password") ||
                     pathname?.startsWith("/setup");

  useEffect(() => {
    const initCheck = async () => {
        try {
            let res;
            let success = false;
            
            for (let i = 0; i < 10; i++) {
                try {
                    res = await api.get('/auth/status', { 
                        validateStatus: () => true,
                        timeout: 5000 // 5 seconds timeout
                    });
                    
                    if (res.status === 200) {
                        success = true;
                        break;
                    }
                } catch (e) {
                    console.warn(`Backend not ready (attempt ${i+1}/10)...`);
                }
                await new Promise(r => setTimeout(r, 1000));
            }
            
            if (!success || !res) {
                throw new Error(`Backend failed to start or respond with 200.`);
            }

            const isInstalled = res.data.initialized;

            if (!isInstalled) {
                if (!pathname?.startsWith('/setup')) {
                    router.replace('/setup/');
                    return; 
                }
            } else {
                if (pathname?.startsWith('/setup')) {
                    router.replace('/login/');
                    return; 
                }

                const token = localStorage.getItem('token');
                if (!token && !isAuthPage) {
                    router.replace('/login/');
                    return;
                }
            }

            setAppState('ready');

        } catch (e) {
            console.error("Critical System Check Failed:", e);
            setAppState('error');
        }
    };

    initCheck();
  }, [pathname, isAuthPage, router]);

  // 3. WRAP CONTENT HELPER
  const wrapWithProvider = (content: React.ReactNode) => (
    <QueryClientProvider client={queryClient}>
        {content}
    </QueryClientProvider>
  );

  // --- 1. LOADING SCREEN ---
  if (appState === 'loading') {
      return wrapWithProvider(
        <div className="h-screen w-full flex flex-col items-center justify-center bg-background gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground animate-pulse">Connecting to InvoiceCore...</p>
        </div>
      );
  }

  // --- 2. ERROR SCREEN ---
  if (appState === 'error') {
      return wrapWithProvider(
        <div className="h-screen w-full flex flex-col items-center justify-center bg-background gap-4 p-4 text-center">
            <div className="bg-red-100 dark:bg-red-900/20 p-4 rounded-full">
                <ServerCrash className="h-10 w-10 text-red-600" />
            </div>
            <h1 className="text-xl font-bold">Cannot Connect to Server</h1>
            <p className="text-muted-foreground max-w-md">
                The backend API is unreachable. Please ensure the Node.js server is running.
            </p>
            <Button variant="outline" onClick={() => window.location.reload()}>
                Retry Connection
            </Button>
        </div>
      );
  }

  // --- 3. AUTH/SETUP LAYOUT ---
  if (isAuthPage) {
    return wrapWithProvider(
        <div className="flex-1 flex flex-col h-screen w-full overflow-hidden relative z-10">
            <main className="flex-1 overflow-y-auto scroll-smooth">
                {children}
            </main>
        </div>
    );
  }

  // --- 4. DASHBOARD LAYOUT ---
  return wrapWithProvider(
    <div className="min-h-screen w-full bg-transparent text-on-background flex">
      <CommandPalette />
      <Sidebar className="hidden md:flex" />
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative md:ml-64">
        <TopNavbar />
        <main className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
          {children}
        </main>
      </div>
    </div>
  );
}