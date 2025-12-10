// Formatting utilities

import type { AccountType } from '$lib/data';
import type { SignReversal } from '$lib/stores/settings';

/**
 * Apply sign reversal based on account type and user preferences
 * @param amount Amount in cents (signed)
 * @param accountType Account type
 * @param reversal Sign reversal preferences
 * @returns Amount with sign potentially reversed
 */
export function applySignReversal(
  amount: number,
  accountType: AccountType,
  reversal?: SignReversal
): number {
  if (!reversal) return amount;
  
  if (accountType === 'EQUITY' && reversal.equity) return -amount;
  if (accountType === 'INCOME' && reversal.income) return -amount;
  if (accountType === 'LIABILITY' && reversal.liability) return -amount;
  
  return amount;
}

/**
 * Format a number as currency
 * Amount is stored in smallest unit (cents), so divide by 100
 */
export function formatCurrency(
  amount: number,
  unit: string = 'USD',
  accountType?: AccountType,
  reversal?: SignReversal
): string {
  let displayAmount = amount;
  
  // Apply sign reversal if specified
  if (accountType && reversal) {
    displayAmount = applySignReversal(amount, accountType, reversal);
  }
  
  const value = displayAmount / 100;
  
  // Use Intl.NumberFormat for proper currency formatting
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: unit,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  
  return formatter.format(value);
}

/**
 * Format a date string (ISO format) for display
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a number with commas
 */
export function formatNumber(num: number, decimals: number = 2): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

