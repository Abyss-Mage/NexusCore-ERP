"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, Download, Trash2, Check, Eye, FileCode2, Lock, Palette, Code2, Plus, GripVertical } from "lucide-react";
import { useToast } from "@/components/ui/toast-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TemplateItem {
  name: string;
  type: string;
  is_builtin: boolean;
  is_active: boolean;
}

interface TemplateSettingsProps {
  disabled?: boolean;
}

export function TemplateSettings({ disabled }: TemplateSettingsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState<string>("invoice");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [customBlocks, setCustomBlocks] = useState<any[]>([]);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [blockLabel, setBlockLabel] = useState("");
  const [blockHtml, setBlockHtml] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchTemplates = async () => {
    try {
      const [listRes, blocksRes] = await Promise.all([
        api.get("/templates/list"),
        api.get("/settings/custom_invoice_blocks").catch(() => null)
      ]);
      setTemplates(listRes.data || []);
      setCustomBlocks(blocksRes?.data?.json_value || []);
    } catch {
      toast("Failed to load templates", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTemplates(); }, []);

  const invoiceTemplates = templates.filter(t => t.type === "invoice");
  const quotationTemplates = templates.filter(t => t.type === "quotation");

  const handleActivate = async (name: string, type: string) => {
    setActivating(`${type}-${name}`);
    try {
      await api.put("/templates/active", { name, type });
      toast(`${name} set as active ${type} template`, "success");
      fetchTemplates();
    } catch {
      toast("Failed to set active template", "error");
    } finally {
      setActivating(null);
    }
  };

  const handlePreview = async (name: string, type: string) => {
    setPreviewing(`${type}-${name}`);
    try {
      const res = await api.get(`/templates/${name}/preview`, {
        params: { type },
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      window.open(url, "_blank");
    } catch {
      toast("Failed to generate preview", "error");
    } finally {
      setPreviewing(null);
    }
  };

  const handleExport = async (name: string, type: string) => {
    try {
      const res = await api.get(`/templates/${name}/export`, {
        params: { type },
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}.ict`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast("Failed to export template", "error");
    }
  };

  const handleDelete = async (name: string, type: string) => {
    if (!confirm(`Delete template "${name}"?`)) return;
    try {
      await api.delete(`/templates/${name}`, { params: { type } });
      toast("Template deleted", "success");
      fetchTemplates();
    } catch {
      toast("Failed to delete template", "error");
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("type", uploadType);
      await api.post("/templates/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast("Template uploaded successfully", "success");
      setUploadOpen(false);
      setUploadFile(null);
      fetchTemplates();
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Upload failed";
      toast(msg, "error");
    } finally {
      setUploading(false);
    }
  };

  const saveCustomBlock = async () => {
    if (!blockLabel.trim()) return toast("Block label is required", "error");
    if (!blockHtml.trim()) return toast("HTML content is required", "error");
    
    setUploading(true);
    try {
      let updatedBlocks = [...customBlocks];
      if (editingBlockId) {
        updatedBlocks = updatedBlocks.map(b => 
          b.id === editingBlockId ? { ...b, label: blockLabel, html: blockHtml } : b
        );
      } else {
        updatedBlocks.push({
          id: `custom_${Date.now()}`,
          label: blockLabel,
          html: blockHtml
        });
      }
      
      await api.post("/settings", {
        key: "custom_invoice_blocks",
        json_value: updatedBlocks
      });
      
      toast(editingBlockId ? "Block updated" : "Block created", "success");
      setBlockDialogOpen(false);
      setCustomBlocks(updatedBlocks);
    } catch {
      toast("Failed to save custom block", "error");
    } finally {
      setUploading(false);
    }
  };

  const deleteCustomBlock = async (id: string) => {
    if (!confirm("Delete this custom block?")) return;
    try {
      const updatedBlocks = customBlocks.filter(b => b.id !== id);
      await api.post("/settings", {
        key: "custom_invoice_blocks",
        json_value: updatedBlocks
      });
      setCustomBlocks(updatedBlocks);
      toast("Block deleted", "success");
    } catch {
      toast("Failed to delete block", "error");
    }
  };

  const TemplateCard = ({ t }: { t: TemplateItem }) => {
    const key = `${t.type}-${t.name}`;
    return (
      <div className={`relative rounded-xl border-2 p-4 transition-all ${
        t.is_active 
          ? "border-primary bg-primary/5 shadow-md" 
          : "border-border hover:border-primary/40 hover:shadow-sm"
      }`}>
        {t.is_active && (
          <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full p-1">
            <Check className="w-3 h-3" />
          </div>
        )}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h4 className="font-semibold capitalize text-sm">{t.name === 'default' ? 'Visual Builder' : t.name}</h4>
            <div className="flex gap-1.5 mt-1">
              {t.is_builtin ? (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Built-in</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">Custom</Badge>
              )}
              {t.is_active && (
                <Badge className="text-[10px] px-1.5 py-0 bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30">Active</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {t.name === 'default' && (
             <Button
               size="sm"
               variant="outline"
               className="h-7 text-xs gap-1"
               onClick={() => router.push('/settings/invoice-builder')}
             >
               <Palette className="w-3 h-3" />
               Edit Layout
             </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            disabled={previewing === key}
            onClick={() => handlePreview(t.name, t.type)}
          >
            {previewing === key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
            Preview
          </Button>

          {!t.is_active && !disabled && (
            <Button
              size="sm"
              className="h-7 text-xs gap-1"
              disabled={activating === key}
              onClick={() => handleActivate(t.name, t.type)}
            >
              {activating === key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Activate
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1"
            onClick={() => handleExport(t.name, t.type)}
          >
            <Download className="w-3 h-3" />
          </Button>

          {!t.is_builtin && !disabled && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
              onClick={() => handleDelete(t.name, t.type)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <Card className="border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="p-4 flex items-start gap-3">
          <Lock className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-blue-700 dark:text-blue-300">Encrypted Template Format (.ict)</p>
            <p className="text-muted-foreground mt-0.5">
              Templates are stored in InvoiceCore&apos;s proprietary encrypted format. Upload HTML files to create templates, 
              or import .ict files shared by other users. Exported .ict files can only be used with InvoiceCore.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Upload Button */}
      {!disabled && (
        <div className="flex gap-2">
          <Button onClick={() => setUploadOpen(true)} className="gap-2" variant="outline">
            <Upload className="w-4 h-4" /> Upload Template
          </Button>
        </div>
      )}

      {/* Invoice Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileCode2 className="w-5 h-5" />
            Invoice Templates
          </CardTitle>
          <CardDescription>Choose an active template for generating invoice PDFs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {invoiceTemplates.map(t => <TemplateCard key={`${t.type}-${t.name}`} t={t} />)}
          </div>
        </CardContent>
      </Card>

      {/* Quotation Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileCode2 className="w-5 h-5" />
            Quotation Templates
          </CardTitle>
          <CardDescription>Choose an active template for generating quotation PDFs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {quotationTemplates.map(t => <TemplateCard key={`${t.type}-${t.name}`} t={t} />)}
          </div>
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Template</DialogTitle>
            <DialogDescription>
              Upload an HTML file to create a new template, or import an .ict file.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template Type</Label>
              <Select value={uploadType} onValueChange={setUploadType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="quotation">Quotation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Template File</Label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".html,.htm,.ict"
                  className="hidden"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
                {uploadFile ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <FileCode2 className="w-5 h-5 text-primary" />
                    <span className="font-medium">{uploadFile.name}</span>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Click to select .html or .ict file</p>
                  </div>
                )}
              </div>
            </div>

            {/* Variable Reference */}
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors font-medium">
                Template Variable Reference
              </summary>
              <div className="mt-2 p-3 bg-muted rounded-lg space-y-1.5 font-mono">
                <p><strong>Invoice:</strong> .Invoice.InvoiceNumber, .Invoice.IssueDate, .Invoice.DueDate, .Invoice.Status, .Invoice.Currency</p>
                <p><strong>Client:</strong> .Invoice.Client.CompanyName, .Invoice.Client.TaxID, .ClientAddress</p>
                <p><strong>Items:</strong> {"{{range .Invoice.LineItems}}"} .description, .qty, .rate, .amount {"{{end}}"}</p>
                <p><strong>Money:</strong> .Invoice.Subtotal, .Invoice.GrandTotal, .TaxRows</p>
                <p><strong>Bank:</strong> .Invoice.BankAccount.BankName, .Invoice.BankAccount.AccountNumber</p>
                <p><strong>Branding:</strong> .Logo, .Signature, .Stamp (base64 data URIs)</p>
                <p><strong>Company:</strong> .Company (map with company_name, gstin, address, etc.)</p>
              </div>
            </details>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button onClick={handleUpload} disabled={!uploadFile || uploading} className="gap-2">
              {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Custom Blocks Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Code2 className="w-5 h-5" />
              Custom Blocks
            </CardTitle>
            <CardDescription>Create HTML blocks to use in the Visual Builder</CardDescription>
          </div>
          <Button onClick={() => {
            setEditingBlockId(null);
            setBlockLabel("");
            setBlockHtml("");
            setBlockDialogOpen(true);
          }} className="gap-2" size="sm">
            <Plus className="w-4 h-4" /> Create Block
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {customBlocks.map(block => (
              <div key={block.id} className="relative rounded-xl border-2 p-4 border-border hover:border-primary/40 hover:shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold capitalize text-sm">{block.label}</h4>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 mt-1">HTML Block</Badge>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      setEditingBlockId(block.id);
                      setBlockLabel(block.label);
                      setBlockHtml(block.html);
                      setBlockDialogOpen(true);
                    }}
                  >
                    Edit Code
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                    onClick={() => deleteCustomBlock(block.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
            {customBlocks.length === 0 && (
              <div className="col-span-full py-8 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                No custom blocks created yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Block Dialog */}
      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingBlockId ? "Edit" : "Create"} Custom Block</DialogTitle>
            <DialogDescription>
              Write HTML and inline CSS to create a reusable block for the Visual Builder.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Block Name</Label>
              <input 
                type="text" 
                value={blockLabel}
                onChange={(e) => setBlockLabel(e.target.value)}
                className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="e.g. Special Terms"
              />
            </div>
            <div className="space-y-2">
              <Label>HTML/CSS Content</Label>
              <textarea 
                value={blockHtml}
                onChange={(e) => setBlockHtml(e.target.value)}
                className="w-full flex min-h-[200px] font-mono rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="<div style='color: red;'>My custom block</div>"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveCustomBlock} disabled={uploading}>
              {uploading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Block
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
