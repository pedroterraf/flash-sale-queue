# load-test

One file, `run.js` — plain Node 18+ (`fetch`, `performance.now()`, nothing else), no k6/Artillery/autocannon dependency to install. Run it against a live stack:

```bash
docker compose up -d --build   # from the repo root
node load-test/run.js
```

## What it actually measures, and why two separate phases

**Phase 1 — join storm.** Fires `JOIN_STORM_SIZE` (default 2000) `/queue/join` requests in batches of 100 and measures latency percentiles + sustained req/s. This is the "can the front door take a real stampede" question — `/queue/join` is a single `ZADD`, so it should stay fast even under heavy concurrency, and this phase proves it rather than assuming it.

**Phase 2 — rate enforcement.** Joins `RATE_TEST_USERS` (default 600) users, then polls every single one of them to admission and immediately checks out, recording the wall-clock timestamp each checkout *completes*. Those timestamps get bucketed by second-since-first-checkout, and the average/peak per-second count is compared against the configured `ADMISSION_RATE_PER_SECOND`. This is the actual point of the whole project: proving the protected endpoint never sees more traffic than the configured cap, regardless of how many clients are hammering the queue.

Why not just one giant phase? Because "can the front door take load" and "does the rate cap actually hold" are different claims that need different measurements — conflating them into one number would hide a regression in either one.

## Why results are bucketed by *completion* time, not admission time

The Lua-scripted admission gate (see `../backend/README.md`) guarantees at most `rate` **admissions** per second. This script measures checkout **completions**, which happen slightly after admission (network round-trip + the checkout's own ~30-100ms simulated downstream latency). A few completions from second *N*'s admissions landing just after the second boundary is expected jitter, not a rate-limiting bug — that distinction is spelled out in the root README's load-test section, because it's the kind of thing that looks like a bug at first glance and isn't.

## Two things this script works around that are about the test client, not the server

- **`API_URL` defaults to `127.0.0.1`, not `localhost`.** On at least one dev machine, Node's `fetch` resolved `localhost` to `::1` first and got connection resets talking to a Docker port mapping that wasn't answering on IPv6 — `curl` didn't hit this (different resolution order), which is what made it confusing to debug. If you see `ECONNRESET` immediately on the very first request, try `API_URL=http://127.0.0.1:3001 node load-test/run.js` explicitly.
- **Joins are batched (`batchSize`, default 100), not fired as one `Promise.all` of 2000.** Opening thousands of sockets from a single Node process in one tick trips client-side connection limits that have nothing to do with the server's real capacity. A handful of dropped connections from this artifact are caught and counted in `droppedClientConnections` in the summary rather than crashing the run — real load-test tools tolerate a few failed probes the same way.

## Env vars

| Var | Default | |
|---|---|---|
| `API_URL` | `http://127.0.0.1:3001` | |
| `SALE_ID` | `DROP-001` | must match what the API is configured with |
| `JOIN_STORM_SIZE` | `2000` | phase 1 size |
| `RATE_TEST_USERS` | `600` | phase 2 size — bigger takes proportionally longer at a low `ADMISSION_RATE_PER_SECOND` |

The numbers quoted in the root README's "Load test" section were captured with the API's `ADMISSION_RATE_PER_SECOND` and `TOTAL_STOCK` temporarily raised (20/s, 1000 units) specifically so phase 2 finishes in under a minute — at the live demo's default of 8/s, admitting 600 people takes 75 seconds just by definition of the rate. Bump those two env vars in `docker-compose.yml`, rebuild, run the test, then revert before using the live demo again (or just run with a smaller `RATE_TEST_USERS`).
