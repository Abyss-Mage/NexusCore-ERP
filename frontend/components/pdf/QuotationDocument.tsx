import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { format } from 'date-fns';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#334155' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30, borderBottomWidth: 2, borderBottomColor: '#7c3aed', paddingBottom: 20 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  logo: { maxWidth: 140, maxHeight: 50, objectFit: 'contain', marginRight: 15 },
  companyInfo: { flexDirection: 'column' },
  companyName: { fontSize: 20, fontWeight: 'bold', color: '#7c3aed', marginBottom: 4 },
  companyDetails: { fontSize: 9, color: '#64748b', marginBottom: 2 },
  docTitle: { fontSize: 28, fontWeight: 'bold', color: '#1e293b', textAlign: 'right' },
  docNumber: { fontSize: 12, color: '#64748b', textAlign: 'right', marginTop: 4 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  metaBlock: { width: '48%' },
  metaHeading: { fontSize: 10, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: 1, marginBottom: 6, fontWeight: 'bold' },
  metaText: { fontSize: 10, marginBottom: 3, color: '#334155' },
  metaName: { fontSize: 12, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 },
  table: { width: '100%', marginBottom: 20 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f5f3ff', borderBottomWidth: 1, borderBottomColor: '#e9e5f5', padding: 8 },
  th: { fontSize: 9, textTransform: 'uppercase', color: '#6d28d9', fontWeight: 'bold' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f5f3ff', padding: 8 },
  td: { fontSize: 10, color: '#334155' },
  col1: { width: '5%' },
  col2: { width: '50%' },
  col4: { width: '15%', textAlign: 'right' },
  col5: { width: '15%', textAlign: 'right' },
  col6: { width: '15%', textAlign: 'right' },
  summaryRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  totalsBlock: { width: '40%' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalLabel: { fontSize: 10, color: '#64748b' },
  totalValue: { fontSize: 10, fontWeight: 'bold', textAlign: 'right' },
  grandTotal: { borderTopWidth: 1, borderTopColor: '#7c3aed', marginTop: 4, paddingTop: 6 },
  grandTotalText: { fontSize: 12, fontWeight: 'bold', color: '#7c3aed' },
  sectionBox: { marginTop: 20, padding: 12, backgroundColor: '#faf8ff', borderLeftWidth: 2, borderLeftColor: '#7c3aed' },
  sectionHeading: { fontSize: 11, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 },
  sectionText: { fontSize: 9, color: '#475569' },
  authBlock: { marginTop: 40, alignItems: 'flex-end', position: 'relative' },
  signature: { width: 120, height: 40, objectFit: 'contain', marginBottom: 5 },
  stamp: { width: 80, height: 80, objectFit: 'contain', position: 'absolute', top: -30, right: 40, opacity: 0.6 },
  authLine: { borderTopWidth: 1, borderTopColor: '#cbd5e1', paddingTop: 4, width: 140, textAlign: 'center', fontSize: 9, color: '#64748b' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', color: '#94a3b8', fontSize: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 10 }
});

export const QuotationDocument = ({ data, itemCodeLabel = "HSN/SAC" }: { data: any, itemCodeLabel?: string }) => {
  const { Quotation, Company, Logo, Signature, Stamp, ClientAddress } = data;

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

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        
        {/* Header */}
        <View style={styles.header}>
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
            <Text style={styles.docTitle}>QUOTATION</Text>
            <Text style={styles.docNumber}>{Quotation.quotation_number}</Text>
          </View>
        </View>

        {/* Meta Info */}
        <View style={styles.metaRow}>
          <View style={styles.metaBlock}>
            <Text style={styles.metaHeading}>Prepared For</Text>
            <Text style={styles.metaName}>{Quotation.client.company_name}</Text>
            {Quotation.client.contact_person && <Text style={styles.metaText}>{Quotation.client.contact_person}</Text>}
            {Quotation.client.email && <Text style={styles.metaText}>{Quotation.client.email}</Text>}
            {Quotation.client.phone && <Text style={styles.metaText}>{Quotation.client.phone}</Text>}
            {ClientAddress && <Text style={styles.metaText}>{ClientAddress}</Text>}
          </View>
          
          <View style={{...styles.metaBlock, alignItems: 'flex-end'}}>
            <Text style={styles.metaHeading}>Quotation Details</Text>
            <Text style={styles.metaText}><Text style={{fontWeight: 'bold'}}>Date:</Text> {format(new Date(Quotation.issue_date), "dd MMM yyyy")}</Text>
            {Quotation.expiry_date && <Text style={styles.metaText}><Text style={{fontWeight: 'bold'}}>Valid Until:</Text> {format(new Date(Quotation.expiry_date), "dd MMM yyyy")}</Text>}
            <Text style={styles.metaText}><Text style={{fontWeight: 'bold'}}>Status:</Text> {Quotation.status}</Text>
            <Text style={styles.metaText}><Text style={{fontWeight: 'bold'}}>Currency:</Text> {Quotation.currency || 'INR'}</Text>
          </View>
        </View>

        {/* Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.col1]}>#</Text>
            <Text style={[styles.th, styles.col2]}>Description</Text>
            <Text style={[styles.th, styles.col4]}>Qty</Text>
            <Text style={[styles.th, styles.col5]}>Rate</Text>
            <Text style={[styles.th, styles.col6]}>Amount</Text>
          </View>
          
          {Quotation.line_items.map((item: any, i: number) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.td, styles.col1]}>{i + 1}</Text>
              <Text style={[styles.td, styles.col2]}>{item.description}</Text>
              <Text style={[styles.td, styles.col4]}>{item.qty}</Text>
              <Text style={[styles.td, styles.col5]}>{Number(item.rate).toFixed(2)}</Text>
              <Text style={[styles.td, styles.col6]}>{Number(item.amount).toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* Summary Area */}
        <View style={styles.summaryRow}>
          <View style={styles.totalsBlock}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>{Number(Quotation.subtotal).toFixed(2)}</Text>
            </View>
            
            <View style={[styles.totalRow, styles.grandTotal]}>
              <Text style={styles.totalLabel}><Text style={{fontWeight: 'bold'}}>Total ({Quotation.currency || 'INR'})</Text></Text>
              <Text style={styles.grandTotalText}>{Number(Quotation.grand_total).toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {Quotation.services_offered && (
          <View style={styles.sectionBox}>
            <Text style={styles.sectionHeading}>Services Offered</Text>
            <Text style={styles.sectionText}>{Quotation.services_offered}</Text>
          </View>
        )}

        {Quotation.contract_terms && (
          <View style={styles.sectionBox}>
            <Text style={styles.sectionHeading}>Terms & Conditions</Text>
            <Text style={styles.sectionText}>{Quotation.contract_terms}</Text>
          </View>
        )}

        {Quotation.remarks && (
          <View style={styles.sectionBox}>
            <Text style={styles.sectionHeading}>Remarks</Text>
            <Text style={styles.sectionText}>{Quotation.remarks}</Text>
          </View>
        )}

        <View style={styles.authBlock}>
          {stampUrl && <Image src={stampUrl} style={styles.stamp} />}
          {signatureUrl && <Image src={signatureUrl} style={styles.signature} />}
          <Text style={styles.authLine}>Authorized Signatory</Text>
        </View>

        <Text style={styles.footer} fixed>Generated by InvoiceCore</Text>
      </Page>
    </Document>
  );
};
