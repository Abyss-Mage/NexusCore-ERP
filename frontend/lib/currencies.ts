// frontend/lib/currencies.ts

export interface Currency {
  code: string;
  name: string;
  symbol: string; // The specific symbol (e.g., CA$, AU$)
  locale: string; // For formatting numbers
}

export const AVAILABLE_CURRENCIES: Currency[] = [
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', locale: 'en-IN' },
  { code: 'USD', name: 'US Dollar', symbol: 'US$', locale: 'en-US' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', locale: 'en-CA' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'AU$', locale: 'en-AU' },
  { code: 'EUR', name: 'Euro', symbol: '€', locale: 'de-DE' },
  { code: 'GBP', name: 'British Pound', symbol: '£', locale: 'en-GB' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'SG$', locale: 'en-SG' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED', locale: 'ar-AE' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', locale: 'ja-JP' },
  // Add more as needed
];

export const getCurrencySymbol = (code: string) => {
  return AVAILABLE_CURRENCIES.find((c) => c.code === code)?.symbol || code;
};