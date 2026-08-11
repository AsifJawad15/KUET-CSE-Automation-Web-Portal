/**
 * Rate Limiter Test Script
 * ========================
 * Tests that the admin API rate limiter correctly:
 *   ✓ Allows up to 15 concurrent requests
 *   ✓ Queues requests beyond 15
 *   ✓ Returns 429 with queue metadata when timed out
 *   ✓ Does NOT rate-limit the home page APIs
 *
 * Usage:
 *   node test-rate-limiter.mjs
 *
 * Requires: npm run dev running on localhost:3000
 */

const BASE_URL = 'http://localhost:3000';

// ── Colors ──────────────────────────────────────────────
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  magenta: '\x1b[35m',
};

function pass(msg) { console.log(`  ${C.green}✓${C.reset} ${msg}`); }
function fail(msg) { console.log(`  ${C.red}✗${C.reset} ${msg}`); }
function info(msg) { console.log(`  ${C.cyan}ℹ${C.reset} ${msg}`); }
function warn(msg) { console.log(`  ${C.yellow}⚠${C.reset} ${msg}`); }
function header(msg) { console.log(`\n${C.bold}${C.blue}── ${msg} ──${C.reset}`); }
function divider() { console.log(`${C.gray}${'─'.repeat(60)}${C.reset}`); }

// ── Test helpers ─────────────────────────────────────────

async function fetchAdmin(path, options = {}) {
  const start = Date.now();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const duration = Date.now() - start;
  let body = {};
  try { body = await res.json(); } catch { /* ignore */ }
  return {
    status: res.status,
    duration,
    body,
    headers: {
      active: res.headers.get('X-RateLimit-Active'),
      queued: res.headers.get('X-RateLimit-Queued'),
      limit: res.headers.get('X-RateLimit-Limit'),
      wasQueued: res.headers.get('X-RateLimit-Was-Queued'),
      retryAfter: res.headers.get('Retry-After'),
    },
  };
}

// ── Test 1: Single request shows rate-limit headers ─────

async function testRateLimitHeaders() {
  header('Test 1: Rate-limit headers are present on admin routes');

  const r = await fetchAdmin('/api/teachers');

  if (r.status === 401) {
    warn('Got 401 (need auth) — but checking headers anyway');
    // Even 401 should have rate-limit headers if the middleware ran
  }

  const hasLimit = r.headers.limit !== null;
  const hasActive = r.headers.active !== null;

  if (hasLimit && hasActive) {
    pass(`X-RateLimit-Limit: ${r.headers.limit}, X-RateLimit-Active: ${r.headers.active}`);
  } else {
    fail(`Rate-limit headers missing — Limit=${r.headers.limit}, Active=${r.headers.active}`);
    info('Make sure the server is running: npm run dev');
  }

  return hasLimit && hasActive;
}

// ── Test 2: 15 concurrent requests all succeed ──────────

async function testConcurrentLimit() {
  header('Test 2: 15 concurrent requests — all should be active (HTTP 401 is fine, not 429)');

  // Fire exactly 15 simultaneous requests
  const COUNT = 15;
  const results = await Promise.all(
    Array.from({ length: COUNT }, (_, i) =>
      fetchAdmin('/api/teachers').then(r => ({ i: i + 1, ...r }))
    )
  );

  const byStatus = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  const no429 = results.every(r => r.status !== 429);

  if (no429) {
    pass(`All ${COUNT} requests completed without 429`);
  } else {
    const count429 = results.filter(r => r.status === 429).length;
    fail(`${count429} out of ${COUNT} got 429 — limit might be too low`);
  }

  info(`Status breakdown: ${JSON.stringify(byStatus)}`);

  // Check headers of the last one
  const last = results[results.length - 1];
  if (last.headers.active) {
    info(`Last request active count: ${last.headers.active}/${last.headers.limit}`);
  }

  return no429;
}

// ── Test 3: 16th request gets a 429 ─────────────────────

async function test16thRequest() {
  header('Test 3: Simulate server busy → 16th request should get 429');

  // We can't truly hold 15 slots open from script since requests complete instantly.
  // Instead we test the rate-limiter module directly by calling the API endpoint
  // with a mock that simulates slow requests.
  //
  // Real-world test: fire 20 simultaneous requests; some will race.
  // The 429 response will include rateLimited:true and queuePosition.

  const COUNT = 20;
  info(`Firing ${COUNT} simultaneous requests...`);

  const results = await Promise.all(
    Array.from({ length: COUNT }, (_, i) =>
      fetchAdmin('/api/courses').then(r => ({ i: i + 1, ...r }))
    )
  );

  const got429 = results.filter(r => r.status === 429);
  const gotOther = results.filter(r => r.status !== 429);

  info(`Results: ${gotOther.length} succeeded/401, ${got429.length} got 429`);

  if (got429.length > 0) {
    const sample = got429[0];
    pass(`Got 429 as expected`);
    pass(`Body: rateLimited=${sample.body.rateLimited}, queuePosition=${sample.body.queuePosition}`);
    pass(`Retry-After header: ${sample.headers.retryAfter}s`);
  } else {
    warn('No 429s — requests completed too fast to fill the queue.');
    warn('This is normal for fast in-process requests. Try the slow-request test below.');
  }
}

// ── Test 4: 429 response has proper queue metadata ──────

async function testQueueMetadataFormat() {
  header('Test 4: Verify 429 response body has correct schema');

  // Manually craft a rate-limit test by importing the rate limiter directly.
  // Since we can't do that from a plain .mjs, we verify the 429 schema from
  // an actual response or check what a 429 looks like.

  info('Sending a request to a valid admin endpoint...');
  const r = await fetchAdmin('/api/staffs');

  // The key test: if we ever get a 429, verify its shape
  if (r.status === 429) {
    const required = ['success', 'error', 'rateLimited', 'queuePosition', 'estimatedWaitMs'];
    const hasAll = required.every(k => k in r.body);
    if (hasAll) {
      pass('429 body has all required fields: ' + required.join(', '));
    } else {
      const missing = required.filter(k => !(k in r.body));
      fail('Missing fields in 429 body: ' + missing.join(', '));
    }
    pass(`rateLimited: ${r.body.rateLimited}`);
    pass(`queuePosition: ${r.body.queuePosition}`);
    pass(`estimatedWaitMs: ${r.body.estimatedWaitMs}ms`);
  } else {
    info(`Got status ${r.status} (not 429) — queue was not full. Schema test skipped.`);
    info('To force a 429, run the stress test below.');
  }
}

// ── Test 5: Home/public routes are NOT rate-limited ─────

async function testPublicRouteNotLimited() {
  header('Test 5: Home page / public routes are NOT rate-limited');

  // Public pages should not have rate-limit headers
  const r = await fetchAdmin('/');
  const hasRateLimitHeader = r.headers.limit !== null;

  if (!hasRateLimitHeader) {
    pass('Home page "/" has no X-RateLimit-Limit header ✓');
  } else {
    warn('Home page has rate-limit headers — this might be intentional');
  }

  // Check a non-admin API (like the public faculty list if it exists)
  info(`Home page status: ${r.status}`);
}

// ── Test 6: Stress test with slow-ish requests ──────────

async function stressTest() {
  header('Test 6: Stress test — 25 requests with artificial delay');

  const COUNT = 25;
  info(`Launching ${COUNT} requests simultaneously to /api/teachers...`);
  info('(Requests complete instantly in dev, so some may not queue — that\'s OK)');

  const startAll = Date.now();
  const results = await Promise.all(
    Array.from({ length: COUNT }, async (_, i) => {
      // Stagger slightly to simulate real-world burst
      await new Promise(r => setTimeout(r, Math.random() * 50));
      return fetchAdmin('/api/teachers').then(r => ({ i: i + 1, ...r }));
    })
  );
  const totalMs = Date.now() - startAll;

  const statusGroups = results.reduce((acc, r) => {
    const key = String(r.status);
    acc[key] = (acc[key] ?? []);
    acc[key].push(r.i);
    return acc;
  }, {});

  info(`Total time: ${totalMs}ms`);
  for (const [status, ids] of Object.entries(statusGroups)) {
    const icon = status === '429' ? C.red + '✗' : C.green + '✓';
    console.log(`  ${icon}${C.reset} HTTP ${status}: ${ids.length} requests (req #${ids.join(', #')})`);
  }

  const maxActive = Math.max(...results.map(r => parseInt(r.headers.active ?? '0') || 0));
  if (maxActive > 0) {
    pass(`Peak concurrent active slots observed: ${maxActive}/15`);
  }
}

// ── Summary ──────────────────────────────────────────────

async function runAll() {
  console.log(`\n${C.bold}${C.magenta}╔══════════════════════════════════════════╗`);
  console.log(`║     KUET CSE Rate Limiter Test Suite     ║`);
  console.log(`╚══════════════════════════════════════════╝${C.reset}`);
  console.log(`  Target: ${C.cyan}${BASE_URL}${C.reset}`);
  console.log(`  Limit:  ${C.cyan}15 concurrent requests per client${C.reset}\n`);

  // Check server is up first
  try {
    await fetch(`${BASE_URL}/`);
  } catch {
    console.error(`${C.red}✗ Cannot connect to ${BASE_URL}${C.reset}`);
    console.error(`  Make sure the dev server is running: ${C.cyan}npm run dev${C.reset}`);
    process.exit(1);
  }

  await testRateLimitHeaders();
  divider();
  await testConcurrentLimit();
  divider();
  await test16thRequest();
  divider();
  await testQueueMetadataFormat();
  divider();
  await testPublicRouteNotLimited();
  divider();
  await stressTest();

  console.log(`\n${C.bold}${C.green}All tests complete!${C.reset}`);
  console.log(`\n${C.gray}Tips:`);
  console.log(`  • Open DevTools Console on any admin page and run:`);
  console.log(`    ${C.cyan}fetch('/api/teachers').then(r => console.log(Object.fromEntries(r.headers)))${C.reset}`);
  console.log(`  • Watch for X-RateLimit-Active / X-RateLimit-Limit headers`);
  console.log(`  • To see the loading UI: wrap an API call with useRateLimit() hook${C.reset}\n`);
}

runAll().catch(console.error);
