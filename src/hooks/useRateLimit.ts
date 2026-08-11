'use client';

import { useState, useCallback, useRef } from 'react';

export interface RateLimitState {
  isQueued: boolean;
  queuePosition: number;
  estimatedWaitMs: number;
  message?: string;
}

interface UseRateLimitReturn {
  rateLimitState: RateLimitState | null;
  /** Wrap a fetch call with rate-limit detection */
  withRateLimitHandling: <T>(fn: () => Promise<T>) => Promise<T | null>;
  /** Manually clear the rate-limit overlay */
  clearRateLimit: () => void;
  /** Retry the last queued action */
  retry: () => void;
}

/**
 * useRateLimit — Hook for admin pages.
 *
 * Detects 429 responses from the server and sets rateLimitState,
 * which the page should use to render the <RateLimitQueue /> overlay.
 *
 * Usage:
 *   const { rateLimitState, withRateLimitHandling, clearRateLimit, retry } = useRateLimit();
 *
 *   // Wrap API calls:
 *   const result = await withRateLimitHandling(() => apiClient.get('/teachers'));
 *
 *   // Render overlay when queued:
 *   {rateLimitState && (
 *     <RateLimitQueue
 *       queuePosition={rateLimitState.queuePosition}
 *       estimatedWaitMs={rateLimitState.estimatedWaitMs}
 *       onRetry={retry}
 *     />
 *   )}
 */
export function useRateLimit(): UseRateLimitReturn {
  const [rateLimitState, setRateLimitState] = useState<RateLimitState | null>(null);
  const lastActionRef = useRef<(() => Promise<unknown>) | null>(null);

  const clearRateLimit = useCallback(() => {
    setRateLimitState(null);
  }, []);

  const withRateLimitHandling = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T | null> => {
      lastActionRef.current = fn as () => Promise<unknown>;

      try {
        const result = await fn();
        // Clear any existing rate-limit state on success
        setRateLimitState(null);
        return result;
      } catch (error: unknown) {
        // Detect rate-limit errors surfaced by the service layer
        if (isRateLimitError(error)) {
          setRateLimitState({
            isQueued: true,
            queuePosition: error.queuePosition ?? 1,
            estimatedWaitMs: error.estimatedWaitMs ?? 10000,
            message: error.message,
          });
          return null;
        }
        throw error;
      }
    },
    [],
  );

  const retry = useCallback(async () => {
    if (!lastActionRef.current) {
      clearRateLimit();
      return;
    }
    clearRateLimit();
    // Small delay before retrying
    await new Promise((r) => setTimeout(r, 500));
    const fn = lastActionRef.current;
    try {
      await fn();
    } catch {
      // Swallow — calling code should handle errors separately
    }
  }, [clearRateLimit]);

  return { rateLimitState, withRateLimitHandling, clearRateLimit, retry };
}

// ── Rate-limit error detection ────────────────────────────

interface RateLimitError extends Error {
  rateLimited?: boolean;
  queuePosition?: number;
  estimatedWaitMs?: number;
}

function isRateLimitError(error: unknown): error is RateLimitError {
  if (!error || typeof error !== 'object') return false;
  const e = error as RateLimitError;
  return e.rateLimited === true;
}

/**
 * createRateLimitError — helper to create a rate-limit error from a 429 response body.
 */
export function createRateLimitError(body: {
  error?: string;
  queuePosition?: number;
  estimatedWaitMs?: number;
}): RateLimitError {
  const err = new Error(body.error ?? 'Too many requests') as RateLimitError;
  err.rateLimited = true;
  err.queuePosition = body.queuePosition ?? 1;
  err.estimatedWaitMs = body.estimatedWaitMs ?? 10000;
  return err;
}
