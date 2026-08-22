"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { RefreshCw, TrendingUp, Globe2, Check } from "lucide-react";
import { useToast } from "@/components/ui/toast-context";

interface ExchangeRateItem {
  target_currency: string;
  rate: number;
  last_updated: string;
  source: string;
}

export default function FXRatesWidget() {
  const [rates, setRates] = useState<ExchangeRateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  const fetchRates = async () => {
    try {
      const res = await api.get("/fx/rates?base=USD");
      if (res.data?.rates) {
        setRates(res.data.rates);
      }
    } catch (e) {
      console.error("Failed to load FX rates", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post("/fx/sync");
      toast("Exchange rates updated from live markets", "success");
      await fetchRates();
    } catch (e) {
      console.error("Failed to sync FX rates", e);
      toast("Failed to update exchange rates", "error");
    } finally {
      setSyncing(false);
    }
  };

  const majorCurrencies = ["INR", "EUR", "GBP", "AED", "CAD"];
  const filteredRates = rates.filter(r => majorCurrencies.includes(r.target_currency));

  if (loading && rates.length === 0) return null;

  return (
    <div className="bg-card/80 backdrop-blur-sm border border-border/80 rounded-xl p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-border/50">
        <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
          <Globe2 className="w-3.5 h-3.5 text-primary" />
          <span>Live FX Rates</span>
          <span className="text-[10px] text-muted-foreground font-mono">(Base: 1 USD)</span>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="text-[11px] font-semibold text-primary hover:text-primary/80 flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 hover:bg-primary/20 transition-all cursor-pointer disabled:opacity-50"
          title="Refresh Exchange Rates"
        >
          <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {filteredRates.map((r) => (
          <div
            key={r.target_currency}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary/50 border border-border/50 font-mono text-[11px]"
          >
            <span className="text-muted-foreground font-bold">{r.target_currency}:</span>
            <span className="text-foreground font-semibold">
              {r.rate >= 10 ? r.rate.toFixed(2) : r.rate.toFixed(4)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
