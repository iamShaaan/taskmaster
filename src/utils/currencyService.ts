import type { CurrencyCode } from '../types';

const BASE_CURRENCY: CurrencyCode = 'EUR';
const API_URL = `https://api.exchangerate-api.com/v4/latest/${BASE_CURRENCY}`;
const CACHE_KEY = 'taskmaster_exchange_rates';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface ExchangeRates {
    date: string;
    rates: Record<string, number>;
    timestamp: number;
}

export const fetchExchangeRates = async (): Promise<ExchangeRates | null> => {
    try {
        // Check cache
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const parsed: ExchangeRates = JSON.parse(cached);
            const now = Date.now();
            if (now - parsed.timestamp < CACHE_TTL) {
                return parsed;
            }
        }

        // Fetch new rates
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Failed to fetch exchange rates');
        
        const data = await response.json();
        const ratesObj: ExchangeRates = {
            date: data.date,
            rates: data.rates,
            timestamp: Date.now(),
        };

        localStorage.setItem(CACHE_KEY, JSON.stringify(ratesObj));
        return ratesObj;
    } catch (err) {
        console.error('[CurrencyService] Error fetching rates:', err);
        return null;
    }
};

export const convertCurrency = (
    amount: number,
    from: CurrencyCode,
    to: CurrencyCode,
    rates: Record<string, number>
): number => {
    if (from === to) return amount;
    
    // Convert to BASE (EUR) first if 'from' is not BASE
    const amountInBase = from === BASE_CURRENCY ? amount : amount / rates[from];
    
    // Convert from BASE to 'to'
    return to === BASE_CURRENCY ? amountInBase : amountInBase * rates[to];
};

export const getCurrencySymbol = (code: CurrencyCode): string => {
    switch (code) {
        case 'EUR': return '€';
        case 'USD': return '$';
        case 'BDT': return '৳';
        default: return code;
    }
};

export const formatCurrency = (amount: number, code: CurrencyCode): string => {
    const symbol = getCurrencySymbol(code);
    return `${symbol}${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
