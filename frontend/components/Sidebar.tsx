"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useRole } from "@/hooks/use-role";
import api from "@/lib/api";
import { 
    Hexagon, LayoutDashboard, FileText, FileCheck, Users, Banknote, 
    Kanban, Package, Printer, Briefcase, Code, Server, Lock, 
    Wallet, History, Settings, LogOut, Plus, User, Palette, Link2,
    Globe, FolderGit2, Calculator, Receipt, Building2, ShoppingBag, 
    ChevronDown, Check, Sparkles, KeyRound, ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBusiness } from "@/contexts/business-context";
import { CreateCompanyModal } from "@/components/CreateCompanyModal";

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { 
    role, isAdmin, isSudo, 
    canAccess3D, canAccessSoftware, canAccessFinance, 
    canAccessVault, canAccessReports, canManageSettings 
  } = useRole(); 

  const { currentBusiness, activeUnit, businessUnits, setBusinessUnit, isTYT, isSafehouse } = useBusiness();
  const [showCompanyMenu, setShowCompanyMenu] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [softwareName, setSoftwareName] = useState('NexusCore');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete api.defaults.headers.common['Authorization'];
    router.push('/login');
  };

  useEffect(() => {
    const fetchSoftwareName = async () => {
      try {
        const res = await api.get('/settings/software-name');
        if (res.data?.name) {
          setSoftwareName(res.data.name);
        }
      } catch (err) {
        // Keep default
      }
    };
    fetchSoftwareName();
  }, []);

  const NavItem = ({ href, icon: Icon, label, badge }: { href: string; icon: any; label: string; badge?: string }) => {
    const active = pathname === href || (href !== "/" && pathname.startsWith(href));
    return (
      <button
        onClick={() => router.push(href)}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-body-md transition-all active:scale-[0.98] duration-200 outline-none focus:outline-none focus:ring-0 ${
          active 
            ? "bg-primary text-primary-foreground font-bold shadow-md shadow-primary/25" 
            : "text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 truncate">
          <Icon className="w-4 h-4 shrink-0" />
          <span className="truncate text-xs">{label}</span>
        </div>
        {badge && (
          <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0 ml-1 ${
            active ? "bg-white/20 text-white" : "bg-emerald-500/15 text-emerald-500 border border-emerald-500/20"
          }`}>
            {badge}
          </span>
        )}
      </button>
    );
  };

  const activeModules = activeUnit?.active_modules || (isTYT ? ['core', '3d', 'ecommerce'] : isSafehouse ? ['core', 'software'] : ['core']);
  const show3D = canAccess3D && (activeModules.includes('3d') || activeModules.includes('ecommerce'));
  const showSoftware = canAccessSoftware && activeModules.includes('software');
  const showAdmin = canManageSettings || canAccessFinance || canAccessReports;

  return (
    <>
      <nav className={`w-64 bg-surface-container border-r border-border flex flex-col h-screen overflow-y-auto shrink-0 select-none z-30 ${className || ''}`}>
        <div className="p-5 flex-1 space-y-5">
          {/* App Logo */}
          <div className="flex items-center gap-3 px-2 cursor-pointer" onClick={() => router.push('/')}>
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/30 shrink-0">
              <Hexagon className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h1 className="font-headline-sm font-bold text-on-surface tracking-tight text-sm">{softwareName}</h1>
              <p className="text-[11px] text-on-surface-variant">Nexus System</p>
            </div>
          </div>

          {/* Company Switcher Widget */}
          <div className="relative">
            <button
              onClick={() => setShowCompanyMenu(!showCompanyMenu)}
              className="w-full p-2.5 rounded-xl bg-card border border-border hover:border-primary/40 transition-all flex items-center justify-between text-left shadow-sm group"
            >
              <div className="flex items-center gap-2.5 truncate">
                <div className={`w-3 h-3 rounded-full shrink-0 ${
                  isTYT ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 
                  isSafehouse ? 'bg-blue-500 shadow-sm shadow-blue-500/50' : 'bg-primary shadow-sm shadow-primary/50'
                }`} />
                <div className="truncate">
                  <div className="text-xs font-bold text-foreground truncate">
                    {activeUnit?.name || (isTYT ? 'TYTGEAR' : 'Safehouse Studios')}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {activeUnit?.category || (isTYT ? 'E-Commerce & 3D Prints' : 'Software Agency')}
                  </div>
                </div>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${showCompanyMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* Company Switcher Menu */}
            {showCompanyMenu && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-card border border-border rounded-xl shadow-2xl z-50 p-1.5 space-y-1 backdrop-blur-md max-h-64 overflow-y-auto">
                {businessUnits.map((bu) => {
                  const isSelected = currentBusiness === bu.id;
                  const dotColor = bu.id === 'tytgear' ? 'bg-emerald-500' : bu.id === 'safehouse' ? 'bg-blue-500' : 'bg-primary';
                  return (
                    <button
                      key={bu.id}
                      onClick={() => { setBusinessUnit(bu.id); setShowCompanyMenu(false); }}
                      className={`w-full p-2 rounded-lg flex items-center justify-between text-left text-xs transition-colors ${
                        isSelected ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`} />
                        <div className="truncate">
                          <div className="truncate">{bu.name}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{bu.category || 'Workspace'}</div>
                        </div>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-1" />}
                    </button>
                  );
                })}

                <div className="border-t border-border pt-1 mt-1">
                  <button
                    onClick={() => { setShowCompanyMenu(false); setShowCreateModal(true); }}
                    className="w-full p-2 rounded-lg flex items-center gap-2 text-left text-xs text-primary hover:bg-primary/10 font-bold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create New Company</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {canAccessFinance && (
            <Button className="w-full py-5 font-bold shadow-md shadow-primary/20 text-xs" size="sm" onClick={() => router.push('/invoices/new')}>
                <Plus className="w-4 h-4 mr-1.5" /> New Invoice
            </Button>
          )}
          
          {/* Core Financial & CRM */}
          <div className="space-y-1">
            <NavItem href="/" icon={LayoutDashboard} label="Dashboard" />
            <NavItem href="/invoices" icon={FileText} label="Invoices" />
            <NavItem href="/quotations" icon={FileCheck} label="Quotations" />
            <NavItem href="/clients" icon={Users} label="Clients" />
            {canAccessFinance && <NavItem href="/expenses" icon={Banknote} label="Expenses" />}
          </div>

          {/* 3D Printing & E-Commerce */}
          {show3D && (
            <div>
              <p className="font-label-sm text-[11px] text-on-surface-variant mb-2 px-4 uppercase tracking-wider font-bold text-emerald-500">
                {isTYT ? 'TYTGEAR Hardware & Store' : '3D Printing Farm'}
              </p>
              <div className="space-y-1">
                {activeModules.includes('ecommerce') && <NavItem href="/ecommerce/woocommerce" icon={ShoppingBag} label="WooCommerce" badge="Live" />}
                <NavItem href="/3d/kanban" icon={Kanban} label="Print Kanban" />
                <NavItem href="/3d/inventory" icon={Package} label="Spool Inventory" />
                <NavItem href="/3d/unit-economics" icon={Calculator} label="Unit Economics" />
                <NavItem href="/printers" icon={Printer} label="Bambu Printers" />
              </div>
            </div>
          )}

          {/* Software Agency */}
          {showSoftware && (
            <div>
              <p className="font-label-sm text-[11px] text-on-surface-variant mb-2 px-4 uppercase tracking-wider font-bold text-blue-500">
                {isSafehouse ? 'Safehouse Agency' : 'Software Firm'}
              </p>
              <div className="space-y-1">
                <NavItem href="/software/domains" icon={Globe} label="Domains & SSL" />
                <NavItem href="/software/milestones" icon={FolderGit2} label="Project Milestones" />
                <NavItem href="/subscriptions" icon={History} label="Subscriptions" />
                <NavItem href="/integrations" icon={Link2} label="Integrations" />
                {canAccessVault && <NavItem href="/software/vault" icon={Lock} label="Credential Vault" />}
              </div>
            </div>
          )}

          {/* Administration */}
          {showAdmin && (
            <div>
              <p className="font-label-sm text-[11px] text-on-surface-variant mb-2 px-4 uppercase tracking-wider font-bold">Administration</p>
              <div className="space-y-1">
                {canAccessFinance && <NavItem href="/ledger" icon={Wallet} label="Ledger" />}
                {canAccessReports && <NavItem href="/reports/gst" icon={Receipt} label="GST & Tax Reports" />}
                {isAdmin && <NavItem href="/activity" icon={History} label="Activity Log" />}
                {canManageSettings && <NavItem href="/settings/invoice-builder" icon={Palette} label="Invoice Builder" />}
                {canManageSettings && <NavItem href="/settings/license" icon={KeyRound} label="License & Plan" badge="FairCode" />}
                {canManageSettings && <NavItem href="/settings" icon={Settings} label="Settings" />}
              </div>
            </div>
          )}
        </div>

        <div className="mt-auto p-4 border-t border-white/10 shrink-0 space-y-2">
          <NavItem href="/profile" icon={User} label="My Account" />
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-on-surface-variant hover:bg-white/5 transition-colors active:scale-95 duration-200 outline-none focus:outline-none focus:ring-0 text-xs">
            <LogOut className="w-4 h-4 shrink-0" />
            Logout
          </button>
          <div className="pt-2 text-center text-[10px] text-muted-foreground/60 font-medium select-none">
            Safehouse Studios • AI Project #1
          </div>
        </div>
      </nav>

      {/* Create Company Modal */}
      <CreateCompanyModal open={showCreateModal} onOpenChange={setShowCreateModal} />
    </>
  );
}