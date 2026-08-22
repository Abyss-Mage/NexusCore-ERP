import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import Html from 'react-pdf-html';
import { format } from 'date-fns';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#334155' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30, borderBottomWidth: 2, borderBottomColor: '#2563eb', paddingBottom: 20 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  logo: { maxWidth: 140, maxHeight: 50, objectFit: 'contain', marginRight: 15 },
  companyInfo: { flexDirection: 'column' },
  companyName: { fontSize: 20, fontWeight: 'bold', color: '#2563eb', marginBottom: 4 },
  companyDetails: { fontSize: 9, color: '#64748b', marginBottom: 2 },
  docTitle: { fontSize: 28, fontWeight: 'bold', color: '#1e293b', textAlign: 'right' },
  docNumber: { fontSize: 12, color: '#64748b', textAlign: 'right', marginTop: 4 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  metaBlock: { width: '48%' },
  metaHeading: { fontSize: 10, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: 1, marginBottom: 6, fontWeight: 'bold' },
  metaText: { fontSize: 10, marginBottom: 3, color: '#334155' },
  metaName: { fontSize: 12, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 },
  table: { width: '100%', marginBottom: 20 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderBottomWidth: 1, borderBottomColor: '#cbd5e1', padding: 8 },
  th: { fontSize: 9, textTransform: 'uppercase', color: '#475569', fontWeight: 'bold' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', padding: 8 },
  td: { fontSize: 10, color: '#334155' },
  col1: { width: '5%' },
  col2: { width: '40%' },
  col3: { width: '15%' },
  col4: { width: '10%', textAlign: 'right' },
  col5: { width: '15%', textAlign: 'right' },
  col6: { width: '15%', textAlign: 'right' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  bankBlock: { width: '50%' },
  totalsBlock: { width: '40%' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalLabel: { fontSize: 10, color: '#64748b' },
  totalValue: { fontSize: 10, fontWeight: 'bold', textAlign: 'right' },
  grandTotal: { borderTopWidth: 1, borderTopColor: '#2563eb', marginTop: 4, paddingTop: 6 },
  grandTotalText: { fontSize: 12, fontWeight: 'bold', color: '#2563eb' },
  remarks: { marginTop: 20, padding: 10, backgroundColor: '#f8fafc', borderLeftWidth: 2, borderLeftColor: '#2563eb', fontSize: 9 },
  authBlock: { marginTop: 40, alignItems: 'flex-end', position: 'relative' },
  signature: { width: 120, height: 40, objectFit: 'contain', marginBottom: 5 },
  stamp: { width: 80, height: 80, objectFit: 'contain', position: 'absolute', top: -30, right: 40, opacity: 0.6 },
  authLine: { borderTopWidth: 1, borderTopColor: '#cbd5e1', paddingTop: 4, width: 140, textAlign: 'center', fontSize: 9, color: '#64748b' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', color: '#94a3b8', fontSize: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 10 }
});

export const InvoiceDocument = ({ data, templateConfig, customBlocks, itemCodeLabel = "HSN/SAC" }: { data: any, templateConfig?: any[], customBlocks?: any[], itemCodeLabel?: string }) => {
  const { Invoice, Company, Logo, Signature, Stamp, TaxRows, ClientAddress } = data;

  const fixUrl = (url: string) => {
    if (!url) return null;
    if (url.startsWith('/api')) {
      return `http://127.0.0.1:5000${url}`; 
    }
    return url;
  };

  const logoUrl = fixUrl(Logo);
  const stampUrl = fixUrl(Stamp);
  const signatureUrl = fixUrl(Signature);

  const defaultLayout = [
    { id: 'header', visible: true },
    { id: 'meta', visible: true },
    { id: 'table', visible: true },
    { id: 'summary', visible: true },
    { id: 'remarks', visible: true },
    { id: 'auth', visible: true }
  ];
  
  const layout = templateConfig || defaultLayout;

  const renderBlock = (blockId: string) => {
    if (blockId.startsWith('custom_')) {
      const block = customBlocks?.find(b => b.id === blockId);
      if (block && block.html) {
        let htmlContent = block.html;
        // Replace simple tags
        htmlContent = htmlContent.replace(/{{Invoice\.invoice_number}}/g, Invoice?.invoice_number || '');
        htmlContent = htmlContent.replace(/{{Invoice\.issue_date}}/g, Invoice?.issue_date ? format(new Date(Invoice.issue_date), "dd MMM yyyy") : '');
        htmlContent = htmlContent.replace(/{{Invoice\.status}}/g, Invoice?.status || '');
        htmlContent = htmlContent.replace(/{{Invoice\.currency}}/g, Invoice?.currency || 'USD');
        htmlContent = htmlContent.replace(/{{Invoice\.remarks}}/g, Invoice?.remarks || '');
        htmlContent = htmlContent.replace(/{{Company\.company_name}}/g, Company?.company_name || '');
        htmlContent = htmlContent.replace(/{{Company\.address}}/g, Company?.address || '');
        htmlContent = htmlContent.replace(/{{Company\.phone}}/g, Company?.phone || '');
        if (Invoice?.client) {
          htmlContent = htmlContent.replace(/{{Invoice\.client\.company_name}}/g, Invoice.client.company_name || '');
          htmlContent = htmlContent.replace(/{{Invoice\.client\.email}}/g, Invoice.client.email || '');
        }
        return <Html key={blockId}>{htmlContent}</Html>;
      }
      return null;
    }

    switch (blockId) {
      case 'header':
        return (
          <View key="header" style={styles.header}>
            <View style={styles.headerLeft}>
              {logoUrl && <Image src={logoUrl} style={styles.logo} />}
              <View style={styles.companyInfo}>
                <Text style={styles.companyName}>{Company?.company_name || 'Company Name'}</Text>
                {Company?.gstin && <Text style={styles.companyDetails}>GSTIN: {Company.gstin}</Text>}
                {Company?.cin && <Text style={styles.companyDetails}>CIN: {Company.cin}</Text>}
                {Company?.address && <Text style={styles.companyDetails}>{Company.address}</Text>}
                {Company?.phone && <Text style={styles.companyDetails}>Ph: {Company.phone}</Text>}
                {Company?.email && <Text style={styles.companyDetails}>{Company.email}</Text>}
              </View>
            </View>
            <View>
              <Text style={styles.docTitle}>INVOICE</Text>
              <Text style={styles.docNumber}>{Invoice.invoice_number}</Text>
            </View>
          </View>
        );

      case 'meta':
        return (
          <View key="meta" style={styles.metaRow}>
            <View style={styles.metaBlock}>
              <Text style={styles.metaHeading}>Bill To</Text>
              <Text style={styles.metaName}>{Invoice.client.company_name}</Text>
              {Invoice.client.contact_person && <Text style={styles.metaText}>{Invoice.client.contact_person}</Text>}
              {Invoice.client.email && <Text style={styles.metaText}>{Invoice.client.email}</Text>}
              {Invoice.client.phone && <Text style={styles.metaText}>{Invoice.client.phone}</Text>}
              {ClientAddress && <Text style={styles.metaText}>{ClientAddress}</Text>}
              {Invoice.client.tax_id && <Text style={{...styles.metaText, fontWeight: 'bold', marginTop: 4}}>GSTIN: {Invoice.client.tax_id}</Text>}
            </View>
            
            <View style={{...styles.metaBlock, alignItems: 'flex-end'}}>
              <Text style={styles.metaHeading}>Invoice Details</Text>
              <Text style={styles.metaText}><Text style={{fontWeight: 'bold'}}>Date:</Text> {format(new Date(Invoice.issue_date), "dd MMM yyyy")}</Text>
              {Invoice.due_date && <Text style={styles.metaText}><Text style={{fontWeight: 'bold'}}>Due Date:</Text> {format(new Date(Invoice.due_date), "dd MMM yyyy")}</Text>}
              <Text style={styles.metaText}><Text style={{fontWeight: 'bold'}}>Status:</Text> {Invoice.status}</Text>
              <Text style={styles.metaText}><Text style={{fontWeight: 'bold'}}>Currency:</Text> {Invoice.currency || 'INR'}</Text>
            </View>
          </View>
        );

      case 'table':
        return (
          <View key="table" style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, styles.col1]}>#</Text>
              <Text style={[styles.th, styles.col2]}>Description</Text>
              <Text style={[styles.th, styles.col3]}>{itemCodeLabel}</Text>
              <Text style={[styles.th, styles.col4]}>Qty</Text>
              <Text style={[styles.th, styles.col5]}>Rate</Text>
              <Text style={[styles.th, styles.col6]}>Amount</Text>
            </View>
            
            {Invoice.line_items.map((item: any, i: number) => (
              <View key={i} style={styles.tableRow}>
                <Text style={[styles.td, styles.col1]}>{i + 1}</Text>
                <Text style={[styles.td, styles.col2]}>{item.description}</Text>
                <Text style={[styles.td, styles.col3]}>{item.hsn || '-'}</Text>
                <Text style={[styles.td, styles.col4]}>{item.qty}</Text>
                <Text style={[styles.td, styles.col5]}>{Number(item.rate).toFixed(2)}</Text>
                <Text style={[styles.td, styles.col6]}>{Number(item.amount).toFixed(2)}</Text>
              </View>
            ))}
          </View>
        );

      case 'summary':
        return (
          <View key="summary" style={styles.summaryRow}>
            <View style={styles.bankBlock}>
              {Invoice.bank_account && (
                <View>
                  <Text style={styles.metaHeading}>Bank Details</Text>
                  <Text style={styles.metaText}><Text style={{fontWeight: 'bold'}}>Bank:</Text> {Invoice.bank_account.bank_name}</Text>
                  <Text style={styles.metaText}><Text style={{fontWeight: 'bold'}}>A/C No:</Text> {Invoice.bank_account.account_number}</Text>
                  {Invoice.bank_account.ifsc_code && <Text style={styles.metaText}><Text style={{fontWeight: 'bold'}}>IFSC:</Text> {Invoice.bank_account.ifsc_code}</Text>}
                  {Invoice.bank_account.swift_code && <Text style={styles.metaText}><Text style={{fontWeight: 'bold'}}>SWIFT:</Text> {Invoice.bank_account.swift_code}</Text>}
                  {Invoice.bank_account.upi_id && <Text style={styles.metaText}><Text style={{fontWeight: 'bold'}}>UPI:</Text> {Invoice.bank_account.upi_id}</Text>}
                </View>
              )}
            </View>

            <View style={styles.totalsBlock}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>{Number(Invoice.subtotal).toFixed(2)}</Text>
              </View>
              
              {TaxRows && TaxRows.map((row: any, i: number) => (
                <View key={i} style={styles.totalRow}>
                  <Text style={styles.totalLabel}>{row.Label}</Text>
                  <Text style={styles.totalValue}>{row.Amount}</Text>
                </View>
              ))}

              <View style={[styles.totalRow, styles.grandTotal]}>
                <Text style={styles.totalLabel}><Text style={{fontWeight: 'bold'}}>Grand Total ({Invoice.currency || 'INR'})</Text></Text>
                <Text style={styles.grandTotalText}>{Number(Invoice.grand_total).toFixed(2)}</Text>
              </View>
            </View>
          </View>
        );

      case 'remarks':
        if (!Invoice.remarks) return null;
        return (
          <View key="remarks" style={styles.remarks}>
            <Text style={{fontWeight: 'bold', marginBottom: 2}}>Remarks:</Text>
            <Text>{Invoice.remarks}</Text>
          </View>
        );

      case 'auth':
        return (
          <View key="auth" style={styles.authBlock}>
            {stampUrl && <Image src={stampUrl} style={styles.stamp} />}
            {signatureUrl && <Image src={signatureUrl} style={styles.signature} />}
            <Text style={styles.authLine}>Authorized Signatory</Text>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {layout.filter(block => block.visible).map(block => renderBlock(block.id))}
        <Text style={styles.footer} fixed>Generated by InvoiceCore</Text>
      </Page>
    </Document>
  );
};
