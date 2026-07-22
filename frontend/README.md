# frontend

Next.js 15 (App Router) demo UI. No routing, no server components doing anything interesting — it's a single page (`app/page.tsx`) composing three client components that each poll the API independently. All API calls live in `lib/api.ts`, typed against exactly what the backend returns.

## `components/QueueFlow.tsx` — the actual user journey

A small state machine (`idle → waiting → admitted → purchasing → purchased | sold_out | error`) driven by one `useState<Phase>`:

1. **`idle`** — "Join queue" button. Click calls `api.join()`, stores the returned `queueId`, and starts a `setInterval` polling `api.status()` every 700ms.
2. **`waiting`** — shows position + ETA from whatever the last poll returned. Every poll response fully replaces the phase, so there's no manual "diffing" — the UI is always exactly what the last response said.
3. **`admitted`** — the poll returned a ticket; the interval is cleared (`stopPolling()`) since there's nothing left to wait for. "Buy now" calls `api.checkout(ticket)`.
4. **`purchased` / `sold_out` / `error`** — terminal states from the checkout response. "Start over" just resets `Phase` to `idle`; it doesn't call any reset endpoint, so the *demo's* stock/queue state is untouched — only your local UI resets, which is intentional (that's what `AdminControls`'s "Reset demo" button is for, and it's a separate concern).

Worth noticing: the component never assumes it's the one who gets admitted just because it's polling. It reflects whatever `api.status()` says — on the backend, admission can happen to a *different* client's poll (see the backend README's "queue" section), and this component doesn't need to know or care.

## `components/StatsPanel.tsx` — read-only, polls `/stats` every 1s

Renders whatever the backend's `Stats` shape says, plus a color-coded badge for `breaker.state` (`closed` = green, `half-open` = amber, `open` = red). If a poll fails (API not up yet), it just... keeps showing the last known state — no error UI, since a `/stats` blip isn't something a viewer needs to see mid-demo.

## `components/AdminControls.tsx` — the two buttons that make this demoable live

- **Simulate downstream outage** — `POST /admin/chaos {enabled: true}`. Do this, then either wait for the `StatsPanel`'s breaker badge to flip to `open` on its own (if checkouts happen to be in flight), or just click "Buy now" on an admitted ticket a few times to force it.
- **Reset demo** — `POST /admin/reset` then a full page reload, so every component starts from a clean slate. Useful between takes if you're demoing this live and don't want to explain "ignore the stock number, that's from ten minutes ago."

## Env

`NEXT_PUBLIC_API_URL` (see `.env.local.example`) — defaults to `http://localhost:3001` in `lib/api.ts` if unset, so `npm run dev` works with zero config against the default `docker-compose.yml` setup. Only needed if you change the API's port or run it somewhere other than localhost.

## Running it alone

```bash
npm install
npm run dev       # :3000, expects the API reachable at NEXT_PUBLIC_API_URL
```
