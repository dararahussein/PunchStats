# PunchStats — Roadmap

Eight vertical slices. Each slice ships something visible, touches database → backend → frontend → tests, and leaves `main` deployable. Order follows dependency and product value: the fighter lookup path (slices 1–3) is the product's spine and comes first.

**Testing stack (all slices):** Vitest for unit/service tests against a disposable Docker Postgres (real DB, no mocked ORM — schema behavior *is* what needs testing), Playwright for a small smoke suite of the money paths, and Zod schemas doubling as validation tests. CI: GitHub Actions running typecheck, lint, unit, and Playwright-on-preview.

**Model routing legend:** 🟢 = cheap/fast model (mechanical, well-specified, pattern-following) · 🔴 = strong reasoning model (design judgment, tricky correctness, security).

---

## Slice 1 — Foundation & database core

**Goal:** running skeleton: Next.js + Tailwind + shadcn + Drizzle + Dockerized Postgres + core schema + seed + a read-only fighter directory. **Full detail lives in [SLICE_1_FOUNDATION.md](SLICE_1_FOUNDATION.md)** — split into three independently-shippable sub-slices:

- **1A — Scaffold & local infra:** Next.js + Tailwind v4 + shadcn/ui init + fonts + Docker Compose Postgres + CI skeleton. No schema, no pages beyond a placeholder.
- **1B — Schema, migrations, fixtures, tests:** Drizzle schema for `weight_classes`, `fighters`, `fighter_aliases`, plus a generic `source_documents` + `entity_evidence` provenance model (not a `source_id` column per row — see the architecture note in SLICE_1_FOUNDATION.md, which supersedes ADR-005's row-level provenance for these tables). Fictional, deterministic dev fixtures only — real fighter data is explicitly deferred to a separate curated workflow. One integration-test strategy (CI Postgres service + local Compose test DB), no Testcontainers.
- **1C — Read-only fighter directory:** `listFighters()` query (no `getFighterBySlug`, no pagination yet) + a plain `/fighters` page reading seeded fixtures.

Vercel/Neon/R2 deployment, `pg_trgm`/`unaccent`/fuzzy search, and fighter-detail queries are deferred out of Slice 1 entirely (see SLICE_1_FOUNDATION.md's "Deferred work" section) — they land in Slices 2–3.

- **Acceptance:** `pnpm install && pnpm setup && pnpm dev` works from a fresh clone in <5 min and renders `/fighters`; migrations are generated (never hand-edited) and applied only via explicit `pnpm db:migrate`, never at app boot or a deploy hook.
- **Routing:** 🔴 schema/constraint design, migration review, CI Postgres wiring, first query function · 🟢 scaffold, tokens, CI skeleton, fictional fixture entry, page assembly.

## Slice 2 — Fighter search & directory

**Goal:** find any seeded fighter by fuzzy name; browse/filter the directory.

- **DB:** nothing new (indexes from slice 1 do the work).
- **Backend:** `searchFighters(q)` (trigram over names+aliases, ranked, threshold), `listFighters(filters, page)`; `/api/v1/fighters` + `/api/v1/search` route handlers with envelope, Zod param validation, error shape; per-IP rate limit on search.
- **Frontend:** `/fighters` directory (filter bar: division/status/nationality; paginated `FighterCard` grid; empty state), header search combobox (⌘K, debounced, grouped results, "matched on alias" hint), full `/search` page.
- **Tests:** unit — misspelling matches ("golovkn"→Golovkin), alias matches ("GGG"), threshold rejects garbage; API contract tests for envelope + validation errors; Playwright: type → click result → land on profile route.
- **Acceptance:** any seeded fighter findable within 3 keystrokes of a reasonable misspelling; search p95 < 100ms locally; directory URL state (filters/page) is shareable.
- **Routing:** 🔴 search ranking query + threshold tuning · 🟢 directory UI, filter bar, API handler boilerplate.

## Slice 3 — Fighter profile & fight history

**Goal:** the money page, complete.

- **DB:** migrations: `events`, `bouts`, `officials` (+constraints, history indexes); denormalized record columns on `fighters` + recompute service; seed grows to 2 divisions' top-10 with full recent histories (~50 fighters, ~400 bouts) — *the biggest data-entry task in the project; start it now, in parallel*.
- **Backend:** `getFighterProfile(slug)` (vitals, aliases, record), `getFightHistory(fighterId)` (both fighter columns, joined to events, newest first); record recompute invoked by bout writes (tested heavily); `/api/v1/fighters/{slug}` + `/bouts`.
- **Frontend:** full profile layout per DESIGN_SYSTEM.md (header band, vitals, history table with responsive card-collapse, provenance badges, generateMetadata + Person JSON-LD).
- **Tests:** record recompute unit matrix (win/loss/draw/NC/KO variants, result amendment); history ordering; Playwright: search → profile → tap opponent row → opponent profile (the core loop, on mobile viewport).
- **Acceptance:** profile Lighthouse ≥ 90 all categories; record math provably correct against seed; unknown vitals render "—"; every opponent name links onward.
- **Routing:** 🔴 recompute correctness + history query shape · 🟢 profile UI from the design spec, JSON-LD, seed entry.

## Slice 4 — Event directory & event pages

**Goal:** browsable events with full cards.

- **DB:** `events` search tsvector + index (table exists); seed: ~20 events wired to existing bouts.
- **Backend:** `listEvents(filters)`, `getEventCard(slug)` (bouts grouped by billing, ordered); events added to global search; `/api/v1/events*`.
- **Frontend:** `/events` (upcoming/past tabs, date+country filters), event page per design (header, card grouped by billing, result pills), SportsEvent JSON-LD.
- **Tests:** card ordering/grouping unit tests; date-filter boundary tests; Playwright: events → event → bout row → fight page route (stub OK until slice 5).
- **Acceptance:** completed events show results on every bout row; scheduled events show round counts; empty card state ("not yet announced") designed.
- **Routing:** 🟢 nearly all of it (patterns established in slices 2–3) · 🔴 only the search-integration ranking merge.

## Slice 5 — Fight pages & scorecards

**Goal:** richest page in the product; provenance and empty states prove themselves here.

- **DB:** migrations: `scorecards`, `scorecard_rounds`, `punch_stats`, `bout_result_revisions`, `sanctioning_bodies`, `titles`, `bout_titles`; seed: scorecards for all seeded decision bouts, one amended-result bout, titles for seeded champions.
- **Backend:** `getBoutDetail(id)` (everything: cards, titles, revisions, stats, records-before-fight *computed as of that date*); admin-side `amendResult` service writing revision + updating bout atomically; `/api/v1/bouts/{id}`.
- **Frontend:** fight page per design (tale of the tape, result banner, `ScorecardGrid`, knockdowns, punch-stat empty state, revisions timeline).
- **Tests:** records-before-fight correctness (subtle: excludes the bout itself and later bouts); amendResult transaction test (revision row + bout row + fighter records all consistent); scorecard totals vs. rounds mismatch warning; Playwright: fight page renders all sections for a decision bout and an overturned bout.
- **Acceptance:** a decision bout shows 3 judge totals; an overturned bout shows the timeline and corrected records everywhere; punch-stats section shows the designed empty state (table intentionally empty).
- **Routing:** 🔴 records-as-of-date query + amendment transaction · 🟢 page assembly, scorecard grid UI.

## Slice 6 — Division rankings

**Goal:** rankings with champions per division.

- **DB:** migrations: `rankings`, `title_reigns`; seed: current editorial top-10 + champions for 4 divisions.
- **Backend:** `getLatestRankings(division)`, `getChampions(division)` (open reigns), movement diff vs. previous snapshot; `publishRankingSnapshot` service (append-only, all-at-once validation: no duplicate fighters/ranks); `/api/v1/divisions*`.
- **Frontend:** rankings page per design (division chips, gender toggle, champion block, ranked table, as-of/methodology footer); title chips now live on profiles and fight pages too.
- **Tests:** snapshot append-only invariants; movement calculation (new entrant, dropout, swap); champion = open reign only.
- **Acceptance:** 4 divisions fully ranked with champions; movement arrows appear after publishing a second snapshot; every ranked row links to a profile.
- **Routing:** 🔴 snapshot/movement model review · 🟢 UI + API handlers.

## Slice 7 — Admin data-entry tools

**Goal:** stop editing seed files; enter data through the product. (Deliberately *after* public pages: hand-editing seed data was acceptable while page shapes were still moving, and building admin against stable models avoids rework. Cost accepted: seed-file editing until now.)

- **DB:** `admin_users` migration + CLI script to create/reset the admin.
- **Backend:** auth (login action, argon2, signed cookie, middleware, per-action assertion, login rate limit); the full server-action catalog from API.md with Zod schemas, transactions, `revalidateTag` wiring; `pnpm db:audit` invariant script.
- **Frontend:** `/admin` — dashboard, fighter/event/bout/scorecard/rankings forms (shadcn Form), the event-card composer (add bouts, reorder, set billing), amend-result flow with required reason, photo upload with mandatory license fields.
- **Tests:** 🔴 auth tests (wrong password, expired cookie, tampered cookie, action called without session); action validation tests; Playwright: log in → create event with 2 bouts → record result + scorecards → verify public pages updated (tag revalidation proof).
- **Acceptance:** full event card entered via UI in <20 min; public pages reflect edits in <10s; every form requires source + verification status; unauthenticated access to any action fails closed.
- **Routing:** 🔴 all auth code + transaction/revalidation wiring · 🟢 form UIs (repetitive, schema-driven).

## Slice 8 — Performance, SEO, accessibility, polish

**Goal:** portfolio-grade final pass.

- **DB:** `EXPLAIN ANALYZE` pass on hot queries at full seed volume; fix regressions (e.g., add `bout_date` denormalization only if measured as needed).
- **Backend:** ISR/tag audit (every page cached as designed, every action revalidates completely), sitemap.xml, robots.txt, OG-image generation route (fighter record cards — high-impact shareable polish).
- **Frontend:** skeleton states everywhere, `not-found`/`error` pages, reduced-motion audit, keyboard/screen-reader pass (axe + manual NVDA run), 200% zoom check, mobile nav polish.
- **Tests:** Lighthouse CI budget in GitHub Actions (≥90 all categories on fighter/event/fight pages) so polish can't silently regress; axe automated checks in Playwright.
- **Acceptance:** PRODUCT.md success criteria all pass; content: 4 divisions fully populated; a stranger can complete the core loop on a phone without instruction.
- **Routing:** 🔴 caching audit + perf diagnosis · 🟢 sitemap, OG route, skeleton fills, axe fixes.

---

## Model-routing summary

**Give the cheap model:** scaffolding, seed-data entry files, UI assembly from DESIGN_SYSTEM.md specs, API handler boilerplate after slice 2 establishes the pattern, form building in slice 7, sitemap/OG/skeleton work. These have exact specs and existing patterns to copy.

**Give the strong model:** schema migrations and constraint design (slices 1, 3, 5), search ranking (2), record recompute + records-as-of-date (3, 5), the amendment transaction (5), everything auth (7), caching/revalidation correctness (7, 8). These are where subtle bugs are expensive and specs can't fully anticipate the edge cases.

**Rule of thumb:** the first instance of any pattern goes to the strong model; repetitions go to the cheap one, referencing the first as the exemplar.
