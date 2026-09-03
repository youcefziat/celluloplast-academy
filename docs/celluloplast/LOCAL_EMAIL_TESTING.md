# Local email testing with MailHog

Capture every outbound email from Celluloplast Academy on your machine — no real SMTP provider required.

---

# MailHog

MailHog is a local SMTP sink + web UI.

| Role | Address |
|------|---------|
| SMTP (from Docker containers) | `mailhog:1025` |
| SMTP (from host tools) | `localhost:1025` |
| Web UI | [http://localhost:8025](http://localhost:8025) |

---

# Docker Service

**Celluloplast stack** (`docker-compose.celluloplast.yaml`) — MailHog is defined in the base
file but gated behind the compose profile `mail`. It only starts when `COMPOSE_PROFILES=mail`
is set (or `--profile mail` is passed), so it never appears by accident on a deployment `.env`
that doesn't opt in. Local dev sets `COMPOSE_PROFILES=mail` in `.env` (see `.env.example`) so
the everyday `docker compose up -d` keeps including it.

You can also start it explicitly regardless of the active profile:

```bash
docker compose -f docker-compose.celluloplast.yaml up -d mailhog
```

**Upstream compose** (`docker-compose.yaml`) — same idea, its own `mail` profile:

```bash
docker compose --profile mail up -d mailhog
```

The VPS overlay (`docker-compose.vps.yaml`) does **not** set `COMPOSE_PROFILES`, so MailHog
never starts there — the VPS `.env` points `SMTP_*` at a real provider instead (see
"Production Difference" below).

---

# SMTP Configuration

Reuse the existing upstream variables (no new env names):

```text
SMTP_HOST=mailhog
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
SMTP_SENDER=Celluloplast Academy <no-reply@celluloplast.local>
```

`docker-compose.celluloplast.yaml` already defaults `api` and `jobs` to these values when `.env` leaves them unset.

For pnpm local API/jobs (not Docker), point at the published host port:

```text
SMTP_HOST=localhost
SMTP_PORT=1025
```

Auth credentials are optional. `@cio/email` only requires `SMTP_HOST`; user/password are used when both are set (real providers).

---

# Local URLs

| Service | URL |
|---------|-----|
| Dashboard | http://localhost:3082 |
| API | http://localhost:3081 |
| MailHog UI | http://localhost:8025 |

Email links are built from `DASHBOARD_ORIGIN` (default `http://localhost:3082` in the Celluloplast compose). Keep that aligned with the dashboard port so invite / reset links do not point at `app.classroomio.com`.

---

# How to Start

```powershell
# From repo root — full Celluloplast stack (MailHog included if .env sets COMPOSE_PROFILES=mail)
docker compose -f docker-compose.celluloplast.yaml up -d

# Or MailHog alone on an already-running stack, regardless of COMPOSE_PROFILES
docker compose -f docker-compose.celluloplast.yaml up -d mailhog
```

Then open http://localhost:8025.

Rebuild **api** and **jobs** after changing SMTP or the nodemailer package:

```powershell
docker compose -f docker-compose.celluloplast.yaml up -d --build api jobs
```

---

# How to Test Invitation Email

1. Log in as admin → **Employés**.
2. **Ajouter un employé** (or CSV import) with a test address, e.g. `invite-test@example.com`.
3. Confirm the invite is created in the UI.
4. Open MailHog → message to that address (template `studentOrgInvite` / org invite).
5. Check subject, recipient, and that links start with `http://localhost:3082`.

Invites are **enqueued** by the API and **sent by `jobs`**. If the row exists but MailHog is empty, check that `celluloplast-jobs` is running and Redis is healthy.

---

# How to Test Password Reset

1. Log out → **Mot de passe oublié** / forgot password.
2. Submit a known account email (e.g. `admin@test.com`).
3. MailHog → `forgotPassword` message.
4. Open the reset link — host should be `localhost:3082` (Better Auth `baseURL` from `DASHBOARD_ORIGIN`).

Password-reset emails are sent **synchronously by the API** (not via the jobs queue).

---

# API vs Jobs Emails

| Path | Examples | Process that speaks SMTP |
|------|----------|---------------------------|
| Sync (`sendEmail` in Better Auth / `@cio/email`) | Forgot password, password reset confirmation, email verification | **API** |
| Async (`enqueueTransactionalEmail` → BullMQ) | Employee org invite, course welcome, team invite, notifications | **Jobs** |

Both must have the same `SMTP_*` pointing at MailHog in local Docker.

---

# Troubleshooting

## Aucun email reçu

- `docker logs celluloplast-jobs` and `celluloplast-api` — look for `SMTP configuration missing` or `Transporter error`
- Confirm `SMTP_HOST=mailhog` and `SMTP_PORT=1025` inside the containers:  
  `docker exec celluloplast-api printenv SMTP_HOST SMTP_PORT`
- Jobs worker running? `docker ps | findstr jobs`
- Redis healthy? Invites need Redis to enqueue

## Invitation créée mais pas d’email

- Almost always: **jobs** not running, or Redis down
- Check MailHog is the SMTP target for **jobs**, not only API

## Connexion refusée

- From a container, use `mailhog:1025` — **not** `localhost:1025`  
  (`localhost` inside a container is that container itself)
- From the host (pnpm `api:dev`), use `localhost:1025`

## Transporter / TLS errors

- Leave `SMTP_USER` and `SMTP_PASSWORD` empty for MailHog
- Port must be `1025` (plain SMTP). Do not use `465`/`587` against MailHog

---

# Production Difference

| | Local (Celluloplast compose) | Production (VPS) |
|--|------------------------------|------------|
| SMTP host | `mailhog` (compose default, `mail` profile) | Real provider via `.env` (`SMTP_HOST`, …) |
| MailHog service | Present when `COMPOSE_PROFILES=mail` | **Never started** (VPS `.env` leaves `COMPOSE_PROFILES` unset) |
| Code | Env-driven only — no hardcoded `mailhog` | Same code |

Never commit real SMTP passwords. Override `SMTP_*` in the deployment environment; do not rely on MailHog defaults outside local compose.

## VPS example: Hostinger SMTP

The env var names here differ from Django-style `EMAIL_*` settings used by other apps on the
same VPS (e.g. Cellulo Forecast). Map them like this in the VPS `.env`:

| Django-style (other app) | This app's `.env` |
|---|---|
| `EMAIL_HOST` | `SMTP_HOST` |
| `EMAIL_PORT` | `SMTP_PORT` |
| `EMAIL_HOST_USER` | `SMTP_USER` |
| `EMAIL_HOST_PASSWORD` | `SMTP_PASSWORD` |
| `DEFAULT_FROM_EMAIL` | `SMTP_SENDER` |
| `EMAIL_USE_TLS` / `EMAIL_USE_SSL` | not needed — `@cio/email`'s `nodemailer` transport (`packages/email/src/utils/services/nodemailer.ts`) picks TLS mode from the port: `465` → implicit TLS, anything else with credentials set (e.g. `587`) → STARTTLS. No separate flag. |

```text
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=587
SMTP_USER=support@celluloapps.com
SMTP_PASSWORD=<mot de passe>
SMTP_SENDER=Celluloplast Academy <support@celluloapps.com>
```

`COMPOSE_PROFILES` must stay unset (or absent) in this `.env` so `mailhog` is never started
alongside a real provider.
