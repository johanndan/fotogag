// /src/utils/format-date.ts
import "server-only";

/**
 * Format a date into a human-readable string (stable: UTC + fixed locale)
 * Example: "Jan 01, 2023"
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(d);
}

/**
 * Format a date with time into a human-readable string (stable: UTC + fixed locale)
 * Example: "Jan 01, 2023, 03:30 PM"
 */
export function formatDateTime(date: Date | number | string): string {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}
