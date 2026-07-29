# notification-service

Provider-agnostic notification service (email/SMS today) for internal use by other backends.
Requests are queued and delivered asynchronously with retry/backoff, and every send and auth
event is recorded to an audit log separate from operational logs.

## Architecture

```
Backend ──(JWT-authed HTTPS)──▶ POST /notifications ──▶ Postgres (queued) ──▶ BullMQ ──▶ Worker
                                                                                  │
                                                                                  ▼
                                                              Provider adapter (SMTP / Twilio)
```

- **API** (`src/server.ts`): Fastify, validates payloads with zod, writes a `notifications` row,
  enqueues a job, returns `202` immediately.
- **Worker** (`src/worker.ts`): separate process, consumes the queue, calls the right provider
  adapter, updates status. Failed jobs retry with exponential backoff (5 attempts) before being
  marked `FAILED_PERMANENT`.
- **Providers** (`src/providers/`): one interface per channel (`EmailProvider`, `SmsProvider`),
  adapters underneath (SMTP via nodemailer, Twilio). Add a provider by implementing the interface
  and wiring it into `src/providers/dispatch.ts` — no changes to routes or queue needed.
- **Auth**: the calling backend signs a JWT (RS256); this service only holds the public key.
  Rate limiting is keyed per caller (JWT `sub`), falling back to IP.
- **Logging**: `pino` structured logs for operational visibility (PII redacted), plus a separate
  `audit_log` table for security-relevant events (auth failures, send attempts/results).

## Requirements

- Node 20+
- Docker (for local Postgres/Redis via `docker-compose.yml`)

## Local setup

```bash
npm install
cp .env.example .env          # fill in SMTP/Twilio creds
docker compose up -d          # Postgres + Redis

npm run dev:keys              # generates a dev RSA keypair in .dev-keys/
# paste .dev-keys/public.pem into JWT_PUBLIC_KEY in .env (see .env.example for the \n-escaped format)

npm run prisma:migrate        # creates prisma/migrations + applies them (first run: --name init)

npm run dev                   # API on :3000
npm run dev:worker            # worker, separate process
```

Mint a test token to call the API locally:

```bash
TOKEN=$(npm run -s dev:token)
curl -X POST http://localhost:3000/notifications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"channel":"EMAIL","recipient":"you@example.com","template":"welcome","payload":{"subject":"Hi","html":"<p>hi</p>"}}'
```

## API

| Endpoint | Auth | Description |
|---|---|---|
| `GET /health` | none | Liveness check |
| `POST /notifications` | JWT | Queue a notification. Body is a discriminated union on `channel` (`EMAIL` or `SMS`) |
| `GET /notifications/:id` | JWT | Fetch status/history of a queued notification |

`POST /notifications` payload shapes:

```jsonc
// channel: "EMAIL"
{ "channel": "EMAIL", "recipient": "a@b.com", "template": "welcome",
  "payload": { "subject": "...", "html": "...", "text": "optional" } }

// channel: "SMS"
{ "channel": "SMS", "recipient": "+15551234567", "template": "otp",
  "payload": { "body": "..." } }
```

## Environment variables

See `.env.example` for the full list: server (`PORT`, `LOG_LEVEL`), `DATABASE_URL`, `REDIS_URL`,
SMTP creds, Twilio creds, JWT verification (`JWT_PUBLIC_KEY`, `JWT_ISSUER`, `JWT_AUDIENCE`), and
rate-limit tuning. All are validated at boot (zod) — the process fails fast on missing/malformed
config rather than starting in a broken state.

## Deployment (Coolify)

Postgres and Redis are provisioned as Coolify's managed database resources, not via
`docker-compose.yml` (that file is local-dev only). Deploy this repo as two Coolify Applications
from the same `Dockerfile`:

1. **API** — default start command (runs `prisma migrate deploy` then the server)
2. **Worker** — override the start command to `npm run start:worker`

Both apply pending migrations on boot; this is safe to run from both since Prisma serializes
migrations with an advisory lock. Point `DATABASE_URL`/`REDIS_URL` at the managed resources and
set the SMTP/Twilio/JWT env vars on both apps.

**Before the first deploy**, generate the initial migration against a real Postgres (local
`docker compose up -d postgres` works) and commit it — `prisma/migrations` ships empty otherwise
and `prisma migrate deploy` has nothing to apply:

```bash
npm run prisma:migrate -- --name init
```
