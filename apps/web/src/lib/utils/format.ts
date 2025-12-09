// Formatting utilities

/**
 * Format a number as currency
 * Amount is stored in smallest unit (cents), so divide by 100
 */
export function formatCurrency(amount: number, unit: string = 'USD'): string {
  const value = amount / 100;
  
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

