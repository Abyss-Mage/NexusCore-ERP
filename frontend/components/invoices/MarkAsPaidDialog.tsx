'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api'; 

interface MarkAsPaidProps {
  invoiceId: number;
  outstandingBalance: number;
  currencySymbol: string;
  onSuccess?: () => void;
}

export default function MarkAsPaidDialog({ 
  invoiceId, 
  outstandingBalance, 
  currencySymbol,
  onSuccess 
}: MarkAsPaidProps) {
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const { register, handleSubmit } = useForm({
    defaultValues: {
      amount: outstandingBalance.toString(),
      notes: ''
    }
  });
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      return api.post(`/invoices/${invoiceId}/payment`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      if (onSuccess) onSuccess();
    },
  });

  const onSubmit = (data: any) => {
    if (!date) return;
    // Send exactly what the user typed — no conversions
    mutation.mutate({
      amount_received: parseFloat(data.amount),
      payment_date: new Date(date).toISOString(),
      notes: data.notes || null,
    });
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-300">Payment Date</label>
          <input 
            type="date"
            className="input-dark w-full"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-300">
            Amount Received (₹ INR)
          </label>
          <input 
            className="input-dark w-full"
            type="number" 
            step="0.01"
            {...register("amount", { required: true })}
          />
          {currencySymbol !== 'INR' && currencySymbol !== '₹' && (
            <p className="text-[10px] text-gray-400">
              Invoice currency is {currencySymbol}. Enter the actual INR amount received.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
           <label className="text-sm font-medium text-gray-300">Notes (Optional)</label>
           <input className="input-dark w-full" placeholder="Transaction ID, Bank, etc." {...register("notes")} />
        </div>

        <button type="submit" className="btn-primary w-full flex justify-center items-center mt-2" disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Confirm Payment'}
        </button>
      </form>
    </div>
  );
}