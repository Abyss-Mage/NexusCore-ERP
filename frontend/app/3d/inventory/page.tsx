"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { 
  Plus, Edit2, Trash2, Package, AlertTriangle, CheckCircle2, 
  Scale, MapPin, SlidersHorizontal
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast-context";
import { Filament } from "@/types/print";
import { AVAILABLE_CURRENCIES } from "@/lib/currencies";

const PRESET_COLORS = [
  { name: "Black", hex: "#18181B" },
  { name: "White", hex: "#F8FAFC" },
  { name: "Charcoal / Gray", hex: "#4B5563" },
  { name: "Bambu Green", hex: "#00AE42" },
  { name: "Cyan / Blue", hex: "#0284C7" },
  { name: "Royal Purple", hex: "#7C3AED" },
  { name: "Ruby Red", hex: "#DC2626" },
  { name: "Orange", hex: "#EA580C" },
  { name: "Yellow", hex: "#EAB308" },
  { name: "Silver / Metallic", hex: "#94A3B8" },
  { name: "Translucent / Clear", hex: "#E2E8F0" },
];

export default function FilamentInventory() {
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [adjustFilament, setAdjustFilament] = useState<Filament | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number>(0);
  const [adjustMode, setAdjustMode] = useState<"deduct" | "set">("deduct");
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    brand: "Bambu Lab",
    material_type: "PLA Basic",
    color: "Black",
    color_hex: "#18181B",
    initial_weight_grams: 1000,
    remaining_weight_grams: 1000,
    spool_price: 1800,
    cost_per_gram: 1.8,
    density: 1.24,
    diameter_mm: 1.75,
    location: "Main Storage"
  });

  const [baseCurrency, setBaseCurrency] = useState("₹");

  const fetchFilaments = async () => {
    try {
      const [res, locRes] = await Promise.all([
        api.get('/software/filaments'),
        api.get('/settings/LOCALIZATION').catch(() => ({ data: null }))
      ]);
      setFilaments(Array.isArray(res.data) ? res.data : []);
      if (locRes.data && locRes.data.value) {
        try {
          const parsed = typeof locRes.data.value === 'string' ? JSON.parse(locRes.data.value) : locRes.data.value;
          if (parsed.base_currency) {
            const symbolMatch = AVAILABLE_CURRENCIES?.find((c: any) => c.code === parsed.base_currency);
            setBaseCurrency(symbolMatch ? symbolMatch.symbol : parsed.base_currency);
          }
        } catch (e) {}
      }
    } catch (err) {
      console.error("Failed to fetch filaments", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFilaments();
  }, []);

  const handleOpenEdit = (filament: Filament) => {
    setFormData({
      brand: filament.brand || "Bambu Lab",
      material_type: filament.material_type,
      color: filament.color,
      color_hex: filament.color_hex || "#18181B",
      initial_weight_grams: filament.initial_weight_grams || 1000,
      remaining_weight_grams: filament.remaining_weight_grams ?? 1000,
      spool_price: filament.spool_price || 0,
      cost_per_gram: filament.cost_per_gram || 0,
      density: filament.density || 1.24,
      diameter_mm: filament.diameter_mm || 1.75,
      location: filament.location || "Main Storage"
    });
    setEditingId(filament.id);
    setIsOpen(true);
  };

  const handleOpenAdd = () => {
    setFormData({
      brand: "Bambu Lab",
      material_type: "PLA Basic",
      color: "Black",
      color_hex: "#18181B",
      initial_weight_grams: 1000,
      remaining_weight_grams: 1000,
      spool_price: 1800,
      cost_per_gram: 1.8,
      density: 1.24,
      diameter_mm: 1.75,
      location: "Main Storage"
    });
    setEditingId(null);
    setIsOpen(true);
  };

  const handleSpoolPriceChange = (price: number, initialWeight: number) => {
    const costPerGram = initialWeight > 0 ? price / initialWeight : 0;
    setFormData(prev => ({
      ...prev,
      spool_price: price,
      cost_per_gram: Number(costPerGram.toFixed(4))
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        initial_weight_grams: Number(formData.initial_weight_grams),
        remaining_weight_grams: Number(formData.remaining_weight_grams),
        spool_price: Number(formData.spool_price),
        cost_per_gram: Number(formData.cost_per_gram),
        density: Number(formData.density),
        diameter_mm: Number(formData.diameter_mm)
      };

      if (editingId) {
        await api.put(`/software/filaments/${editingId}`, payload);
        toast("Spool updated successfully", "success");
      } else {
        await api.post('/software/filaments', payload);
        toast("Spool added to inventory", "success");
      }
      setIsOpen(false);
      fetchFilaments();
    } catch (err: any) {
      toast(err.response?.data?.error || err.message || "Failed to save filament", "error");
    }
  };

  const handleOpenAdjust = (filament: Filament) => {
    setAdjustFilament(filament);
    setAdjustAmount(0);
    setAdjustMode("deduct");
    setIsAdjustOpen(true);
  };

  const handleApplyAdjustment = async () => {
    if (!adjustFilament) return;
    try {
      let payload: any = {};
      if (adjustMode === "deduct") {
        payload.deduct_grams = Number(adjustAmount);
      } else {
        payload.remaining_weight_grams = Number(adjustAmount);
      }

      await api.post(`/software/filaments/${adjustFilament.id}/adjust`, payload);
      toast("Spool weight updated", "success");
      setIsAdjustOpen(false);
      fetchFilaments();
    } catch (err: any) {
      toast(err.response?.data?.error || err.message || "Failed to adjust weight", "error");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this spool from inventory?")) return;
    try {
      await api.delete(`/software/filaments/${id}`);
      fetchFilaments();
      toast("Spool deleted", "success");
    } catch (err: any) {
      toast(err.response?.data?.error || err.message || "Failed to delete spool", "error");
    }
  };

  // Calculations for KPIs
  const totalWeightGrams = filaments.reduce((acc, f) => acc + (f.remaining_weight_grams || 0), 0);
  const lowStockCount = filaments.filter(f => (f.remaining_weight_grams || 0) <= 150 && (f.remaining_weight_grams || 0) > 0).length;
  const totalAssetValue = filaments.reduce((acc, f) => acc + ((f.remaining_weight_grams || 0) * (f.cost_per_gram || 0)), 0);

  return (
    <div className="space-y-6 flex flex-col p-8 min-h-[calc(100vh-64px)]">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-on-surface flex items-center gap-3">
            <Package className="h-8 w-8 text-primary" />
            Filament &amp; Material Inventory
          </h2>
          <p className="text-muted-foreground mt-1">Track spools, real-time remaining weight, material costs, and storage locations</p>
        </div>
        <div className="flex gap-3">
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <button 
                className="bg-primary text-primary-foreground font-medium px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm hover:opacity-90 transition-opacity" 
                onClick={handleOpenAdd}
              >
                <Plus className="w-5 h-5" /> Add Spool
              </button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border text-foreground max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Filament Spool" : "Add New Filament Spool"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                {/* Brand & Material */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Brand / Manufacturer</Label>
                    <input 
                      required 
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none" 
                      placeholder="e.g. Bambu Lab, eSUN, Polymaker"
                      value={formData.brand} 
                      onChange={e => setFormData({ ...formData, brand: e.target.value })} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Material Type</Label>
                    <input 
                      required 
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none" 
                      placeholder="e.g. PLA Basic, PETG-HF, ABS, TPU"
                      value={formData.material_type} 
                      onChange={e => setFormData({ ...formData, material_type: e.target.value })} 
                    />
                  </div>
                </div>

                {/* Color Name & Hex Swatch */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Color Name &amp; Swatch</Label>
                  <div className="flex gap-3 items-center">
                    <input 
                      type="color"
                      className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-background p-0.5 shrink-0"
                      value={formData.color_hex}
                      onChange={e => setFormData({ ...formData, color_hex: e.target.value })}
                    />
                    <input 
                      required 
                      className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none" 
                      placeholder="e.g. Matte Charcoal, Signal Red, Jade White"
                      value={formData.color} 
                      onChange={e => setFormData({ ...formData, color: e.target.value })} 
                    />
                  </div>
                  {/* Preset Swatches */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => setFormData({ ...formData, color: c.name, color_hex: c.hex })}
                        className="w-5 h-5 rounded-full border border-white/20 shadow-sm transition-transform hover:scale-110"
                        style={{ backgroundColor: c.hex }}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Weights */}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Full Spool Weight (grams)</Label>
                    <input 
                      required 
                      type="number" 
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none" 
                      value={formData.initial_weight_grams} 
                      onChange={e => {
                        const initW = Number(e.target.value);
                        handleSpoolPriceChange(formData.spool_price, initW);
                        setFormData(prev => ({ ...prev, initial_weight_grams: initW }));
                      }} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Current Remaining (grams)</Label>
                    <input 
                      required 
                      type="number" 
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none" 
                      value={formData.remaining_weight_grams} 
                      onChange={e => setFormData({ ...formData, remaining_weight_grams: Number(e.target.value) })} 
                    />
                  </div>
                </div>

                {/* Pricing & Cost */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Spool Price ({baseCurrency})</Label>
                    <input 
                      required 
                      type="number" 
                      step="0.01"
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none" 
                      value={formData.spool_price} 
                      onChange={e => handleSpoolPriceChange(Number(e.target.value), formData.initial_weight_grams)} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cost Per Gram ({baseCurrency}/g)</Label>
                    <input 
                      required 
                      type="number" 
                      step="0.0001"
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none" 
                      value={formData.cost_per_gram} 
                      onChange={e => setFormData({ ...formData, cost_per_gram: Number(e.target.value) })} 
                    />
                  </div>
                </div>

                {/* Storage Location */}
                <div className="space-y-1.5 pt-2 border-t border-border">
                  <Label className="text-xs">Storage Location / Shelf</Label>
                  <input 
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none" 
                    placeholder="e.g. AMS Slot 1, Drybox A, Shelf B2"
                    value={formData.location} 
                    onChange={e => setFormData({ ...formData, location: e.target.value })} 
                  />
                </div>

                <button type="submit" className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition-opacity mt-4">
                  {editingId ? "Update Spool" : "Save Spool to Inventory"}
                </button>
              </form>
            </DialogContent>
          </Dialog>

          {/* Quick Adjust Modal */}
          <Dialog open={isAdjustOpen} onOpenChange={setIsAdjustOpen}>
            <DialogContent className="bg-card border-border text-foreground max-w-sm">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Scale className="w-5 h-5 text-primary" /> Adjust Spool Weight
                </DialogTitle>
              </DialogHeader>
              {adjustFilament && (
                <div className="space-y-4 pt-2">
                  <div className="p-3 bg-muted/40 rounded-lg flex items-center gap-3">
                    <span 
                      className="w-4 h-4 rounded-full border border-white/20 shrink-0" 
                      style={{ backgroundColor: adjustFilament.color_hex || "#3B82F6" }} 
                    />
                    <div className="text-xs">
                      <div className="font-bold text-foreground">{adjustFilament.brand} {adjustFilament.material_type}</div>
                      <div className="text-muted-foreground">{adjustFilament.color} • Current: <span className="text-foreground font-semibold">{adjustFilament.remaining_weight_grams}g</span></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => { setAdjustMode("deduct"); setAdjustAmount(50); }}
                      className={`p-2 rounded-lg border text-xs font-medium ${adjustMode === "deduct" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                    >
                      Deduct Used Grams
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAdjustMode("set"); setAdjustAmount(adjustFilament.remaining_weight_grams); }}
                      className={`p-2 rounded-lg border text-xs font-medium ${adjustMode === "set" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                    >
                      Set Exact Weight
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">{adjustMode === "deduct" ? "Grams to Deduct" : "New Total Remaining (grams)"}</Label>
                    <input 
                      type="number"
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none font-mono"
                      value={adjustAmount}
                      onChange={e => setAdjustAmount(Number(e.target.value))}
                    />
                  </div>

                  {adjustMode === "deduct" && (
                    <div className="flex gap-2">
                      {[25, 50, 100, 250].map(g => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setAdjustAmount(g)}
                          className="flex-1 py-1 px-2 rounded-md bg-secondary text-xs hover:bg-muted text-foreground transition-colors"
                        >
                          -{g}g
                        </button>
                      ))}
                    </div>
                  )}

                  <button 
                    onClick={handleApplyAdjustment}
                    className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition-opacity"
                  >
                    Apply Adjustment
                  </button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Spools</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">{filaments.length}</span>
            <span className="text-xs text-muted-foreground">Units in Stock</span>
          </div>
        </div>

        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Available Material</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-emerald-500">
              {(totalWeightGrams / 1000).toFixed(2)}
            </span>
            <span className="text-xs text-emerald-600 font-medium">kg total</span>
          </div>
        </div>

        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Low Stock Spools</span>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold ${lowStockCount > 0 ? 'text-amber-500' : 'text-foreground'}`}>
              {lowStockCount}
            </span>
            <span className="text-xs text-amber-600 font-medium">&lt; 150g remaining</span>
          </div>
        </div>

        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Inventory Value</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">
              {baseCurrency}{totalAssetValue.toFixed(2)}
            </span>
            <span className="text-xs text-muted-foreground">In Stock</span>
          </div>
        </div>
      </div>

      {/* Spools Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-2">
        {filaments.map((f) => {
          const initWeight = f.initial_weight_grams || 1000;
          const remWeight = f.remaining_weight_grams ?? 1000;
          const percent = Math.max(0, Math.min(100, Math.round((remWeight / initWeight) * 100)));
          const isLow = remWeight <= 150 && remWeight > 0;
          const isDepleted = remWeight <= 0;

          return (
            <div key={f.id} className="bg-card rounded-2xl border border-border p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4 group relative overflow-hidden">
              {/* Header */}
              <div>
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-3">
                    {/* Color Swatch Circle */}
                    <div 
                      className="w-8 h-8 rounded-full border-2 border-white/20 shadow-inner flex items-center justify-center shrink-0" 
                      style={{ backgroundColor: f.color_hex || "#3B82F6" }} 
                    />
                    <div>
                      <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                        {f.color}
                      </h3>
                      <p className="text-xs text-muted-foreground font-medium">{f.brand} • <span className="font-semibold text-foreground/80">{f.material_type}</span></p>
                    </div>
                  </div>

                  <div className="flex gap-1 items-center">
                    <button 
                      onClick={() => handleOpenAdjust(f)} 
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                      title="Adjust Remaining Weight"
                    >
                      <SlidersHorizontal className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleOpenEdit(f)} 
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                      title="Edit Spool"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(f.id)} 
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete Spool"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Remaining Weight Visual Meter */}
                <div className="mt-4 space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-medium flex items-center gap-1">
                      <Scale className="w-3 h-3 text-primary" /> Remaining
                    </span>
                    <span className="font-bold text-foreground">
                      {remWeight}g <span className="font-normal text-muted-foreground text-[11px]">/ {initWeight}g</span> ({percent}%)
                    </span>
                  </div>
                  <div className="w-full bg-secondary/60 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className={`h-2.5 rounded-full transition-all duration-500 ${
                        isDepleted ? "bg-rose-500" : isLow ? "bg-amber-500" : "bg-primary"
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                {/* Info Pills */}
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-muted-foreground">Unit Cost</span>
                    <span className="font-semibold text-foreground">{baseCurrency}{Number(f.cost_per_gram).toFixed(3)}/g</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-muted-foreground">Remaining Value</span>
                    <span className="font-semibold text-foreground">{baseCurrency}{(remWeight * (f.cost_per_gram || 0)).toFixed(2)}</span>
                  </div>
                </div>

                {/* Location */}
                {f.location && (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-2">
                    <MapPin className="w-3 h-3 text-muted-foreground" />
                    <span>{f.location}</span>
                  </div>
                )}
              </div>

              {/* Status Badge */}
              <div className="pt-2 border-t border-border flex justify-between items-center text-xs">
                {isDepleted ? (
                  <span className="text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full font-medium">Depleted (0g)</span>
                ) : isLow ? (
                  <span className="text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Low Stock
                  </span>
                ) : (
                  <span className="text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> In Stock
                  </span>
                )}

                <button
                  onClick={() => handleOpenAdjust(f)}
                  className="text-primary hover:underline text-[11px] font-medium"
                >
                  Quick Adjust
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {!loading && filaments.length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 bg-card rounded-2xl border border-dashed border-border mt-4 text-center">
          <Package className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-xl font-semibold mb-2">No Filament in Inventory</h3>
          <p className="text-muted-foreground mb-6 max-w-md text-sm">
            Click "Add Spool" above to track your filament rolls, remaining grams, and material costs.
          </p>
        </div>
      )}
    </div>
  );
}

