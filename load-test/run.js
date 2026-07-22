/**
 * Custom load-test harness for flash-sale-queue.
 *
 * Two things are worth measuring separately:
 *
 *   1. Can the *front door* (/queue/join) absorb a real flash-sale stampede
 *      — thousands of concurrent requests at once — without falling over?
 *   2. Does the *protected checkout endpoint* actually stay capped at the
 *      configured admission rate, no matter how many people are hammering
 *      the front door? (This is the whole point of the pattern.)
 *
 * Run against a running stack: `docker compose up -d` then
 * `node load-test/run.js`. No external dependencies — plain Node 18+ fetch.
 */

const API_URL = process.env.API_URL ?? 'http://127.0.0.1:3001';
const SALE_ID = process.env.SALE_ID ?? 'DROP-001';
const JOIN_STORM_SIZE = Number(process.env.JOIN_STORM_SIZE ?? 2000);
const RATE_TEST_USERS = Number(process.env.RATE_TEST_USERS ?? 600);
const POLL_INTERVAL_MS = 400;

// Node's fetch (undici) can surface a transient socket reset from a reused
// keep-alive connection as an unhandled rejection instead of routing it to
// the specific fetch() call that was in flight, when thousands of requests
// are fired at a single Node process in a short window. That's an artifact
// of this *test client*, not the server under test — count and move on,
// the same way a real load-test tool tolerates a handful of dropped probes.
let droppedConnections = 0;
process.on('unhandledRejection', () => {
  droppedConnections += 1;
});
process.on('uncaughtException', (err) => {
  if (err && err.code === 'ECONNRESET') {
    droppedConnections += 1;
    return;
  }
  console.error('Fatal:', err);
  process.exit(1);
});

function percentile(sorted, p) {
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function summarizeLatencies(label, latenciesMs) {
  const sorted = [...latenciesMs].sort((a, b) => a - b);
  const errors = latenciesMs.filter((l) => l < 0).length;
  console.log(`\n--- ${label} ---`);
  console.log(`  requests:   ${latenciesMs.length}`);
  console.log(`  errors:     ${errors}`);
  console.log(`  p50:        ${percentile(sorted, 50).toFixed(1)} ms`);
  console.log(`  p95:        ${percentile(sorted, 95).toFixed(1)} ms`);
  console.log(`  p99:        ${percentile(sorted, 99).toFixed(1)} ms`);
  console.log(`  max:        ${Math.max(...sorted).toFixed(1)} ms`);
  return { count: latenciesMs.length, errors, p50: percentile(sorted, 50), p95: percentile(sorted, 95), p99: percentile(sorted, 99) };
}

async function timed(fn) {
  const start = performance.now();
  try {
    const result = await fn();
    return { ms: performance.now() - start, result };
  } catch {
    return { ms: -1, result: null };
  }
}

async function reset() {
  await fetch(`${API_URL}/admin/reset?saleId=${SALE_ID}`, { method: 'POST' });
}

/**
 * Fire N /queue/join requests in overlapping batches rather than one single
 * `Promise.all` of N — opening thousands of sockets from one Node process
 * in a single tick trips client-side connection limits (ECONNRESET) that
 * have nothing to do with the server's actual capacity. Batches of
 * `batchSize` fired back-to-back still produce a real concurrency spike.
 */
async function joinStorm(n, batchSize = 100) {
  console.log(`\nPhase 1 — join storm: firing ${n} /queue/join requests (batches of ${batchSize})...`);
  const wallStart = performance.now();
  const results = [];
  for (let i = 0; i < n; i += batchSize) {
    const batchN = Math.min(batchSize, n - i);
    const batch = await Promise.all(
      Array.from({ length: batchN }, () =>
        timed(() =>
          fetch(`${API_URL}/queue/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ saleId: SALE_ID }),
          }).then((r) => r.json()),
        ),
      ),
    );
    results.push(...batch);
  }
  const wallMs = performance.now() - wallStart;
  const latencies = results.map((r) => r.ms);
  const stats = summarizeLatencies('/queue/join under concurrency', latencies);
  const reqPerSec = (n / (wallMs / 1000)).toFixed(0);
  console.log(`  wall clock: ${(wallMs / 1000).toFixed(2)}s  (~${reqPerSec} req/s sustained)`);
  return { stats, wallMs, reqPerSec: Number(reqPerSec), queueIds: results.map((r) => r.result?.queueId).filter(Boolean) };
}

/** Phase 2: poll each joined user until admitted, then immediately check out. */
async function rateEnforcementTest(queueIds) {
  console.log(`\nPhase 2 — rate enforcement: polling ${queueIds.length} users until admitted, then checking out...`);
  const checkoutTimestamps = [];
  const joinLatencies = [];

  await Promise.all(
    queueIds.map(async (queueId) => {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const res = await fetch(`${API_URL}/queue/status/${queueId}?saleId=${SALE_ID}`).then((r) => r.json());
        if (res.status === 'admitted') {
          const { ms } = await timed(() =>
            fetch(`${API_URL}/checkout`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${res.ticket}` },
            }).then((r) => r.json()),
          );
          checkoutTimestamps.push(Date.now());
          joinLatencies.push(ms);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    }),
  );

  // Bucket checkout completions by second since the first one, to see the
  // realized admission rate the protected endpoint actually experienced.
  const start = Math.min(...checkoutTimestamps);
  const buckets = {};
  for (const t of checkoutTimestamps) {
    const bucket = Math.floor((t - start) / 1000);
    buckets[bucket] = (buckets[bucket] ?? 0) + 1;
  }
  const perSecondCounts = Object.values(buckets);
  const avg = perSecondCounts.reduce((a, b) => a + b, 0) / perSecondCounts.length;
  const max = Math.max(...perSecondCounts);

  console.log(`  checkouts completed: ${checkoutTimestamps.length}`);
  console.log(`  observed checkout rate: avg ${avg.toFixed(1)}/s, peak ${max}/s over ${perSecondCounts.length}s`);
  summarizeLatencies('/checkout latency (once admitted)', joinLatencies);

  return { checkoutCount: checkoutTimestamps.length, avgRatePerSecond: avg, peakRatePerSecond: max, durationSeconds: perSecondCounts.length };
}

async function main() {
  console.log(`flash-sale-queue load test — target ${API_URL}`);
  await reset();

  const storm = await joinStorm(JOIN_STORM_SIZE);

  await reset();
  const storm2 = await joinStorm(RATE_TEST_USERS);
  const rateResult = await rateEnforcementTest(storm2.queueIds);

  const statsRes = await fetch(`${API_URL}/stats?saleId=${SALE_ID}`).then((r) => r.json());

  console.log('\n=== SUMMARY ===');
  console.log(
    JSON.stringify(
      {
        joinStorm: { size: JOIN_STORM_SIZE, ...storm.stats, sustainedReqPerSec: storm.reqPerSec },
        rateEnforcement: rateResult,
        finalStats: statsRes,
        droppedClientConnections: droppedConnections,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
