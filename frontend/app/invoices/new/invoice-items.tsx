// frontend/app/invoices/new/invoice-items.tsx
"use client";

import React from "react";
import { Plus, Trash2 } from "lucide-react";

export interface LineItem {
  id: number;
  description: string;
  hsn: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface InvoiceItemsProps {
  items: LineItem[];
  setItems: (items: LineItem[]) => void;
  currency?: string;
  itemCodeLabel?: string;
}

export function InvoiceItemsTable({ items, setItems, currency = "INR", itemCodeLabel = "Item Code / HSN" }: InvoiceItemsProps) {

  const addItem = () => {
    setItems([...items, { id: Date.now(), description: "", hsn: "", quantity: 1, rate: 0, amount: 0 }]);
  };

  const removeItem = (id: number) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const updateItem = (id: number, field: keyof LineItem, value: string | number) => {
    const newItems = items.map((item) => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        if (field === "quantity" || field === "rate") {
            updatedItem.amount = Number(updatedItem.quantity) * Number(updatedItem.rate);
        }
        return updatedItem;
      }
      return item;
    });
    setItems(newItems);
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-left font-body-md">
          <thead>
            <tr className="text-on-surface-variant font-label-sm text-label-sm border-b border-white/10">
              <th className="pb-3 font-medium">Description</th>
              <th className="pb-3 font-medium w-40">{itemCodeLabel}</th>
              <th className="pb-3 font-medium w-20">Qty</th>
              <th className="pb-3 font-medium w-32">Rate</th>
              <th className="pb-3 font-medium w-32 text-right">Amount</th>
              <th className="pb-3 font-medium w-12 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {items.map((item) => (
              <tr key={item.id} className="group">
                <td className="py-3 pr-2">
                  <input 
                    className="input-dark w-full px-3 py-2 rounded-md text-sm"
                    placeholder="Item description" 
                    value={item.description}
                    onChange={(e) => updateItem(item.id, "description", e.target.value)}
                  />
                </td>
                <td className="py-3 pr-2">
                  <input 
                    className="input-dark w-full px-3 py-2 rounded-md text-sm"
                    placeholder={itemCodeLabel}
                    value={item.hsn}
                    onChange={(e) => updateItem(item.id, "hsn", e.target.value)}
                  />
                </td>
                <td className="py-3 pr-2">
                  <input 
                    className="input-dark w-full px-3 py-2 rounded-md text-sm"
                    type="number" min="1" value={item.quantity}
                    onChange={(e) => updateItem(item.id, "quantity", Number(e.target.value))}
                  />
                </td>
                <td className="py-3 pr-2">
                  <input 
                    className="input-dark w-full px-3 py-2 rounded-md text-sm"
                    type="number" min="0" value={item.rate}
                    onChange={(e) => updateItem(item.id, "rate", Number(e.target.value))}
                  />
                </td>
                <td className="py-3 text-right text-on-surface font-medium align-middle">
                  {new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency }).format(item.amount)}
                </td>
                <td className="py-3 text-center align-middle">
                  <button className="text-on-surface-variant hover:text-error transition-colors p-1" onClick={() => removeItem(item.id)}>
                    <span className="material-symbols-outlined text-[20px]">delete</span>
                  </button>
                </td>
              </tr>
            ))}
            {/* Add New Row */}
            <tr>
              <td colSpan={6} className="pt-4 pb-1">
                <button onClick={addItem} className="btn-ghost w-full py-2.5 rounded-lg border-dashed text-sm flex items-center justify-center gap-2 hover:border-primary/50 hover:text-primary transition-all">
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Add New Item
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}