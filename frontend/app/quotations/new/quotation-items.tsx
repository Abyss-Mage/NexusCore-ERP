"use client";

import React from "react";
import { Plus, Trash2 } from "lucide-react";

export interface QuoteItem {
  id: number;
  description: string;
  hsn: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface QuotationItemsProps {
  items: QuoteItem[];
  setItems: (items: QuoteItem[]) => void;
  currency?: string;
  itemCodeLabel?: string;
}

export function QuotationItemsTable({ items, setItems, currency = "INR", itemCodeLabel = "Item Code / HSN" }: QuotationItemsProps) {

  const addItem = () => {
    setItems([
      ...items, 
      { id: Date.now(), description: "", hsn: "", quantity: 1, rate: 0, amount: 0 }
    ]);
  };

  const removeItem = (id: number) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const updateItem = (id: number, field: keyof QuoteItem, value: string | number) => {
    const newItems = items.map((item) => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        // Recalculate amount if quantity or rate changes
        if (field === "quantity" || field === "rate") {
            updatedItem.amount = Number(updatedItem.quantity) * Number(updatedItem.rate);
        }
        return updatedItem;
      }
      return item;
    });
    setItems(newItems);
  };

  // Helper for consistent currency formatting
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-left font-body-md">
          <thead>
            <tr className="text-gray-400 font-medium text-sm border-b border-white/10">
              <th className="pb-3 px-2">Description</th>
              <th className="pb-3 px-2 w-40">{itemCodeLabel}</th>
              <th className="pb-3 px-2 w-20 text-center">Qty</th>
              <th className="pb-3 px-2 w-[130px] text-right">Rate</th>
              <th className="pb-3 px-3 w-[130px] text-right">Amount</th>
              <th className="pb-3 px-2 w-[50px]"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {items.map((item) => (
              <tr key={item.id} className="group hover:bg-white/[0.02] transition-colors">
                <td className="py-3 px-2">
                  <input 
                    placeholder="Item Name" 
                    value={item.description}
                    onChange={(e) => updateItem(item.id, "description", e.target.value)}
                    className="input-dark w-full px-3 py-2 rounded-md text-sm"
                  />
                </td>
                <td className="py-3 px-2">
                  <input 
                    placeholder={itemCodeLabel}
                    value={item.hsn}
                    onChange={(e) => updateItem(item.id, "hsn", e.target.value)}
                    className="input-dark w-full px-3 py-2 rounded-md text-xs"
                  />
                </td>
                <td className="py-3 px-2">
                  <input 
                    type="number" min="1" value={item.quantity}
                    onChange={(e) => updateItem(item.id, "quantity", Number(e.target.value))}
                    className="input-dark w-full px-2 py-2 rounded-md text-sm text-center"
                  />
                </td>
                <td className="py-3 px-2">
                  <input 
                    type="number" min="0" value={item.rate}
                    onChange={(e) => updateItem(item.id, "rate", Number(e.target.value))}
                    className="input-dark w-full px-2 py-2 rounded-md text-sm text-right"
                  />
                </td>
                <td className="py-3 px-3 text-right font-medium text-sm text-cyan-400 align-middle">
                  {formatMoney(item.amount)}
                </td>
                <td className="py-3 px-2 text-center align-middle">
                  <button className="text-gray-500 hover:text-red-400 transition-colors p-1" onClick={() => removeItem(item.id)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {/* Add New Row */}
            <tr>
              <td colSpan={6} className="pt-4 pb-1">
                <button onClick={addItem} className="btn-ghost w-full py-2.5 rounded-lg border-dashed text-sm flex items-center justify-center gap-2 hover:border-cyan-500/50 hover:text-cyan-400 transition-all text-gray-400">
                  <Plus className="h-4 w-4" />
                  Add Line Item
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}