# PunchStats — Architecture

## High-level architecture

**A single Next.js (App Router, TypeScript) application — a modular monolith — backed by one PostgreSQL database.** No microservices, no message queues, no separate API server, no external search engine, no Redis.

Why this fits: one developer, read-heavy public traffic, small write volume (one admin), and a portfolio timeline. Every piece of infrastructure beyond "Next.js + Postgres" must justify itself; at MVP scale, none do. The modularity lives in the code layout, not in deployment units, so it costs nothing now and gives clean seams if pieces ever need to split.

```
Browser ──► Vercel edge/CDN ──► Next.js app (RSC pages, server actions, /api/v1 routes)
                                      │
                                      ▼
                               service layer (per module)
                                      │
                                      ▼
                              Drizzle ORM ──► PostgreSQL (Neon)
                                                    ▲
Cloudflare R2 (images) ◄── next/image               │
                              Docker Compose Postgres (local dev only)
```

### Module layout (the "modular" in modular monolith)

```
src/
  app/                    # routes only — thin; no business logic
    (public)/             # fighters, events, bouts, divisions, search
    admin/                # auth-gated admin UI (server actions live here or in modules)
    api/v1/               # thin public read-only JSON handlers
  modules/
    fighters/             # queries.ts, service.ts, actions.ts, components/
    bouts/
    events/
    rankings/
    titles/
    search/
    provenance/           # sources, verification status helpers
    admin-auth/
  db/                     # drizzle schema, migrations, seed
  lib/                    # shared utils (slugs, formatting, pagination)
  components/ui/          # shadcn/ui primitives + shared composites
```

Rules that keep the monolith modular:

1. Route files (`app/`) never import Drizzle directly — only module services.
2. Modules may import each other's **service functions and types**, never each other's table internals for writes.
3. All admin mutations are server actions defined inside the owning module, validated with Zod.
4. Calculated data (records, KO%, streaks) is computed in services and typed as such — never hand-entered.

## Frontend / backend boundaries

There is no separate backend. The boundaries are:

- **Public reads** → React Server Components calling module query functions directly (no HTTP hop to ourselves). This is the fastest and simplest path and gives SSR/SEO for free.
- **Admin writes** → Server Actions (form-based), gated by the auth middleware + per-action session assertion. No admin REST API in the MVP; actions are simpler, typed end-to-end, and progressive-enhancement friendly.
- **Public JSON API** (`/api/v1/*`) → thin, read-only route handlers that call the *same* module query functions as the pages. Included because it demonstrates API design for the portfolio and costs little; it is not required by the UI.
- **Client components** are used only where interactivity demands it: search combobox, table sorting/filter controls, admin forms, mobile nav. Everything else is server-rendered.

## Data flow

**Public read:** request → Next.js route (static or ISR-cached) → module query (Drizzle) → Postgres → RSC render → CDN cache.

**Admin write:** form submit → server action → Zod validation → service (transaction: write + provenance fields + any denormalized recompute, e.g. fighter record counters) → `revalidateTag(...)` for affected entities → admin UI refresh; public pages regenerate on next hit.

**Calculated data:** fighter W-L-D/KO record is denormalized onto the fighter row and recomputed inside the same transaction whenever a bout involving that fighter changes. Rationale: records appear on every list row and profile header; computing across joins on every page is wasteful, and app-level recompute (vs. DB triggers) keeps logic in one debuggable place. The columns are always rendered with the *calculated* provenance badge.

## Authentication (MVP decision)

**Single admin user, custom minimal session auth. No auth framework.**

- One `admin_users` row (email + argon2 hash). Login form posts to a server action; success sets an HTTP-only, Secure, SameSite=Lax cookie containing a short signed JWT (`jose`), ~7-day expiry.
- `middleware.ts` blocks `/admin/*` without a valid token; every server action re-verifies the session (middleware alone is not a security boundary).
- No OAuth, no password reset flow (admin resets via a CLI script), no public registration.

Why: the MVP has exactly one authenticated human. Auth.js/better-auth/Clerk buy nothing here but configuration surface and lock-in. ~80 lines of well-understood code is easier to audit than a framework used at 2% capacity. **Upgrade path:** when community submissions arrive, swap in **better-auth** (DB-session based, owns the same cookie); the `admin_users` table is already shaped like a users table with a role column away.

Risk to note: hand-rolled auth is a red flag *when it's complicated*. Keep it boring — one credential check, one signed cookie, constant-time comparison, rate-limited login action.

## Caching strategy

Three layers, all built into Next/Postgres — **no Redis**:

1. **Full-page static + ISR.** Fighter, event, bout, and division pages are statically generated with `revalidate = 3600` *and* tag-based on-demand revalidation: admin mutations call `revalidateTag('fighter:{id}')`, `revalidateTag('event:{id}')`, etc. Result: pages are CDN-fast, and admin edits appear within seconds without waiting out the hour.
2. **Data-level caching** via `unstable_cache`/`"use cache"` around hot shared queries (home page lists, division index) with the same tags.
3. **Postgres does the rest.** At MVP data volume (<10k bouts) every query is milliseconds with correct indexes.

Directory/search/filtered list pages render dynamically (they're parameterized) but their underlying queries are cheap. Add Redis only if/when there's measurable pressure — record the trigger condition in DECISIONS.md.

## Search strategy

**PostgreSQL-native search: `pg_trgm` for fuzzy name matching + a generated `tsvector` column for multi-field text search.** No Meilisearch/Typesense/Algolia.

- Fighter search must survive misspellings ("Gennadiy/Gennady Golovkin") and nicknames ("GGG", "Canelo") → trigram similarity over `fighters.full_name` **and** `fighter_aliases.alias`, GIN-indexed, ranked by `similarity()` with a floor threshold.
- Event search → `tsvector(name, venue, city)` with `websearch_to_tsquery`, plus trigram fallback.
- One `searchAll(q)` service returns grouped, capped results (top 5 fighters, top 5 events) for the header combobox; the full search page paginates each group.

Why: an external search engine is a second piece of infrastructure to deploy, sync, and pay for, to search a few thousand rows. Postgres trigram search is genuinely good at people's names. **Upgrade trigger:** if search latency exceeds ~100ms at p95 or we need faceting across >100k documents, move to Meilisearch — the search module's interface (`searchFighters(q, filters)`) is the seam.

## Image storage strategy

**Cloudflare R2 (S3-compatible) for originals; `next/image` for on-the-fly resizing/optimization.**

- Admin uploads via a server action → validated (type/dimensions/size) → stored in R2 under content-hash keys → DB stores the key plus **mandatory license metadata** (source, license, attribution text).
- Public delivery through `next/image` with R2's public bucket domain in `remotePatterns`; Vercel's optimizer handles WebP/AVIF and srcsets.
- Fighters without a licensed photo get a designed placeholder (initials on a division-colored gradient) — this must look intentional, since it will be the common case.

Why R2 over Vercel Blob or S3: zero egress fees (images are the main bandwidth cost), S3-compatible API (portable), generous free tier. Why not committing images to the repo: license metadata belongs in the DB, and the set will grow.

**Legal note:** almost all fight photography is rights-managed. Policy: Wikimedia Commons/openly-licensed images with attribution recorded per image, or no image. This is enforced by making license fields non-optional on upload.

## Deployment approach

**Vercel (app) + Neon (Postgres) + Cloudflare R2 (images). Local development on Docker Compose (Postgres 16 container only).**

- Vercel: zero-ops Next.js hosting, preview deployments per PR, built-in CDN/ISR support. Free/hobby tier suffices for a portfolio.
- Neon: serverless Postgres with branching (a DB branch per preview deployment is a great demo), free tier fits MVP volume. Drizzle connects via the Neon serverless driver in production and node-postgres locally.
- Migrations: `drizzle-kit generate` produces SQL migrations committed to the repo; applied to production via a CI step (GitHub Action) on merge to `main` — never auto-applied from the app at boot.
- Local dev: `docker compose up` starts Postgres; the app runs with `pnpm dev` on the host (fast HMR, no app container needed).

Alternative considered — single VPS with Docker Compose + Caddy: cheaper at scale and more "ops portfolio" credibility, but it adds patching, backups, and TLS to a one-person project. Rejected for MVP; revisit only if Vercel costs bite (they won't at this traffic).

Assumption: you have or will create free-tier accounts on Vercel, Neon, and Cloudflare.

## Important technical tradeoffs (summary)

| Decision | Chosen | Cost accepted | Escape hatch |
|---|---|---|---|
| App shape | Modular monolith in Next.js | Module discipline is by convention, not enforcement | ESLint import-boundary rules; extract modules later |
| ORM | Drizzle over Prisma | Slightly steeper learning curve | Both sit on plain SQL migrations (see DECISIONS.md) |
| Search | Postgres FTS + trgm | No facets, ceiling ~100k docs | Search module interface → Meilisearch |
| Cache | ISR + tags only | Careful tag hygiene needed | Add Redis behind service layer |
| Auth | Minimal custom admin session | We own ~80 lines of security code | Swap to better-auth for multi-user |
| Bout model | Two fighter FK columns | `OR` in history queries; two indexes | Migrate to participants table if per-fighter bout attributes multiply |
| API | RSC-direct reads + thin read-only `/api/v1` | Two entry points into query layer | Same service functions serve both |
| Data entry | Manual admin entry + `sources` abstraction | Content is slow to build | Ingestion adapters write through the same services |
