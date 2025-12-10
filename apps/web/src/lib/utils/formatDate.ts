/**
 * Date Formatting Utilities
 * 
 * Format dates according to user preference
 */

import type { DateFormat } from '$lib/stores/settings';

/**
 * Format a date string according to user preference
 * @param dateStr - ISO date string (YYYY-MM-DD)
 * @param format - Date format preference
 * @returns Formatted date string
 */
export function formatDate(dateStr: string, format: DateFormat = 'US'): string {
  if (!dateStr) return '';
  
  const [year, month, day] = dateStr.split('-');
  
  switch (format) {
    case 'US':
      return `${month}/${day}/${year}`;
    case 'EU':
      return `${day}/${month}/${year}`;
    case 'ISO':
      return dateStr; // Already in ISO format
    default:
      return dateStr;
  }
}

/**
 * Format a Date object according to user preference
 * @param date - JavaScript Date object
 * @param format - Date format preference
 * @returns Formatted date string
 */
export function formatDateObject(date: Date, format: DateFormat = 'US'): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  switch (format) {
    case 'US':
      return `${month}/${day}/${year}`;
    case 'EU':
      return `${day}/${month}/${year}`;
    case 'ISO':
      return `${year}-${month}-${day}`;
    default:
      return `${month}/${day}/${year}`;
  }
}

/**
 * Get a preview string for the date format
 * @param format - Date format preference
 * @returns Example date in that format
 */
export function getDateFormatPreview(format: DateFormat): string {
  const today = new Date();
  return formatDateObject(today, format);
}

