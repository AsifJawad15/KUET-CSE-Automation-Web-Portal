// ==========================================
// Rate Limiter — Admin API Protection
// Strategy: Sliding-window + concurrent request queue
// Limit: 15 concurrent active requests per client key
// Queue: Excess requests wait until a slot frees up
// ==========================================

const MAX_CONCURRENT = 15;
const QUEUE_TIMEOUT_MS = 60_000; // 1 minute max wait
const CLEANUP_INTERVAL_MS = 5 * 60_000; // every 5 min

export interface RateLimitResult {
  allowed: boolean;
  /**  Active slot handle — call release() when the request finishes */
  release?: () => void;
  /** Position in queue (1-based), undefined if immediately allowed */
  queuePosition?: number;
  /** Estimated wait time in ms */
  estimatedWaitMs?: number;
  /** Human-friendly retry message */
  retryMessage?: string;
}

interface ClientState {
  active: number;
  queue: Array<{
    resolve: (value: boolean) => void;
    timer: ReturnType<typeof setTimeout>;
    enqueuedAt: number;
  }>;
  lastActivity: number;
}

// Global map: clientKey → ClientState
const clients = new Map<string, ClientState>();

// ── Helpers ──────────────────────────────────────────────

function getOrCreate(key: string): ClientState {
  let state = clients.get(key);
  if (!state) {
    state = { active: 0, queue: [], lastActivity: Date.now() };
    clients.set(key, state);
  }
  state.lastActivity = Date.now();
  return state;
}

/** Try to promote the next waiting request in the queue */
function drainQueue(key: string): void {
  const state = clients.get(key);
  if (!state) return;

  while (state.queue.length > 0 && state.active < MAX_CONCURRENT) {
    const next = state.queue.shift()!;
    clearTimeout(next.timer);
    state.active++;
    next.resolve(true);
  }
}

/** Release one active slot and drain the queue */
function releaseSlot(key: string): void {
  const state = clients.get(key);
  if (!state) return;

  state.active = Math.max(0, state.active - 1);
  drainQueue(key);
}

// ── Periodic cleanup ─────────────────────────────────────

setInterval(() => {
  const now = Date.now();
  for (const [key, state] of clients.entries()) {
    // Remove idle entries (no queue, no active requests, idle > 10 min)
    if (state.active === 0 && state.queue.length === 0 && now - state.lastActivity > 10 * 60_000) {
      clients.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

// ── Public API ────────────────────────────────────────────

/**
 * Attempt to acquire a rate-limit slot for the given client key.
 *
 * If a slot is free:          resolves immediately with { allowed: true, release }
 * If all slots are busy:      waits in queue up to QUEUE_TIMEOUT_MS, then resolves
 *                             with { allowed: false } if timed out.
 */
export async function acquireSlot(clientKey: string): Promise<RateLimitResult> {
  const state = getOrCreate(clientKey);

  // ── Fast path: slot available ─────────────────────────
  if (state.active < MAX_CONCURRENT) {
    state.active++;
    return {
      allowed: true,
      release: () => releaseSlot(clientKey),
    };
  }

  // ── Slow path: join the queue ────────────────────────
  const queuePosition = state.queue.length + 1;
  // Rough estimate: each request takes ~2 s on average (conservative)
  const estimatedWaitMs = queuePosition * 2000;

  const waitResult = await new Promise<boolean>((resolve) => {
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      // Remove ourselves from the queue
      const idx = state.queue.findIndex((item) => item.resolve === resolve);
      if (idx !== -1) state.queue.splice(idx, 1);
      resolve(false);
    }, QUEUE_TIMEOUT_MS);

    state.queue.push({
      resolve,
      timer,
      enqueuedAt: Date.now(),
    });

    void timedOut; // suppress unused-var lint
  });

  if (!waitResult) {
    return {
      allowed: false,
      queuePosition,
      estimatedWaitMs: QUEUE_TIMEOUT_MS,
      retryMessage: 'Request timed out waiting in queue. Please try again.',
    };
  }

  return {
    allowed: true,
    release: () => releaseSlot(clientKey),
  };
}

/**
 * Returns current stats for a client (for debugging / response headers).
 */
export function getClientStats(clientKey: string): {
  active: number;
  queued: number;
  limit: number;
} {
  const state = clients.get(clientKey);
  return {
    active: state?.active ?? 0,
    queued: state?.queue.length ?? 0,
    limit: MAX_CONCURRENT,
  };
}

/**
 * Derive a stable client key from a Next.js request.
 * Uses X-Forwarded-For → X-Real-IP → socket IP.
 */
export function getClientKey(request: { headers: { get(name: string): string | null } }): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  return 'unknown';
}
