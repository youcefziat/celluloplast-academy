# Local analytics — `/ingest/e/` 404

# Cause

After login on a **self-hosted** dashboard (especially a production Docker build where SvelteKit `dev` is `false`), PostHog was initialized with:

```ts
api_host: `${window.location.origin}/ingest`
```

That path is intended for the **cloud** Cloudflare Worker (`apps/tenant-router`), which proxies `/ingest/*` to PostHog EU (`eu.i.posthog.com`).

Self-hosted SvelteKit has **no** `/ingest` route, so the browser hit:

```text
http://localhost:3082/ingest/e/?...
```

and the dashboard logged `Not found: /ingest/e/`.

Root bug: `setupAnalyticsBasedOnLicense()` (called from account setup after login) initialized PostHog/Umami whenever the instance lacked the enterprise `no-tracking` license feature. Self-hosted installs without that feature incorrectly started ClassroomIO’s cloud trackers. Root layout already used `setupCloudAnalytics()` (skipped when `PUBLIC_IS_SELFHOSTED=true`), but post-login setup did not.

---

# Analytics Provider

| Provider | Package | Init | Request shape |
|----------|---------|------|----------------|
| **PostHog** (SaaS) | `posthog-js` | `apps/dashboard/src/lib/utils/services/posthog/index.ts` | `{origin}/ingest/e/` (via first-party proxy) |
| **Umami** (SaaS) | script tag | `apps/dashboard/src/lib/utils/services/umami/index.ts` | `https://umami.hz.oncws.com/script.js` |
| **UserJot** (feedback) | CDN SDK | `apps/dashboard/src/lib/utils/services/userjot/index.ts` | already skipped when self-hosted |
| **Product analytics** | `@cio/analytics` | own API ingest | **not** `/ingest/e/` — keep enabled |

Orchestration: `apps/dashboard/src/lib/utils/functions/appSetup.ts`.

---

# Self-hosted Behavior

When `PUBLIC_IS_SELFHOSTED=true`:

- Do **not** call `posthog.init` / `capture` / `identify`
- Do **not** inject the Umami script
- UserJot remains off (existing guard)
- No browser requests to `/ingest/e/`
- Org/course product analytics that post to your API continue to work

---

# Environment Variables

| Variable | Role |
|----------|------|
| `PUBLIC_IS_SELFHOSTED` | `true` → disable PostHog + Umami (and UserJot). Set in `apps/dashboard/.env` (and rebuild/restart the dashboard container so the public env is baked in). |

There are **no** `PUBLIC_POSTHOG_*` / `PUBLIC_UMAMI_*` knobs: cloud keys/hosts are hardcoded for ClassroomIO SaaS. Self-hosted does not configure them.

Optional / unrelated:

| Variable | Role |
|----------|------|
| `PUBLIC_SENTRY_DSN` | Leave empty locally to disable Sentry (already documented in `.env.example`) |

---

# Local Behavior

Expected with `PUBLIC_IS_SELFHOSTED=true` and no Sentry DSN:

1. Log in, navigate, refresh.
2. DevTools → Network → filter `ingest` → **0 requests**.
3. Dashboard SSR/logs → **no** `Not found: /ingest/e/`.

---

# Cloud Behavior

When `PUBLIC_IS_SELFHOSTED` is unset or not `true`:

- Root layout: `setupCloudAnalytics()` may init trackers on mount (still skipped in Vite `dev`).
- After account load: `setupAnalyticsBasedOnLicense()` inits PostHog/Umami unless the plan/instance has `no-tracking`.
- PostHog uses `{origin}/ingest`, which the **tenant-router** Worker must proxy to PostHog EU.

---

# Troubleshooting

| Symptom | Check |
|---------|--------|
| Still see `/ingest/e/` | Confirm dashboard env has `PUBLIC_IS_SELFHOSTED=true` **and** the running image/process was rebuilt/restarted after the change (`PUBLIC_*` is compile-time for SvelteKit). |
| Cloud PostHog broken | Confirm requests go through the tenant-router host that implements `/ingest`, not a bare SvelteKit origin. |
| Want SaaS PostHog on a private deploy | Not supported by upstream design; do not add a fake SvelteKit `/ingest` route. |
