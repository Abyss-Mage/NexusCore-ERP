"use client";

import React, { useState } from "react";
import { 
  Building2, Plus, Sparkles, CheckCircle2, 
  Layers, DollarSign, FileText, Printer, Code, ShoppingBag, X
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AVAILABLE_CURRENCIES } from "@/lib/currencies";
import { useToast } from "@/components/ui/toast-context";
import { useBusiness } from "@/contexts/business-context";

interface CreateCompanyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCompanyModal({ open, onOpenChange }: CreateCompanyModalProps) {
  const { createBusinessUnit } = useBusiness();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState("Software Agency");
  const [industryType, setIndustryType] = useState<"software" | "3d" | "invoicing" | "hybrid">("software");
  const [currency, setCurrency] = useState("INR");
  const [invoicePrefix, setInvoicePrefix] = useState("");
  const [quotationPrefix, setQuotationPrefix] = useState("");
  const [description, setDescription] = useState("");
  const [taxId, setTaxId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleNameChange = (val: string) => {
    setName(val);
    const generatedCode = val.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
    setCode(generatedCode);
    if (generatedCode) {
      setInvoicePrefix(`${generatedCode}-INV-`);
      setQuotationPrefix(`${generatedCode}-QT-`);
    }
  };

  const handleIndustrySelect = (type: "software" | "3d" | "invoicing" | "hybrid") => {
    setIndustryType(type);
    if (type === "software") {
      setCategory("Software Agency");
      setDescription("Web, Mobile & Cloud Engineering, Sprint Milestones & Retainers");
    } else if (type === "3d") {
      setCategory("3D Printing & E-Commerce");
      setDescription("3D Printing Farm, Custom Manufacturing & E-Commerce Store");
    } else if (type === "invoicing") {
      setCategory("General Business");
      setDescription("Professional Invoicing, Quotations, Client CRM & Accounting");
    } else {
      setCategory("Enterprise Multi-Vertical");
      setDescription("Full Enterprise Suite with 3D Manufacturing and Software Agency modules");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast("Company name is required", "error");
      return;
    }

    let activeModules: string[] = ["core"];
    if (industryType === "software") {
      activeModules = ["core", "software"];
    } else if (industryType === "3d") {
      activeModules = ["core", "3d", "ecommerce"];
    } else if (industryType === "hybrid") {
      activeModules = ["core", "3d", "software", "ecommerce"];
    }

    const cleanCode = code.trim().toUpperCase() || name.slice(0, 3).toUpperCase();
    const cleanId = cleanCode.toLowerCase();

    setSubmitting(true);
    try {
      await createBusinessUnit({
        id: cleanId,
        code: cleanCode,
        name: name.trim(),
        category,
        description,
        currency,
        invoice_prefix: invoicePrefix.trim() || `${cleanCode}-INV-`,
        quotation_prefix: quotationPrefix.trim() || `${cleanCode}-QT-`,
        active_modules: activeModules,
        tax_id: taxId.trim() || undefined,
        is_default: false,
      });

      toast(`Company "${name}" successfully created!`, "success");
      onOpenChange(false);
      // Reset form
      setName("");
      setCode("");
      setDescription("");
      setTaxId("");
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to create company workspace", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-xl bg-card border-border shadow-2xl p-6 sm:p-8 rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <Building2 className="w-4 h-4" /> Multi-Tenant Architecture
          </div>
          <DialogTitle className="text-xl font-extrabold text-foreground">
            Create New Company Workspace
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Set up an isolated business workspace with dedicated invoicing prefixes, currency, and industry modules.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* Industry / Template Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-foreground">Select Company Industry Template</Label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleIndustrySelect("software")}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  industryType === "software"
                    ? "bg-blue-500/10 border-blue-500/40 text-foreground ring-1 ring-blue-500/20"
                    : "bg-muted/30 border-border hover:bg-muted/60 text-muted-foreground"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <Code className="w-4 h-4 text-blue-400" />
                  {industryType === "software" && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />}
                </div>
                <div className="font-bold text-xs text-foreground">Software Agency</div>
                <div className="text-[10px] text-muted-foreground">Milestones, Retainers, Domains, Vault</div>
              </button>

              <button
                type="button"
                onClick={() => handleIndustrySelect("3d")}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  industryType === "3d"
                    ? "bg-emerald-500/10 border-emerald-500/40 text-foreground ring-1 ring-emerald-500/20"
                    : "bg-muted/30 border-border hover:bg-muted/60 text-muted-foreground"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <Printer className="w-4 h-4 text-emerald-400" />
                  {industryType === "3d" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <div className="font-bold text-xs text-foreground">3D Farm &amp; E-Commerce</div>
                <div className="text-[10px] text-muted-foreground">Bambu Fleet, Spools, Unit Economics, Store</div>
              </button>

              <button
                type="button"
                onClick={() => handleIndustrySelect("invoicing")}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  industryType === "invoicing"
                    ? "bg-amber-500/10 border-amber-500/40 text-foreground ring-1 ring-amber-500/20"
                    : "bg-muted/30 border-border hover:bg-muted/60 text-muted-foreground"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <FileText className="w-4 h-4 text-amber-400" />
                  {industryType === "invoicing" && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />}
                </div>
                <div className="font-bold text-xs text-foreground">Pure Invoicing &amp; CRM</div>
                <div className="text-[10px] text-muted-foreground">Invoices, Quotations, Expenses, Ledger</div>
              </button>

              <button
                type="button"
                onClick={() => handleIndustrySelect("hybrid")}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  industryType === "hybrid"
                    ? "bg-purple-500/10 border-purple-500/40 text-foreground ring-1 ring-purple-500/20"
                    : "bg-muted/30 border-border hover:bg-muted/60 text-muted-foreground"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <Layers className="w-4 h-4 text-purple-400" />
                  {industryType === "hybrid" && <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />}
                </div>
                <div className="font-bold text-xs text-foreground">Enterprise Hybrid</div>
                <div className="text-[10px] text-muted-foreground">All modules and tools enabled</div>
              </button>
            </div>
          </div>

          {/* Basic Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Company / Brand Name *</Label>
              <input
                type="text"
                required
                placeholder="e.g. Apex Labs Studio"
                value={name}
                onChange={e => handleNameChange(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Company Code (Short ID) *</Label>
              <input
                type="text"
                required
                maxLength={6}
                placeholder="e.g. APX"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-mono font-bold text-primary uppercase outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Currency & Tax ID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Default Currency</Label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground outline-none focus:border-primary"
              >
                {AVAILABLE_CURRENCIES.map(curr => (
                  <option key={curr.code} value={curr.code} className="bg-[#18181b] text-white">
                    {curr.code} - {curr.name} ({curr.symbol})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">GSTIN / Tax ID (Optional)</Label>
              <input
                type="text"
                placeholder="e.g. 27AAAAA0000A1Z5"
                value={taxId}
                onChange={e => setTaxId(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Prefixes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Invoice Number Prefix</Label>
              <input
                type="text"
                placeholder="e.g. APX-INV-"
                value={invoicePrefix}
                onChange={e => setInvoicePrefix(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-mono text-foreground outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Quotation Prefix</Label>
              <input
                type="text"
                placeholder="e.g. APX-QT-"
                value={quotationPrefix}
                onChange={e => setQuotationPrefix(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-mono text-foreground outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">Workspace Description</Label>
            <input
              type="text"
              placeholder="e.g. Dedicated manufacturing line for custom mechanical keyboards"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground outline-none focus:border-primary"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="px-5 py-2.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              {submitting ? "Creating Workspace..." : "Create Company"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
