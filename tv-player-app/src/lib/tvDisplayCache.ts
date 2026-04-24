// ==========================================
// TV Display Cache — Electron app offline data storage
// Persists fetched TV content to localStorage
// Used when internet connection is lost
// ==========================================

import type { TvDisplayData } from '../lib/supabase';

const CACHE_PREFIX = 'tv_display_cache_';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
  data: TvDisplayData;
  timestamp: number;
}

/**
 * Cache TV display data to localStorage
 * @param target Device target (e.g., 'TV1', 'TV2', or 'all')
 * @param data The TV display data to cache
 */
export function cacheTvDisplayData(target: string, data: TvDisplayData): void {
  try {
    const cacheKey = `${CACHE_PREFIX}${target}`;
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(cacheKey, JSON.stringify(entry));
    console.log(`[Cache] Saved TV display data for ${target}`);
  } catch (err) {
    console.warn('[Cache] Failed to save TV display data:', err);
  }
}

/**
 * Retrieve cached TV display data from localStorage
 * @param target Device target (e.g., 'TV1', 'TV2', or 'all')
 * @returns Cached data or null if not found or expired
 */
export function getCachedTvDisplayData(target: string): TvDisplayData | null {
  try {
    const cacheKey = `${CACHE_PREFIX}${target}`;
    const stored = localStorage.getItem(cacheKey);
    if (!stored) {
      console.log(`[Cache] No cached data found for ${target}`);
      return null;
    }

    const entry: CacheEntry = JSON.parse(stored);
    const age = Date.now() - entry.timestamp;

    if (age > CACHE_EXPIRY_MS) {
      console.log(`[Cache] Cached data for ${target} expired (${Math.round(age / 1000)}s old)`);
      localStorage.removeItem(cacheKey);
      return null;
    }

    console.log(`[Cache] Using cached data for ${target} (${Math.round(age / 1000)}s old)`);
    return entry.data;
  } catch (err) {
    console.warn('[Cache] Failed to retrieve cached data:', err);
    return null;
  }
}

/**
 * Clear cached TV display data
 * @param target Optional device target. If omitted, clears all TV caches.
 */
export function clearTvDisplayCache(target?: string): void {
  try {
    if (target) {
      const cacheKey = `${CACHE_PREFIX}${target}`;
      localStorage.removeItem(cacheKey);
      console.log(`[Cache] Cleared cache for ${target}`);
    } else {
      // Clear all TV display caches
      const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
      keys.forEach(k => localStorage.removeItem(k));
      console.log(`[Cache] Cleared all TV display caches (${keys.length} entries)`);
    }
  } catch (err) {
    console.warn('[Cache] Failed to clear cache:', err);
  }
}

/**
 * Check if cached data exists for a target
 */
export function hasCachedTvDisplayData(target: string): boolean {
  try {
    const cacheKey = `${CACHE_PREFIX}${target}`;
    const stored = localStorage.getItem(cacheKey);
    if (!stored) return false;

    const entry: CacheEntry = JSON.parse(stored);
    const age = Date.now() - entry.timestamp;
    return age <= CACHE_EXPIRY_MS;
  } catch {
    return false;
  }
}
