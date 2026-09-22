# Sentinel

## Org standards

Shared Dark Avian Labs engineering conventions (README shape, CI/PR runners, validate, release tracks) live in AppBase [`docs/org-standards/`](../AppBase/docs/org-standards/). The design system (theme axes, glass contracts, UI primitives, Clerk appearance) lives in AppBase [`AGENTS.md`](../AppBase/AGENTS.md). There is no shared UI package: when you change layout, glass, buttons, or modals here, apply the same change in AppBase / Codex / Armory.

This file is Sentinel runtime and monitoring gotchas only.

## Overview

Sentinel monitors PM2-hosted Node apps on one host: CPU, RSS/heap, ELU, event-loop lag, GC p95, HTTP latency/RPS/error rate, uptime, host load/mem, and graceful restarts vs crashes. UI is Clerk-gated (`apps.sentinel === 'admin'`). Alerts and logs stay with `pm2-discord` on PM2; Sentinel does not notify or ship logs.

Default listen port is **3005**. Vite defaults to **5176**.

## Auth

Same Clerk instance as the other DAL apps. Production `COOKIE_DOMAIN=.darkavianlabs.com` shares one login. `APP_PUBLIC_BASE_URL` is required when Clerk is configured; `ALLOWED_APP_ORIGINS` lists sibling apps for Clerk `authorizedParties` and CSRF origin checks. Keep `VITE_*` plaintext. Session token must include `"metadata": "{{user.public_metadata}}"`.

Empty keys are fine outside production: `isClerkConfigured()` skips Clerk and treats every request as signed out (Vitest and Playwright rely on this). Placeholder keys (`pk_test_placeholder` / `sk_test_placeholder`) are fatal at boot. Leave both keys empty instead of faking values.

Cursor agents sign in with Clerk Agent Tasks. Do not type a password. Decrypt `.env.development` and read `E2E_CLERK_USER_EMAIL` or `E2E_CLERK_USER_ID`. POST `https://api.clerk.com/v1/agents/tasks` using `CLERK_SECRET_KEY`. Send `agent_name`, `task_description`, `permissions` `*`, `redirect_url` `http://localhost:5176/`, and `on_behalf_of` with `user_id` or `identifier`. Open the URL Clerk returns. Local cookies are host-only, so each app origin needs its own task.

## Monitoring

Dual collectors on the same host:

1. **PM2 bridge** inside the Sentinel server: process CPU, RSS, uptime, status, restart counts, exit events, plus host load/mem snapshots.
2. **In-app agent** (`packages/agent`): ELU, event-loop lag, GC p95, heap used/total/external, HTTP latency histograms, `exit_kind` graceful vs crash. Sibling apps install the agent from a GitHub Release `.tgz` tagged `agent-v*` (or `file:../Sentinel/packages/agent` while iterating). App deploy releases use plain `v*` via semantic-release and do not publish the agent. No npm publish.

Apps push to `POST /api/ingest` with `SENTINEL_INGEST_TOKEN`. Metrics live in `data/metrics.db` (separate from sessions).

### Privacy

Ingest rejects and the agent never sends: IPs, user ids, emails, cookies, Authorization headers, bodies, full URLs, or query strings. HTTP dimensions are method, Express route pattern, status class, and latency buckets only. Crash events may keep a short sanitized message plus exit code/signal.

## Scripts

See `package.json`. Quality gate is `pnpm run validate`.

## Tests

`pnpm run validate` runs preflight, oxfmt, oxlint, typecheck, Vitest. Playwright is outside validate. Empty Clerk keys keep signed-out test runs.
