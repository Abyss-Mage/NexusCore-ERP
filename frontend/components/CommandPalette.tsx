"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Search, FileText, Users, LayoutDashboard, Settings, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // Toggle the menu when ⌘K is pressed
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
        onClick={() => setOpen(false)}
      />
      
      {/* Palette */}
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-3xl border border-white/20 dark:border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] animate-in fade-in zoom-in-95 duration-200">
        <Command className="w-full flex flex-col">
          <div className="flex items-center border-b border-white/20 dark:border-white/10 px-4">
            <Search className="h-5 w-5 text-muted-foreground shrink-0" />
            <Command.Input 
              autoFocus
              className="flex h-16 w-full rounded-md bg-transparent px-3 py-3 text-lg outline-none placeholder:text-muted-foreground text-foreground disabled:cursor-not-allowed disabled:opacity-50" 
              placeholder="Search or jump to... (e.g. Invoices, Clients)" 
            />
          </div>
          
          <Command.List className="max-h-[300px] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-muted">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            <Command.Group heading={<div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Core Modules</div>}>
              <Command.Item 
                onSelect={() => runCommand(() => router.push("/"))}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm cursor-pointer hover:bg-white/50 dark:hover:bg-white/10 transition-colors aria-selected:bg-primary aria-selected:text-primary-foreground"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard</span>
              </Command.Item>
              <Command.Item 
                onSelect={() => runCommand(() => router.push("/invoices/"))}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm cursor-pointer hover:bg-white/50 dark:hover:bg-white/10 transition-colors aria-selected:bg-primary aria-selected:text-primary-foreground"
              >
                <FileText className="h-4 w-4" />
                <span>Invoices</span>
              </Command.Item>
              <Command.Item 
                onSelect={() => runCommand(() => router.push("/clients/"))}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm cursor-pointer hover:bg-white/50 dark:hover:bg-white/10 transition-colors aria-selected:bg-primary aria-selected:text-primary-foreground"
              >
                <Users className="h-4 w-4" />
                <span>Clients</span>
              </Command.Item>
            </Command.Group>
            
            <Command.Group heading={<div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Actions</div>}>
              <Command.Item 
                onSelect={() => runCommand(() => router.push("/invoices/new/"))}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm cursor-pointer hover:bg-white/50 dark:hover:bg-white/10 transition-colors aria-selected:bg-primary aria-selected:text-primary-foreground"
              >
                <FileText className="h-4 w-4" />
                <span>Create New Invoice</span>
              </Command.Item>
              <Command.Item 
                onSelect={() => runCommand(() => router.push("/settings/"))}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm cursor-pointer hover:bg-white/50 dark:hover:bg-white/10 transition-colors aria-selected:bg-primary aria-selected:text-primary-foreground"
              >
                <Settings className="h-4 w-4" />
                <span>System Settings</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
