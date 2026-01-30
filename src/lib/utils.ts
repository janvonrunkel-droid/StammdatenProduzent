import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Escape special characters in PostgREST filter values to prevent filter injection.
 * BUG-SEC-1 Fix: Sanitize search parameters before using in ilike filters.
 */
export function escapePostgrestValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/,/g, '\\,')    // Escape commas (used as OR separator)
    .replace(/\./g, '\\.')   // Escape dots (used as operator separator)
    .replace(/\(/g, '\\(')   // Escape parentheses
    .replace(/\)/g, '\\)')
    .replace(/%/g, '\\%')    // Escape percent (wildcard)
    .replace(/_/g, '\\_')    // Escape underscore (single char wildcard)
}
