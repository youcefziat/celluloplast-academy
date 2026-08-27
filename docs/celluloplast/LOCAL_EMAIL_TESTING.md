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

**Celluloplast stack** (`docker-compose.celluloplast.yaml`) — MailHog starts with the stack by default.

**Upstream compose** (`docker-compose.yaml`) — optional profile:

```bash
docker compose --profile mail up -d mailhog
```

Production compose files (`docker/coolify/…`, Railway, etc.) do **not** include MailHog.

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
# From repo root — full Celluloplast stack (includes MailHog)
docker compose -f docker-compose.celluloplast.yaml up -d

# Or MailHog alone on an already-running stack
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

| | Local (Celluloplast compose) | Production |
|--|------------------------------|------------|
| SMTP host | `mailhog` (compose default) | Real provider via env (`SMTP_HOST`, …) |
| MailHog service | Present | **Absent** |
| Code | Env-driven only — no hardcoded `mailhog` | Same code |

Never commit real SMTP passwords. Override `SMTP_*` in the deployment environment; do not rely on MailHog defaults outside local compose.
