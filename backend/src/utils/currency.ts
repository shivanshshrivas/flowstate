/**
 * Currency utilities for USD <-> token conversion.
 * Exchange rates are mocked until a real oracle/feed is wired in.
 */

// Mock exchange rate: 1 XRP = 0.50 USD → 1 USD = 2 XRP tokens
const MOCK_USD_PER_TOKEN = 0.5;

/**
 * Convert a USD amount to token units (18-decimal string).
 */
export function usdToToken(amountUsd: number, exchangeRate: number): string {
  if (exchangeRate <= 0) throw new Error("Exchange rate must be positive");
  return (amountUsd / exchangeRate).toFixed(18);
}

/**
 * Convert token units back to USD.
 */
export function tokenToUsd(tokenAmount: string, exchangeRate: number): number {
  return parseFloat(tokenAmount) * exchangeRate;
}

/**
 * Returns a mock exchange rate (USD per token).
 * Replace with real oracle call when available.
 */
export function getMockExchangeRate(): number {
  return MOCK_USD_PER_TOKEN;
}

/**
 * Calculate the token amount for a given USD total using the mock rate.
 */
export function convertOrderTotal(totalUsd: number): {
  escrowAmountToken: string;
  exchangeRate: number;
} {
  const exchangeRate = getMockExchangeRate();
  const escrowAmountToken = usdToToken(totalUsd, exchangeRate);
  return { escrowAmountToken, exchangeRate };
}

/**
 * Calculate a partial token payout from a basis-point percentage.
 */
export function bpsOfToken(totalToken: string, bps: number): string {
  const total = parseFloat(totalToken);
  return ((total * bps) / 10000).toFixed(18);
}
