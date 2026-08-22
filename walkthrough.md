# Financial Intelligence Suite: Double-Entry Ledger, Real-Time P&L, Balance Sheet, GSTR-1 Govt JSON & Live FX Engine

## Summary of Accomplishments

### 1. Double-Entry General Ledger & Chart of Accounts (COA)
- **Database Schema**:
  - `Account` (`code`, `name`, `type: ASSET | LIABILITY | EQUITY | REVENUE | EXPENSE`, `is_system`).
  - `JournalEntry` (`entry_number`, `date`, `reference_type`, `reference_id`, `description`, `business_unit_id`, `currency`).
  - `JournalLine` (`journal_entry_id`, `account_code`, `debit`, `credit`, `description`).
- **Standard 5-Tier Chart of Accounts Seed**:
  - **1000s Assets**: 1010 Cash & Bank, 1020 Accounts Receivable, 1030 Filament & Material Stock, 1040 3D Printers & Hardware Equipment.
  - **2000s Liabilities**: 2010 Accounts Payable, 2020 GST/Tax Payable, 2030 Client Retainer Advances.
  - **3000s Equity**: 3010 Owner's Capital, 3020 Retained Earnings (Cumulative Net Profit).
  - **4000s Revenue**: 4010 Software & Retainer Income, 4020 3D Print Farm Revenue, 4030 E-Commerce & Retail Sales, 4040 Other Income.
  - **5000s Expenses**: 5010 Cloud Infrastructure, 5020 Raw Materials/Filament, 5030 SaaS Subscriptions, 5040 Office & Utilities, 5050 Gateway Fees, 5060 Shipping & Packaging.
- **Automated Double-Entry Posting**:
  - Automatically posts balancing journal entries upon invoice creation (`Debit AR 1020`, `Credit Revenue 4010/4020`, `Credit Tax Payable 2020`).
  - Posts payment reconciliations upon marking as PAID (`Debit Cash & Bank 1010`, `Credit AR 1020`).
  - Posts expense transactions (`Debit Expense 5010-5060`, `Credit Cash 1010`).
  - Built-in `RebuildAllJournals` handler (`POST /api/financials/rebuild-journals`) to sync past records.

---

### 2. Real-Time Financial Statements Engine
- **Profit & Loss Statement (Income Statement)** (`GET /api/financials/profit-loss`):
  - Operating Revenue streams.
  - Cost of Goods Sold (COGS) with direct 3D printing & shipping breakdown.
  - Gross Profit & Gross Margin % calculation.
  - Operating & Administrative Expenses breakdown.
  - Net Operating Income (EBITDA) & Net Profit Margin % calculation.
- **Balance Sheet (Statement of Financial Position)** (`GET /api/financials/balance-sheet`):
  - Current Assets + Fixed Hardware Assets $\rightarrow$ Total Assets.
  - Current Liabilities + Owner Equity + Cumulative Retained Earnings $\rightarrow$ Total Liabilities & Equity.
  - Real-time Balance Check (`Total Assets == Total Liabilities + Total Equity`).
- **Trial Balance Engine** (`GET /api/financials/trial-balance`):
  - Double-entry verification with Closing Debit / Credit balances per account.
  - Verification badge confirming total debits equal total credits.

---

### 3. GSTR-1 Government-Compatible JSON & Tax Compliance
- **Official Offline Portal JSON Format** (`GET /api/reports/gst/export-govt-json`):
  - Full Indian GST offline tool compatibility (`gstin`, `fp` `MMYYYY`, `version: "GSTR1_V2.0"`).
  - Grouped B2B recipients (`ctin`, `inv` array with `inum`, `idt`, `val`, `pos`, `rchrg`, `inv_typ`, `itms: [{num, itm_det: {txval, rt, iamt, camt, samt}}]`).
  - Table 12 HSN/SAC summary (`hsn_sc`, `desc`, `uqc`, `qty`, `val`, `txval`, `iamt`, `camt`, `samt`).
- **1-Click Download in UI**: Added "Download Official GSTR-1 JSON" directly into `/reports/gst`.

---

### 4. Live Multi-Currency FX Sync Engine
- **Open Exchange API Integration**:
  - Live rates fetched from open market API for USD, INR, EUR, GBP, AED, CAD, AUD, SGD.
  - Dual Base caching (USD-Base and domestic INR-Base for Indian tax & bookkeeping).
  - Background ticker refreshing rates every 24 hours.
  - Manual override support (`POST /api/fx/override`).
  - **Live FX Rates Ticker Widget** on Financials page with 1-click live sync.

---

### 5. Frontend Financial Reporting Suite (`/reports/financials`)
- Interactive dashboard with period selector presets (`This Month`, `Last Month`, `Year to Date`, `All Time`) and custom date ranges.
- Multi-company workspace integration (`useBusiness()`).
- High-level KPI cards for Revenue, COGS, Gross Profit, Expenses, and Net Operating Income.
- 4 comprehensive tabs:
  1. **Profit & Loss Statement**
  2. **Balance Sheet**
  3. **Trial Balance Audit**
  4. **Chart of Accounts Directory**
- Integrated into the Sidebar navigation under **Administration $\rightarrow$ P&L & Balance Sheet**.

---

## Deployment Instructions for VM

Run the following on the VM:
```bash
cd /opt/nexus-erp
git pull origin main
docker compose up -d --build
```
