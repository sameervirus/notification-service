# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev            # API server, watch mode (tsx)
npm run dev:worker     # BullMQ worker, watch mode — separate process from the API
npm run typecheck      # tsc --noEmit over src/ + scripts/ (tsconfig.json)
npm run build          # compiles src/ only to dist/ (tsconfig.build.json)
npm run start          # prisma migrate deploy && node dist/server.js
npm run start:worker   # prisma migrate deploy && node dist/worker.js

npm run prisma:generate       # regenerate src/generated/prisma (gitignored, required before typecheck/build)
npm run prisma:migrate        # prisma migrate dev — creates+applies a migration locally
npm run prisma:migrate:deploy # prisma migrate deploy — apply-only, used in start/start:worker

npm run dev:keys   # generates a throwaway RSA keypair in .dev-keys/ (gitignored) for local JWT testing
npm run dev:token  # mints a short-lived RS256 test JWT signed with .dev-keys/private.pem
```

There is no test suite yet.

Local infra: `docker compose up -d` starts Postgres + Redis (local dev only — see Deployment
below). Copy `.env.example` to `.env` first.

## Architecture

Two deployable processes share one codebase and one Docker image:

- **API** (`src/server.ts` → `src/app.ts`): Fastify. Validates payloads with zod, writes a
  `Notification` row (`QUEUED`), enqueues a BullMQ job, returns `202` immediately. Never talks to
  providers directly.
- **Worker** (`src/worker.ts` → `src/queue/worker.ts`): consumes the queue, calls the resolved
  provider adapter, updates the notification's status. BullMQ retries failed jobs with exponential
  backoff (5 attempts, `src/queue/notificationQueue.ts`); after the final attempt the `failed`
  listener in `src/queue/worker.ts` marks the row `FAILED_PERMANENT`.

Both processes run `prisma migrate deploy` before starting (see `start`/`start:worker` scripts).
This is intentionally safe to run from both — Prisma serializes migrations with an advisory lock,
so whichever process boots first applies them and the other no-ops.

### Provider abstraction

`src/providers/dispatch.ts` is the only place that maps a `NotificationChannel` (`EMAIL` | `SMS`)
to a provider call. Each channel has an interface (`EmailProvider`, `SmsProvider`) and one adapter
behind it (`SmtpEmailProvider` via nodemailer, `TwilioSmsProvider`). Adding a provider means
implementing the interface and adding a case in `dispatch.ts` — no changes to routes, queue, or
worker.

### Auth model

This service never signs JWTs, only verifies them (RS256, `src/auth/jwt.ts` +
`src/auth/requireAuth.ts`). The calling backend holds the private key and signs; this service holds
only `JWT_PUBLIC_KEY`. Rate limiting (`src/app.ts`) is keyed off the JWT `sub` claim (decoded, not
re-verified, purely for bucketing) falling back to IP.

`JWT_PUBLIC_KEY` accepts either a base64-encoded PEM (recommended — see `src/config/env.ts`'s
transform) or a raw/`\n`-escaped PEM optionally wrapped in quotes. The base64 form exists because
platforms like Coolify don't reliably preserve embedded newlines/quotes in env var values on
paste; base64 has neither, so there's nothing to mangle. `npm run dev:keys` prints the base64 form
directly.

**Fastify plugin registration gotcha**: `@fastify/jwt` and `@fastify/rate-limit` must be registered
directly on the top-level `app` instance in `src/app.ts` (not via an intermediate wrapper
function/plugin), or Fastify's encapsulation will scope the `jwt`/`jwtVerify` decorators to a child
context and they won't be visible where `requireAuth` or the rate-limiter's `keyGenerator` expect
them.

### Logging vs audit

Two separate channels, not to be conflated:
- **Operational logs** (`src/logging/logger.ts`, pino): structured JSON, PII redacted via
  `redact.paths`. Pretty-printing is an explicit opt-in (`LOG_PRETTY=true`), never inferred from
  `NODE_ENV` — `pino-pretty` is a devDependency, absent from the production image, so gating on
  environment name previously crashed the app whenever `NODE_ENV` wasn't exactly `"production"`.
- **Audit log** (`src/logging/audit.ts` → `AuditLog` Prisma model): security-relevant events only
  (auth failures, send attempts/results). `auditLog()` is fire-and-forget with its own `.catch` —
  a database outage must never take down the request path or the worker.

### Config (`src/config/env.ts`)

All env vars are validated with zod at import time; the process exits immediately on missing or
malformed config rather than starting in a partially-working state. When adding a new env var,
add it here first — nothing should read `process.env` directly elsewhere.

### Prisma specifics (v7)

This project uses Prisma 7, which changed the config surface from earlier versions:
- Connection URL lives in `prisma.config.ts` (loaded via `dotenv/config`), not in
  `schema.prisma`'s `datasource` block.
- The runtime `PrismaClient` requires an explicit driver adapter — `src/db/prisma.ts` constructs
  one from `@prisma/adapter-pg` using `env.DATABASE_URL`. There is no implicit connection from a
  schema-level `url`.
- The generator is `prisma-client` (not the older `prisma-client-js`), emitting TypeScript source
  under `src/generated/prisma/` — gitignored, regenerated via `npm run prisma:generate`. It must
  exist before `typecheck` or `build` will pass.

### Deployment

Two Coolify Applications from the same `Dockerfile` and repo: one running the default start
command (API), one with the start command overridden to `npm run start:worker`. Postgres and
Redis are Coolify-managed database resources, not the `docker-compose.yml` in this repo (that file
is local-dev only). See `README.md`'s Deployment section for the full checklist, including that
`prisma/migrations` must contain at least one migration before the first deploy — `prisma migrate
deploy` applies nothing if the directory is empty.
