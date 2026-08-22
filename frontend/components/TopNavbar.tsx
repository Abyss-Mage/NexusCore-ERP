"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { NotificationCenter } from "./NotificationCenter";
import api from "@/lib/api"; 
import { useRole } from "@/hooks/use-role";
import { useTheme } from "next-themes";
import { Moon, Sun, Search, LayoutDashboard, FileText, Users, Banknote } from "lucide-react";
import { useRouter } from "next/navigation";

export function TopNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [softwareName, setSoftwareName] = useState('InvoiceCore');

  useEffect(() => {
    api.get('/settings/software-name')
      .then(res => {
        if (res.data?.software_name) {
          setSoftwareName(res.data.software_name);
        }
      })
      .catch(e => console.error("Failed to fetch software name", e));
  }, []);

  const pageTitle = pathname === "/" 
    ? "Dashboard" 
    : pathname.split('/').filter(Boolean).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' / ');
  
  const { user } = useRole();
  const { theme, setTheme, resolvedTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="bg-background/60 text-primary font-label-sm text-label-sm sticky top-0 w-full z-40 backdrop-blur-md border-b border-white/10 shadow-none flex justify-between items-center px-container-padding h-16">
      <div className="flex items-center gap-4">
        {/* Empty left side since navigation is handled by the sidebar */}
        <div className="flex flex-col">
          <span className="text-on-surface-variant text-sm font-medium">Pages / <span className="text-on-surface font-bold">{pageTitle}</span></span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Search Bar - Triggers Command Dialog */}
        <button 
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
          className="hidden sm:flex relative bg-surface-container border border-white/10 rounded-full px-4 py-1.5 items-center hover:bg-surface-variant transition-colors"
        >
          <span className="text-on-surface-variant text-sm w-48 text-left">Search (Ctrl+K)...</span>
          <Search className="text-on-surface-variant w-4 h-4 ml-2" />
        </button>

        <NotificationCenter />

        <button 
          onClick={() => router.push('/profile')}
          className="w-8 h-8 rounded-full border border-white/20 bg-primary/20 flex items-center justify-center overflow-hidden shrink-0 hover:bg-primary/30 transition-colors cursor-pointer"
          title="Account Settings"
        >
           {user?.username ? (
              <span className="text-primary font-bold text-xs">{user.username.charAt(0).toUpperCase()}</span>
           ) : (
             <span className="material-symbols-outlined text-sm text-primary">person</span>
           )}
        </button>
      </div>
    </header>
  );
}