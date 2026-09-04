# Grammar Tracker

English learners often face no shortage of substantial grammatical feedback. Nonetheless, identifying and prioritizing recurring mistakes across many speaking attempts remains inconvenient. This full-stack language-learning application targets this issue by seamlessly maintaining a persistent record of grammatical errors in order to characterize a learner's progress over time.

Users submit short speech samples, which are transcribed and analyzed for grammatical inaccuracies. Detected errors are categorized, explained, and stored, allowing the system to identify long-term trends across grammatical categories and multiple timeframes.

## Features

### Speech Processing

- AI-driven audio transcription and grammatical analysis
- Corrections, explanations, overall feedback, and six stable mistake categories
- Atomic rolling analysis quotas
- Private Blob audio uploads up to 25MiB

### Analytics

- Persistent error history
- Frequency trends and error distribution by category
- Per-category occurrence/opportunity counts and error rates
- Weekly, monthly, yearly, and all-time statistics

### Authentication

- Complete user registration and authentication flow
- Private, per-user speech history and analytics

## Architecture

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

```

Server actions and server components are used for authenticated actions and read operations respectively. A narrow HTTP upload route is used to authenticate Blob uploads.

## Processing Pipeline

1. User submits a speech sample.
2. Authenticated, contrained upload grant is issued, allowing the browser to write directly to a private staging slot.
3. Analysis attempt is consumed in Upstash Redis
4. Audio file is streamed to `gpt-4o-mini-transcribe`.
5. Transcript is analyzed for grammatical innaccuracies with `o4-mini`, resulting in a structured JSON output.
6. Transcript, errors, and analytics projections are persisted on PostgreSQL.
7. Staged audio is deleted.

## Project structure

```
grammar_tracker/
|-- app/                                  Next.js routes and pages
|-- src/
|   |-- domain/                           stable business concepts + invariants
|   |-- application/                      use cases, ports, contracts, policies
|   |-- infrastructure/                   postgres, OpenAI, auth, quota, Blob, logging
|   |-- interfaces/next/                  actions, queries
|   |-- presentation/                     components, UI utilities
|   `-- bootstrap/container.ts            composition root
|-- tests                                 Vitest tests
|-- localdb/bootstrap.sql                 disposable local schema
|-- README.md
|-- docker-compose.dev.yaml              local Next.js + PostgreSQL
```

## Technology choices

| Concern         | Library/service                                        |
| --------------- | ------------------------------------------------------ |
| Web/runtime     | Next.js 16, React 19, Node.js 22                       |
| Styling         | Tailwind CSS, shadcn-style components                  |
| Validation      | Zod                                                    |
| Database        | PostgreSQL 16, Drizzle ORM                             |
| Passwords       | `argon2`                                               |
| Sessions        | `jose`                                                 |
| Speech analysis | OpenAI SDK with `gpt-4o-mini-transcribe` and `o4-mini` |
| Analysis quota  | Upstash Redis                                          |
| Staged audio    | Private Vercel Blob                                    |
| Logging         | Pino structured logs                                   |
| Testing         | Vitest                                                 |

## Testing

Run TSC, ESlint, and Vitest:

```bash
npm run typecheck
npm run lint
npm test
```

## Project Scope

Grammar Tracker is a comprehensive end-to-end machine learning application rather than an isolated model demonstration. Integrating ML services with surrounding infrastructure, it includes user data persistence, a complete web interface, a stable production environment, and thorough testing procedures.

This application is currently feature-complete and deployed.
