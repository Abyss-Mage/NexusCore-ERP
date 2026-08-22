import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#334155' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30, borderBottomWidth: 2, borderBottomColor: '#22c55e', paddingBottom: 20 },
  companyInfo: { flexDirection: 'column' },
  companyName: { fontSize: 20, fontWeight: 'bold', color: '#22c55e', marginBottom: 4 },
  docTitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b', textAlign: 'right' },
  docPeriod: { fontSize: 12, color: '#64748b', textAlign: 'right', marginTop: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  summaryBlock: { width: '30%', padding: 10, backgroundColor: '#f8fafc', borderRadius: 4, borderWidth: 1, borderColor: '#e2e8f0' },
  summaryHeading: { fontSize: 9, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: 1, marginBottom: 4, fontWeight: 'bold' },
  summaryValueIncome: { fontSize: 16, fontWeight: 'bold', color: '#16a34a' },
  summaryValueExpense: { fontSize: 16, fontWeight: 'bold', color: '#dc2626' },
  summaryValueNet: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  table: { width: '100%', marginBottom: 20 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderBottomWidth: 1, borderBottomColor: '#cbd5e1', padding: 8 },
  th: { fontSize: 9, textTransform: 'uppercase', color: '#475569', fontWeight: 'bold' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', padding: 8 },
  td: { fontSize: 10, color: '#334155' },
  colDate: { width: '15%' },
  colDesc: { width: '40%' },
  colRef: { width: '15%' },
  colIncome: { width: '15%', textAlign: 'right', color: '#16a34a' },
  colExpense: { width: '15%', textAlign: 'right', color: '#dc2626' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', color: '#94a3b8', fontSize: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 10 }
});

export const LedgerDocument = ({ data }: { data: any }) => {
  const { transactions, totalIncome, totalExpense, companyName, dateRange, baseCurrencySymbol } = data;

  const netBalance = totalIncome - totalExpense;

  const formatCurrency = (val: number) => {
    return `${baseCurrencySymbol}${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>{companyName}</Text>
            <Text style={{fontSize: 10, color: '#64748b'}}>Financial Ledger</Text>
          </View>
          <View>
            <Text style={styles.docTitle}>Statement</Text>
            <Text style={styles.docPeriod}>{dateRange}</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryBlock}>
            <Text style={styles.summaryHeading}>Total Income</Text>
            <Text style={styles.summaryValueIncome}>{formatCurrency(totalIncome)}</Text>
          </View>
          <View style={styles.summaryBlock}>
            <Text style={styles.summaryHeading}>Total Expense</Text>
            <Text style={styles.summaryValueExpense}>{formatCurrency(totalExpense)}</Text>
          </View>
          <View style={styles.summaryBlock}>
            <Text style={styles.summaryHeading}>Net Balance</Text>
            <Text style={styles.summaryValueNet}>{formatCurrency(netBalance)}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.colDate]}>Date</Text>
            <Text style={[styles.th, styles.colDesc]}>Description</Text>
            <Text style={[styles.th, styles.colRef]}>Ref #</Text>
            <Text style={[styles.th, styles.colIncome]}>Credit (Income)</Text>
            <Text style={[styles.th, styles.colExpense]}>Debit (Expense)</Text>
          </View>

          {transactions.map((t: any, index: number) => (
            <View style={styles.tableRow} key={index}>
              <Text style={[styles.td, styles.colDate]}>{formatDate(t.date)}</Text>
              <Text style={[styles.td, styles.colDesc]}>{t.description || t.type}</Text>
              <Text style={[styles.td, styles.colRef]}>{t.ref || '-'}</Text>
              <Text style={[styles.td, styles.colIncome]}>{t.credit ? formatCurrency(t.credit) : '-'}</Text>
              <Text style={[styles.td, styles.colExpense]}>{t.debit ? formatCurrency(t.debit) : '-'}</Text>
            </View>
          ))}

          {transactions.length === 0 && (
            <View style={[styles.tableRow, { justifyContent: 'center', padding: 20 }]}>
              <Text style={{ color: '#94a3b8' }}>No transactions found for this period.</Text>
            </View>
          )}
        </View>

        <Text style={styles.footer} fixed>
          Generated by InvoiceCore • {new Date().toLocaleDateString('en-GB')}
        </Text>
      </Page>
    </Document>
  );
};
