import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { InvoiceDocument } from '@/components/pdf/InvoiceDocument';
import { QuotationDocument } from '@/components/pdf/QuotationDocument';
import { LedgerDocument } from '@/components/pdf/LedgerDocument';
import api from './api';

export const generateInvoicePdfBlob = async (id: number): Promise<Blob> => {
  const [res, templateRes, customBlocksRes, locRes] = await Promise.all([
    api.get(`/invoices/${id}/pdf-data`),
    api.get(`/settings/invoice_template_config`).catch(() => null),
    api.get(`/settings/custom_invoice_blocks`).catch(() => null),
    api.get('/settings/LOCALIZATION').catch(() => null)
  ]);
  
  const templateConfig = templateRes?.data?.json_value || undefined;
  const customBlocks = customBlocksRes?.data?.json_value || [];
  
  let itemCodeLabel = "HSN/SAC";
  if (locRes?.data?.value) {
      try {
          const parsed = typeof locRes.data.value === 'string' ? JSON.parse(locRes.data.value) : locRes.data.value;
          if (parsed.item_code_label) itemCodeLabel = parsed.item_code_label;
      } catch (e) {}
  }
  
  const blob = await pdf(<InvoiceDocument data={res.data} templateConfig={templateConfig} customBlocks={customBlocks} itemCodeLabel={itemCodeLabel} />).toBlob();
  return blob;
};

export const generateQuotationPdfBlob = async (id: number): Promise<Blob> => {
  const [res, locRes] = await Promise.all([
    api.get(`/quotations/${id}/pdf-data`),
    api.get('/settings/LOCALIZATION').catch(() => null)
  ]);
  
  let itemCodeLabel = "HSN/SAC";
  if (locRes?.data?.value) {
      try {
          const parsed = typeof locRes.data.value === 'string' ? JSON.parse(locRes.data.value) : locRes.data.value;
          if (parsed.item_code_label) itemCodeLabel = parsed.item_code_label;
      } catch (e) {}
  }

  const blob = await pdf(<QuotationDocument data={res.data} itemCodeLabel={itemCodeLabel} />).toBlob();
  return blob;
};

export const generateLedgerPdfBlob = async (data: any): Promise<Blob> => {
  const blob = await pdf(<LedgerDocument data={data} />).toBlob();
  return blob;
};
