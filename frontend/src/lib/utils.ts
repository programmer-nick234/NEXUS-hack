import { clsx, type ClassValue } from "clsx";

/**
 * Merge Tailwind classes safely (no conflicts, deduplication).
 * Uses clsx for conditional classes.
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/**
 * Check if code is running on the client.
 */
export const isClient = typeof window !== "undefined";

/**
 * Check if user prefers reduced motion.
 */
export function prefersReducedMotion(): boolean {
  if (!isClient) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Debounce utility.
 */
export function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

/**
 * Format a date string to a readable locale string.
 */
export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
