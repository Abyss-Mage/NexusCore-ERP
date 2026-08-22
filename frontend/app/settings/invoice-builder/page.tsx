"use client";

import React, { useState, useEffect } from "react";
import { PDFViewer } from "@react-pdf/renderer";
import { InvoiceDocument } from "@/components/pdf/InvoiceDocument";
import { SortableItem } from "@/components/SortableItem";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, FileCheck2, Loader2, RefreshCcw, Plus } from "lucide-react";
import api from "@/lib/api";

// Default blocks if none exist in DB
const DEFAULT_LAYOUT = [
  { id: "header", label: "Header & Logo", visible: true },
  { id: "meta", label: "Client & Invoice Meta Info", visible: true },
  { id: "table", label: "Line Items Table", visible: true },
  { id: "summary", label: "Bank & Totals Summary", visible: true },
  { id: "remarks", label: "Remarks & Notes", visible: true },
  { id: "auth", label: "Signatures & Stamp", visible: true },
];

export default function InvoiceBuilderPage() {
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [isClient, setIsClient] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Custom Block Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newBlockLabel, setNewBlockLabel] = useState("");
  const [newBlockHtml, setNewBlockHtml] = useState("");

  // Mock data for the live preview
  const mockInvoiceData = {
    Company: { company_name: "Mock Agency LLC", address: "123 Tech Street\nSan Francisco, CA", phone: "+1 555-1234", email: "billing@mockagency.com" },
    Invoice: { 
      invoice_number: "INV-2026-001", 
      status: "DRAFT", 
      issue_date: new Date().toISOString(),
      due_date: new Date(Date.now() + 7 * 86400000).toISOString(),
      currency: "USD",
      subtotal: 1500.00,
      grand_total: 1500.00,
      remarks: "Thank you for your business!",
      client: { company_name: "Acme Corp", email: "accounts@acme.com", phone: "+1 555-9876" },
      bank_account: { bank_name: "Chase", account_number: "XXXX-XXXX-1234", swift_code: "CHASUS33" },
      line_items: [
        { description: "Software Architecture Consultation", qty: 10, rate: 100, amount: 1000 },
        { description: "API Integration Setup", qty: 1, rate: 500, amount: 500 }
      ]
    },
    TaxRows: []
  };

  const [customBlocks, setCustomBlocks] = useState<any[]>([]);

  useEffect(() => {
    setIsClient(true);
    // Fetch existing template configuration and custom blocks from settings
    Promise.all([
      api.get("/settings/invoice_template_config").catch(() => null),
      api.get("/settings/custom_invoice_blocks").catch(() => null)
    ]).then(([configRes, blocksRes]) => {
      const cBlocks = blocksRes?.data?.json_value || [];
      setCustomBlocks(cBlocks);

      let savedLayout = configRes?.data?.json_value || [];
      
      // If we have saved layout, we still need to append any NEW custom blocks that aren't in the layout yet
      if (savedLayout.length > 0) {
        const seen = new Set();
        let merged = savedLayout
          .filter((savedItem: any) => {
            if (seen.has(savedItem.id)) return false;
            seen.add(savedItem.id);
            return true;
          })
          .map((savedItem: any) => {
            const def = DEFAULT_LAYOUT.find(d => d.id === savedItem.id);
            const cb = cBlocks.find((b: any) => b.id === savedItem.id);
            return { ...savedItem, label: def?.label || cb?.label || savedItem.id };
          });
          
        // Add any custom blocks that are not yet in the layout (newly created)
        cBlocks.forEach((cb: any) => {
          if (!seen.has(cb.id)) {
            merged.push({ id: cb.id, label: cb.label, visible: true });
          }
        });
        
        setLayout(merged);
      } else {
        // No saved layout, combine default + custom
        const combined = [
          ...DEFAULT_LAYOUT,
          ...cBlocks.map((cb: any) => ({ id: cb.id, label: cb.label, visible: true }))
        ];
        setLayout(combined);
      }
    })
    .catch((err) => {
      console.warn("Error loading config, using default.", err);
    })
    .finally(() => setIsLoaded(true));
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setLayout((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleToggleVisibility = (id: string) => {
    setLayout(items => items.map(item => 
      item.id === id ? { ...item, visible: !item.visible } : item
    ));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save to system settings
      await api.post("/settings", {
        key: "invoice_template_config",
        json_value: layout.map(({ id, visible }) => ({ id, visible })) // Only save essential data
      });
      // Use standard window alert since custom toast requires the context provider which we don't have deeply typed here yet
      alert("Invoice Template Saved Successfully!");
    } catch (e) {
      console.error("Failed to save template", e);
      alert("Failed to save template. See console.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm("Reset layout to default?")) {
      setLayout(DEFAULT_LAYOUT);
    }
  };

  const handleAddCustomBlock = async () => {
    if (!newBlockLabel.trim() || !newBlockHtml.trim()) {
      alert("Label and HTML content are required.");
      return;
    }

    const newId = `custom_${Date.now()}`;
    const newBlock = { id: newId, label: newBlockLabel, html: newBlockHtml };
    
    const updatedCustomBlocks = [...customBlocks, newBlock];
    setCustomBlocks(updatedCustomBlocks);
    
    // Add to layout immediately
    setLayout(prev => [...prev, { id: newId, label: newBlockLabel, visible: true }]);
    
    // Save custom blocks to backend
    try {
      await api.post("/settings", {
        key: "custom_invoice_blocks",
        json_value: updatedCustomBlocks
      });
      // Optionally save layout automatically too
      await api.post("/settings", {
        key: "invoice_template_config",
        json_value: [...layout, { id: newId, visible: true }].map(({ id, visible }) => ({ id, visible }))
      });
      setIsAddModalOpen(false);
      setNewBlockLabel("");
      setNewBlockHtml("");
    } catch (e) {
      console.error("Failed to save new custom block", e);
      alert("Failed to save new custom block.");
    }
  };

  if (!isLoaded) return <div className="p-8 flex items-center gap-4"><Loader2 className="animate-spin text-primary" /> Loading builder...</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <FileCheck2 className="h-8 w-8 text-primary" />
            Visual Invoice Builder
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Drag and drop layout blocks to customize your PDF invoices. Changes are previewed instantly.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleReset} className="glass">
            <RefreshCcw className="h-4 w-4 mr-2" />
            Reset Default
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="shadow-lg shadow-primary/30">
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Layout
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 h-full min-h-0">
        
        {/* Left Side: Drag and Drop Builder */}
        <div className="w-full lg:w-1/3 flex flex-col bg-card/50 backdrop-blur-md rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="p-4 bg-muted/30 border-b border-border flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-lg">Layout Blocks</h3>
              <p className="text-sm text-muted-foreground">Drag to reorder. Click eye to toggle.</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setIsAddModalOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Custom
            </Button>
          </div>
          
          <div className="p-4 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-muted">
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext 
                items={layout.map(i => i.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-1">
                  {layout.map((block) => (
                    <SortableItem 
                      key={block.id} 
                      id={block.id} 
                      label={block.label} 
                      visible={block.visible}
                      onToggleVisibility={handleToggleVisibility}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>

        {/* Right Side: Live PDF Preview */}
        <div className="w-full lg:w-2/3 bg-slate-900 rounded-2xl border border-border shadow-xl overflow-hidden flex flex-col relative">
          <div className="absolute top-4 left-4 z-10 bg-black/60 text-white backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 border border-white/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            LIVE PREVIEW
          </div>
          
          {isClient ? (
            <PDFViewer className="w-full h-full border-none bg-slate-900" showToolbar={false}>
              <InvoiceDocument 
                key={layout.map(l => l.id + (l.visible ? '1' : '0')).join('-')}
                data={mockInvoiceData} 
                templateConfig={layout} 
                customBlocks={customBlocks}
              />
            </PDFViewer>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-400">
              <Loader2 className="animate-spin h-8 w-8" />
            </div>
          )}
        </div>

      </div>

      {/* Add Custom Block Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[600px] bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle>Add Custom HTML Block</DialogTitle>
            <DialogDescription className="text-slate-400">
              Create a custom block using standard HTML. You can use template tags like {`{{Invoice.invoice_number}}`}, {`{{Company.company_name}}`}, etc.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="blockLabel">Block Label</Label>
              <Input
                id="blockLabel"
                value={newBlockLabel}
                onChange={(e) => setNewBlockLabel(e.target.value)}
                placeholder="e.g. Terms & Conditions"
                className="bg-slate-950 border-slate-800"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="blockHtml">HTML Content</Label>
              <Textarea
                id="blockHtml"
                value={newBlockHtml}
                onChange={(e) => setNewBlockHtml(e.target.value)}
                placeholder="<div style='font-size: 10px; color: #64748b; margin-top: 20px;'>...</div>"
                className="h-48 font-mono text-sm bg-slate-950 border-slate-800"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)} className="border-slate-700 hover:bg-slate-800 text-slate-300">
              Cancel
            </Button>
            <Button onClick={handleAddCustomBlock}>Save Custom Block</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
