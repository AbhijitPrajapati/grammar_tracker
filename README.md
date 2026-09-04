# Grammar Tracker

Grammar Tracker helps English learners see recurring grammar patterns across many speaking attempts. A learner uploads a short audio sample; the application transcribes it, produces structured grammar feedback, saves the result, and aggregates error rates over time.

The production system is one Next.js application deployed on Vercel.

For a code-reading order, placement rules, and migration status, see
[`ARCHITECTURE.md`](ARCHITECTURE.md).

## Features

- Registration, login, logout, password changes, and account deletion
- Private, per-user speech history
- Audio transcription and schema-constrained grammar analysis
- Corrections, explanations, overall feedback, and six stable mistake categories
- Per-category occurrence/opportunity counts and error rates
- Weekly, monthly, yearly, and all-time analytics
- Atomic rolling analysis quotas
- Direct-to-private-Blob uploads for audio up to 25 MiB

## Runtime architecture

```text
Browser
  |-- React Server Components ---------- read models -----------+
  |-- Server Actions ------------------- commands --------------|-- Next.js on Vercel
  `-- private Vercel Blob upload token -- staged audio ---------+
                                                                  |
                        +-----------------------------------------+-------------------+
                        |                                         |                   |
                        v                                         v                   v
                  PostgreSQL                              OpenAI APIs          Upstash Redis
             users/speeches/analytics                transcription/analysis     quota ledger

Browser -- signed, short-lived upload grant --> private Vercel Blob
Next.js -- authenticated, owner-scoped stream --> private Vercel Blob
```

The browser is the only application client. Authenticated commands use Server Actions and reads happen in Server Components. The HTTP upload route is a narrow infrastructure boundary that issues authenticated Blob upload grants.

Audio processing is sequential and deliberate:

1. Issue an authenticated, pathname-constrained grant and let the browser write directly to its private staging slot.
2. Authenticate the processing action and validate the slot's ownership, size, content type, and ETag.
3. Atomically consume one analysis attempt in Upstash Redis.
4. Stream the object into transcription with `gpt-4o-mini-transcribe`.
5. Analyze the transcript with `o4-mini` and strict structured output.
6. Persist the speech, version-2 analysis document, and frequency projection in one database transaction.
7. Delete staged audio in a `finally` cleanup path.

## Clean Architecture

Frameworks and vendors are implementation details around a framework-free core. Dependencies point inward:

```text
app/ and src/presentation               Next.js delivery and presentation
              |
src/interfaces/next                     Server Actions, queries, session boundary
              |
src/application                         use cases, contracts, ports, expected errors
              |
src/domain                              entities, value objects, invariants

src/bootstrap/container                the only composition root
              |
src/infrastructure                      PostgreSQL, OpenAI, JWT/Argon2, Redis, Blob
```

The layers have distinct responsibilities:

- `src/domain` owns users, speeches, analytics, grammar analyses, frequencies, mistake categories, and their invariants. It imports no outer application layer.
- `src/application` coordinates complete business operations and owns every port required by those operations.
- `src/interfaces/next` translates form/query/cookie input into use-case calls and serializes results into React-safe view models. Authentication is checked at the server boundary and again through owned repository operations where applicable.
- `src/infrastructure` implements ports using Drizzle/PostgreSQL, OpenAI, `jose`, `argon2`, Upstash Redis, and private Vercel Blob.
- `src/bootstrap/container.ts` is the single composition root. It wires the universal PostgreSQL, Upstash, and Blob adapters and selects only the real or deterministic analysis adapter, never infrastructure from inside the domain.
- `app` primarily composes Server Components. Client Components are limited to interactive forms, browser uploads, confirmation controls, local-time rendering, and chart/filter behavior.

Domain types, application contracts, and server delivery now share one language without collapsing their boundaries. Vendor response validation and the persisted JSON mapping remain explicit in adapters rather than leaking into the core.

### Business invariants retained

- Emails use the database's case-insensitive `citext` uniqueness behavior.
- Existing Argon2id password hashes remain valid. New hashes use version 19, 65,536 KiB memory, three iterations, parallelism four, a 16-byte salt, and a 32-byte hash.
- Sessions use an unconditionally HS256-signed `JWT_SECRET`. The `session` cookie is HTTP-only, `SameSite=Lax`, secure over HTTPS, scoped to `/`, and remains a browser-session cookie. Tokens contain `sub`, `iat`, and `exp`; authenticated work also verifies that the user still exists.
- Analysis quotas are user-scoped rolling windows: 3 attempts per 60 seconds and 20 attempts per 24 hours by default. Boundary timestamps count, rejected attempts are not inserted, and an attempt is consumed before external AI work without refund.
- Audio must be non-empty, no larger than 25 MiB, and have an audio content type and filename.
- Supported staging extensions are `flac`, `mp3`, `mp4`, `mpeg`, `mpga`, `m4a`, `ogg`, `wav`, and `webm`. Each user has a bounded private slot shaped as `speech-staging/{userId}/audio.{supportedExtension}`; overwrite avoids unbounded object creation and strips the original filename. Path ownership, extension/content-type agreement, size, and ETag are revalidated server-side.
- Analysis frequencies cannot be negative, occurrences cannot exceed opportunities, categories are unique, and every detected mistake has a frequency entry.
- The category set remains `subject_verb_agreement`, `verb_tense`, `article_usage`, `preposition_usage`, `word_order`, and `plurality`.
- Date filters retain inclusive start/end comparisons. Time-series buckets are day for ranges up to 14 days, week up to 90 days, month up to 730 days (and for all-time), then year.

## Immutable database contract

The database schema is fixed. This migration deliberately does **not** add, remove, rename, or alter any table, column, index, constraint, extension, default, or Alembic marker.

The application continues to use the existing production objects:

- `users`: UUID ID, `citext` email with unique index, Argon2 password hash, creation timestamp
- `speeches`: UUID ID, cascading user foreign key, timestamp, transcript, and `jsonb` analysis document
- `mistake_frequencies`: speech/category composite primary key, opportunity and occurrence counts, valid-count check, cascading speech foreign key
- `alembic_version`: retained at revision `9b8ea2f7c1d0`

Only analysis document version 2 is supported because that is the sole version present in the live database. Its snake-case persistence shape is validated at every read and write. Domain objects remain camel-case and independent of storage formatting.

Drizzle is a typed query mapper here, not a schema owner. There is no Drizzle migration directory, no automatic migration command, and no DDL during a build, startup, or request. [`database/local-bootstrap.sql`](database/local-bootstrap.sql) is an exact bootstrap snapshot for new disposable local and E2E databases only. It is never used when connecting to the existing Neon database. Never run it against production. PostgreSQL executes it only when a Compose data directory is empty.

## Project structure

```text
grammar_tracker/
|-- app/                                  Next.js routes and pages
|-- src/
|   |-- domain/                           stable business concepts and invariants
|   |-- application/                      use cases, ports, contracts, errors
|   |-- infrastructure/                   postgres, OpenAI, auth, quota, Blob, logs
|   |-- interfaces/next/                  actions, queries, sessions, view models
|   |-- presentation/                     components, labels, UI utilities
|   `-- bootstrap/container.ts            dependency composition
|-- tests/
|   |-- unit/                             fast Vitest tests arranged by layer
|   `-- e2e/                              Playwright browser tests
|-- database/local-bootstrap.sql          disposable local/E2E schema only
|-- README.md
|-- docker-compose.dev.yaml              local Next.js + PostgreSQL
|-- docker-compose.e2e.yaml              disposable deterministic test stack
|-- Dockerfile                            local/E2E image
`-- vercel.json                           Vercel deployment configuration
```

## Technology choices

| Concern | Library/service | Boundary |
| --- | --- | --- |
| Web/runtime | Next.js 16, React 19, Node.js 22 | Server Components, Server Actions, route handlers |
| Styling | Tailwind CSS, shadcn-style components | Presentation only |
| Validation | Zod | Inbound input, OpenAI output, persisted JSON |
| Database | PostgreSQL 16, `pg`, Drizzle ORM | Repository/read-model adapters |
| Passwords | `argon2` | `PasswordHasher` adapter |
| Sessions | `jose` | `TokenService` adapter and HTTP-only cookie boundary |
| Speech analysis | OpenAI Node SDK with `gpt-4o-mini-transcribe` and `o4-mini` | `SpeechAnalyzer` adapter |
| Analysis quota | Upstash Redis with one atomic Lua operation | `AnalysisQuota` adapter |
| Staged audio | Private Vercel Blob with OIDC and presigned grants | `StagedAudioStore` adapter |
| Logging | Pino structured logs with redaction | Observability adapter |
| Verification | Vitest and Playwright | Unit/adapter and browser behavior tests |

OpenAI SDK retries are disabled internally so the adapter can deliberately reopen the audio stream. Retryable connection, 408, 409, 429, and 5xx failures use bounded backoff; request IDs, duration, and status are logged without logging audio, transcripts, passwords, tokens, or provider credentials. OpenAI storage is disabled for grammar Responses.

## Configuration

Copy `.env.example` to `.env.local` when running Next.js outside Compose. All values are server-only unless the name explicitly starts with `NEXT_PUBLIC_` (this project currently needs none).

### Required server values

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Pooled PostgreSQL URL for the unchanged production database |
| `JWT_SECRET` | Secret for unconditionally HS256-signed session tokens |
| `OPENAI_API_KEY` | Server-side OpenAI credential; required in real-analysis mode and always in production |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST credential |
| `BLOB_STORE_ID` | Connected private Blob store identifier |
| `VERCEL_OIDC_TOKEN` | Vercel-provided workload identity used by Blob SDK operations |
| `BLOB_WEBHOOK_PUBLIC_KEY` | Vercel-provided key used to verify upload completion callbacks |

### Defaults and operational switches

| Variable | Default | Notes |
| --- | --- | --- |
| `DATABASE_POOL_MAX` | `10` | Maximum connections per warm function/container instance |
| `SESSION_TTL_MINUTES` | `60` | Token lifetime; cookie itself has no persistent expiry |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Useful for controlled local testing |
| `OPENAI_TIMEOUT_MS` | `60000` | Per-provider-request timeout |
| `OPENAI_MAX_RETRIES` | `1` | Adapter-owned retries |
| `ANALYSIS_MINUTE_LIMIT` | `3` | Rolling 60-second attempts |
| `ANALYSIS_DAY_LIMIT` | `20` | Rolling 24-hour attempts |
| `ANALYZER_MODE` | `openai` | `deterministic` is allowed only outside Vercel production |
| `LOG_LEVEL` | `info` | Pino level |

Configuration validation fails closed if PostgreSQL, Redis, private Blob, or session configuration is missing. OpenAI configuration is required in real-analysis mode, and deterministic analysis is forbidden in a Vercel production deployment. Blob staging and Upstash quotas are mandatory in every environment.

The upload page's server work has a 300-second function duration. Configuration also proves that the two sequential OpenAI operations, including every configured retry, fit within a 280-second provider-time budget; the defaults are one retry and 60 seconds per attempt (at most 240 seconds total provider time), leaving headroom for Blob and database work.

## Local development

### Containerized application

The local stack contains exactly two containers: the Next.js application and PostgreSQL. Audio still passes through a private Vercel Blob store and quotas still use Upstash Redis, so first set the five required Blob/Upstash variables in a root `.env` file:

```dotenv
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
BLOB_STORE_ID=...
VERCEL_OIDC_TOKEN=...
BLOB_WEBHOOK_PUBLIC_KEY=...
```

Use dedicated non-production Blob and Redis resources. The root `.env` file is ignored by Git and is used only for Compose interpolation; never commit it.

Then start the stack from the repository root:

```bash
docker compose -f docker-compose.dev.yaml up --build
```

Open <http://localhost:3000>. The default deterministic analyzer avoids making OpenAI calls; it is a stable development fixture, not a production feature.

To exercise real OpenAI processing locally, additionally set `ANALYZER_MODE=openai` and `OPENAI_API_KEY` before starting Compose. The analysis and transcription model names are code invariants and cannot be overridden.

The named PostgreSQL volume persists data. To deliberately recreate a disposable local database from the frozen schema snapshot:

```bash
docker compose -f docker-compose.dev.yaml down --volumes
docker compose -f docker-compose.dev.yaml up --build
```

This removes local container data. It is unrelated to, and must never target, the production database.

### Native Next.js process

Set `.env.local`, using either the existing Neon pooled URL or a local PostgreSQL URL, then:

```bash
npm ci
npm run dev
```

The application runs at <http://localhost:3000>. Node.js 22 is required.

## Verification

Run fast checks from the repository root:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Run browser tests from the repository root:

```bash
npx playwright install chromium
npm run test:e2e
```

The E2E runner builds and starts the isolated Compose stack, waits for it, runs Playwright against <http://127.0.0.1:3100>, and always removes its containers and volumes. It requires the same Blob and Upstash credentials as local development but uses deterministic analysis, so it makes no OpenAI calls. Tests cover authentication/account lifecycle, speech processing/history/analytics/deletion, and per-user rolling quota enforcement entirely through browser-visible behavior.

## Vercel deployment

Create one Vercel project using the repository root as its Root Directory and Next.js as the detected framework. Use Node.js 22. The Dockerfile and Compose manifests are development/test conveniences; Vercel builds the Next.js project natively.

### Connected resources

1. Attach the existing Neon database and set its pooled `DATABASE_URL`. Place the function region near the database. Do not run `database/local-bootstrap.sql`, Alembic, Drizzle migrations, or any DDL against it.
2. Connect a private Vercel Blob store. The browser receives only a short-lived, authenticated grant for its bounded `speech-staging/{userId}/audio.{supportedExtension}` slot; it never receives a reusable Blob secret. Uploads may overwrite that slot, while the opaque ETag binds processing and deletion to the exact object version the browser just wrote. The server later streams by owned pathname and verifies metadata/ETag before use.
3. Create an Upstash Redis database and provide its REST URL/token. A single Lua execution prunes expired attempts, checks both rolling limits, records an accepted attempt, and updates expiry atomically across Vercel instances.
4. Configure the OpenAI key. Confirm the code-locked models remain `o4-mini` and `gpt-4o-mini-transcribe`; there are intentionally no model-name environment switches.
5. Set the existing JWT secret before traffic moves so current sessions continue to verify.

Direct browser-to-Blob staging is required in production because the 25 MiB application limit is larger than Vercel's function request-body limit. Private Blob is temporary transport, not durable application data. Successful and failed processing paths attempt immediate deletion. Uploads abandoned before processing may remain until they are overwritten or removed manually.

### Release checklist

1. Back up and inspect the existing production database; confirm `alembic_version` is `9b8ea2f7c1d0` and stored analysis documents are version 2.
2. Deploy a preview using a non-production database clone and connected Blob/Redis resources. Exercise the complete browser suite and inspect structured logs.
3. Configure production with the pooled database and session secret. Confirm no build/start command contains a migration step.
4. Deploy Next.js and smoke-test registration/login, an existing account, upload, history, analytics, password change, logout, and deletion behavior.
5. Move browser traffic to Vercel.
6. Monitor database connection usage, OpenAI latency/status/request IDs, quota rejections, Blob cleanup failures, and function duration.
7. Retain a database backup; do not remove the `alembic_version` table or otherwise modify the schema.

Rollback is application-only: promote the last known-good Vercel deployment while retaining the same database and JWT secret. Because releases perform no schema change and write the same version-2 analysis document plus frequency projection, rollback does not require data conversion.

## Security and operational notes

- Every credential stays server-side. Logs redact authorization, cookies, passwords, OpenAI keys, Redis tokens, Blob tokens, transcripts, and audio.
- Server Actions are treated as public mutation endpoints: they parse input, authenticate, authorize ownership, and return expected errors without exposing implementation details.
- Blob references contain only a bounded owned pathname and opaque ETag. Original filenames are not retained, and arbitrary URLs are never fetched, preventing both filename leakage and an SSRF primitive at the staging boundary.
- Account deletion relies on existing cascading foreign keys. Speech deletion is owner-scoped.
- A global PostgreSQL pool is reused by warm Node.js instances and registered with Vercel's function lifecycle. Use the provider's transaction/session pooler and budget aggregate connections across concurrent instances.
- Analytics intentionally remain sparse; missing time buckets are not synthesized. PostgreSQL retains the prior `date_trunc(timestamptz)` session-timezone behavior.
- The fixed schema constraint means future feature work must first determine whether it can be expressed through existing columns and version-2 JSON. Any proposed DDL is outside this application's accepted migration contract.

## License

See [LICENSE](LICENSE).
