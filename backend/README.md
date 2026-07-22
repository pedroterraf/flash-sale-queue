# backend

NestJS API. Five things worth understanding, in the order a request actually flows through them.

## 1. `redis/` — the connection, and the two Lua scripts

`redis.service.ts` holds the single `ioredis` client the whole app shares, plus two atomic commands defined on it via `client.defineCommand(...)`. Both exist because a plain Redis command isn't enough on its own:

- **`releaseLock(key, token)`** — `GET key == token ? DEL key : no-op`. A lock release must never blindly `DEL`; if this request's lock already expired and someone else acquired it, a blind delete would release *their* lock instead. The compare-and-delete has to happen as one atomic step, hence Lua instead of a `GET` followed by a separate `DEL` from Node.
- **`admitNext(queueKey, bucketKey, rate, ttl)`** — the admission gate itself. See `queue/` below; this is the fix for the burst bug described in the root README.

`isHealthy()` does a `PING` with a short timeout — used by `/stats` to report Redis health, and it's what would let a caller fail closed if Redis itself is unreachable.

## 2. `queue/` — the waiting room

`queue.service.ts` is the FIFO admission gate:

- `join()` — `ZADD queue:{saleId} <timestamp> <queueId>`. A sorted set keyed by join time gives strict FIFO order and O(log n) rank lookups for free.
- `status()` — called on every client poll (every ~700ms from the frontend). It does **not** trust "my rank looks eligible, let me in" — instead it calls `admitNext` (the Lua script), which is the only thing allowed to pop someone off the queue, gated by a per-second token-bucket key (`admission:tokens:{saleId}:{unixSecond}`, capped at `rate`, 2s TTL). Whoever gets popped — which may not be the caller who triggered it — gets a JWT written to `ticket:{saleId}:{queueId}` immediately. The caller then just checks whether *their own* ticket key exists yet.

Why drive it from polls instead of a cron/interval? No background worker to keep alive, no "what if the worker dies" failure mode, and it naturally scales down to zero load when nobody's polling — the tradeoff is that admission only progresses as fast as someone somewhere is polling, which is a non-issue in practice since every waiting client polls continuously.

## 3. `checkout/` — the part that's actually rate-limited

This is the endpoint the whole queue exists to protect, so getting in requires an admission ticket (`admission.guard.ts`), and the ticket only survives one use:

- **`AdmissionGuard`** checks two things, not one: the JWT signature (stateless, fast to verify) *and* that `ticket:{saleId}:{queueId}` still exists in Redis (stateful, revocable). A valid signature alone isn't enough — see the README's "second bug" for why.
- **`DistributedLockService`** — `SET lock:sale:{saleId} <token> NX PX <ttl>` to acquire, the `releaseLock` script to release. Deliberately single-node, not the multi-node Redlock algorithm (that solves surviving a Redis node dying mid-lock, a different problem than this demo has with one Redis instance).
- **`CheckoutService.purchase()`** runs entirely inside `lock.withLock(...)`: check stock, call the simulated downstream through the circuit breaker, decrement stock. Once that resolves — bought or genuinely sold out — the ticket is deleted. If the lock body *throws* (breaker open, downstream timeout), the `del` line is never reached, so a transient failure doesn't burn the client's one shot.

## 4. `inventory/` — the thing being protected

Stands in for whatever a real checkout calls that has actual latency and actual failure modes (payment auth, a fulfillment system, ...). `reserveUnit()` sleeps 30–100ms and, when `chaos:enabled` is set, always throws — that's the whole "simulated outage" the demo UI toggles. `decrementStock()` is the only part that touches real state, and it only ever runs inside the checkout lock.

## 5. `stats/` — read-only + demo controls

`GET /stats` aggregates queue depth, admitted/sold counts, Redis health, and `CheckoutService.getBreakerStats()` (opossum's own counters — `fires`, `failures`, `rejects`, latency percentiles). `POST /admin/chaos` flips the failure simulation; `POST /admin/reset` wipes every key for a sale so you can re-run the demo without restarting the containers.

## Config

Everything tunable lives in `src/config/constants.ts`, read from env vars with sane defaults (`docker-compose.yml` sets `TOTAL_STOCK=300`, `ADMISSION_RATE_PER_SECOND=8` for the live demo — the load test in `../load-test/` temporarily overrides these to finish in a reasonable time; see that folder's README).

## Running it alone (no Docker)

```bash
npm install
REDIS_URL=redis://localhost:6379 npm run start:dev   # needs a Redis reachable at that URL
```
