/**
 * Currency utilities for USD <-> token conversion.
 * FLUSD is treated as a 1:1 USD-pegged token in this demo.
 */

// 1 FLUSD = 1 USD
const FLUSD_USD_RATE = 1;

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
 * Returns the FLUSD/USD exchange rate.
 */
export function getMockExchangeRate(): number {
  return FLUSD_USD_RATE;
}

/**
 * Calculate the token amount for a given USD total using the pegged rate.
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