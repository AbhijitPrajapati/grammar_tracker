# Architecture and code-reading guide

Read the application from the inside out:

1. `src/domain` defines the stable product vocabulary and invariants.
2. `src/application/use-cases` describes complete operations.
3. `src/application/ports` describes capabilities those operations need.
4. `src/infrastructure` implements the ports with external technology.
5. `src/interfaces/next` translates Next.js input and output.
6. `src/presentation` renders the interface.
7. `src/bootstrap/container.ts` connects abstract ports to implementations.

## Placement rule

- Business meaning and invariants: `domain`
- A complete user or scheduled operation: `application`
- PostgreSQL, OpenAI, Redis, Blob, JWT, configuration: `infrastructure`
- Cookies, Server Actions, request validation, view models: `interfaces/next`
- React components and labels: `presentation`
- Next.js file-convention entry points: `app`

## What the external-service code does

### PostgreSQL and Neon

`src/infrastructure/postgres/client.ts` creates a `pg` connection pool from
`DATABASE_URL` and wraps it with Drizzle. Repository classes use that database
object to load and save domain data. Neon is PostgreSQL, so no Neon-specific
application adapter is needed: use Neon's pooled connection URL as
`DATABASE_URL`.

`database/local-bootstrap.sql` is not an application database and is never read
by Next.js. Docker mounts it into a brand-new local/E2E PostgreSQL container so
that disposable databases start with the same schema as Neon. If the application
uses an existing Neon database, this file does nothing.

### Upstash Redis

`src/infrastructure/quota/upstash-analysis-quota.ts` stores only timestamps of
accepted analysis attempts. One Lua script atomically removes expired entries,
checks the one-minute and one-day limits, and inserts the new attempt. Redis does
not store users, speeches, audio, or analysis results.

### Vercel Blob

Audio is temporary and follows this path:

```text
browser
  -> /api/uploads/audio requests a short-lived, owner-scoped upload grant
  -> browser sends audio bytes directly to private Vercel Blob
  -> browser receives pathname + ETag
  -> processSpeechAction(pathname, ETag)
  -> ProcessSpeech
       -> Blob adapter validates metadata and opens a private stream
       -> quota -> transcription -> analysis -> PostgreSQL
       -> Blob adapter deletes the temporary object
```

The audio bypasses the Next.js request body because the supported 25 MiB size is
larger than Vercel's Function body limit. `pathname` identifies the temporary
object; `ETag` binds processing and deletion to the exact uploaded version.

Uploads abandoned before processing can remain in Blob. This hobby deployment
accepts that tradeoff and uses one bounded, overwritable slot per user and audio
format. The normal processing path still attempts deletion after every outcome.

### Next.js Server Actions

Files under `src/interfaces/next/actions` use `"use server"`. A Client Component
imports them like functions, but Next.js replaces the browser-side import with a
reference that sends a POST request to the server. Each action therefore treats
input as untrusted, authenticates the user, calls one application use case, and
maps the result back to UI state.

Server Components perform reads directly through query functions under
`src/interfaces/next/queries`; they do not make HTTP requests back to this same
application.

## Local development

The Next.js process can run locally. "Local" describes where the application
process runs; dependencies may still be managed services.

The current implementation supports two database choices:

- Set `DATABASE_URL` to a Neon pooled URL and run Next.js directly.
- Use `docker-compose.dev.yaml`, which starts disposable/local PostgreSQL from
  `database/local-bootstrap.sql`.

The current Blob and quota adapters still use real non-production Vercel Blob
and Upstash databases. Link the local directory to the Vercel project and pull
development values with `vercel env pull .env.local`, then add/check the Upstash
REST URL and token. Use separate development resources, not production data.

There is currently no filesystem Blob adapter or in-memory quota adapter. Those
would be new development conveniences, not requirements for running Next.js on
your machine.

## Test organization

All tests live below `tests`, separated by test level:

```text
tests/
  unit/   Vitest; isolated domain, application, interface, and infrastructure
  e2e/    Playwright; real browser against a running disposable stack
  support/
```

Keeping E2E tests in the same test root improves discoverability; keeping them
in their own subtree preserves their different runner, cost, and purpose.
