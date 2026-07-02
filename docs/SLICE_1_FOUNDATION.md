# Slice 1 — Foundation & Database Core

**Goal:** Prove the stack works end-to-end with the smallest possible surface area. Split into three independently-shippable sub-slices so each can be handed to a coding model as a self-contained task without the model needing to hold the whole foundation in its head at once.

**Architecture note (read before starting 1B):** [DATABASE.md](DATABASE.md) and [ADR-013](DECISIONS.md) (which supersedes ADR-005) now define the canonical provenance model — `source_documents` plus per-domain evidence tables (`fighter_evidence` is the first, built in this slice), replacing the original single `source_id` + `verification_status` column that used to sit directly on `fighters`, `events`, `bouts`, etc. Slice 1B below has been updated to match that canonical model exactly; DATABASE.md is the source of truth if the two ever drift.

**Versioning note:** No package versions are pinned anywhere in this document. Run the install commands as written, let the package manager resolve the current stable release, and commit the resulting lockfile. Record actual installed versions in `package.json` / `pnpm-lock.yaml`, not in prose docs that will rot.

---

## Slice 1A — Application scaffold and local infrastructure

**Goal:** A running Next.js app with Tailwind, shadcn/ui, and a local Postgres container — no database schema, no queries, no pages beyond the default scaffold. Proves the toolchain boots.

### Tasks

1. **Scaffold Next.js.**
   ```bash
   pnpm create next-app
   ```
   Choose: TypeScript — yes. ESLint — yes. Tailwind — yes. `src/` directory — yes. App Router — yes. **Accept the default `@/*` import alias** (do not reject it or hand-roll a different alias scheme).

2. **Initialize shadcn/ui.**
   ```bash
   pnpm dlx shadcn@latest init
   ```
   Choose the dark base style. Do **not** add any components yet (`shadcn add button`, etc.) — components are added in whichever later slice first needs them. Initializing without using anything is enough to prove the CLI and `components.json` wiring work.

3. **Set design tokens — Tailwind v4 conventions.**
   Do **not** create `tailwind.config.ts`. Tailwind v4 (the version `create-next-app` currently scaffolds) configures theme via CSS, not a JS config file. In `src/app/globals.css`, after the `@import "tailwindcss";` line, add an `@theme` block declaring the palette from [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) ("Tokens" section) — background, surface, border, foreground, accent, gold, win/loss/draw/nc colors. This is the only place theme colors are declared.

4. **Wire fonts via built-in `next/font`.**
   No extra package (do not install `@next/font` — it's been merged into Next.js core). Create `src/lib/fonts.ts`:
   ```ts
   import { Space_Grotesk, Inter } from "next/font/google";

   export const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });
   export const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
   ```
   Apply both font variables to the `<html>` or `<body>` className in `src/app/layout.tsx`.

5. **Local Postgres via Docker Compose.**
   Create `docker-compose.yml` at the repo root running Postgres 16, with an init-script mount that creates a second database for tests inside the same container (avoids running two containers):
   ```yaml
   services:
     postgres:
       image: postgres:16-alpine
       environment:
         POSTGRES_DB: punchstats
         POSTGRES_PASSWORD: dev
       ports:
         - "5432:5432"
       volumes:
         - punchstats-db:/var/lib/postgresql/data
         - ./docker/init:/docker-entrypoint-initdb.d
   volumes:
     punchstats-db:
   ```
   Create `docker/init/01-create-test-db.sql`:
   ```sql
   CREATE DATABASE punchstats_test;
   ```

6. **Environment variables.**
   Create `.env.example` with exactly two variables — nothing speculative:
   ```
   DATABASE_URL=postgresql://postgres:dev@localhost:5432/punchstats
   DATABASE_URL_TEST=postgresql://postgres:dev@localhost:5432/punchstats_test
   ```

7. **Package scripts.**
   In `package.json`, at this stage only the scripts `create-next-app` already gave you (`dev`, `build`, `start`, `lint`) plus:
   ```json
   "type-check": "tsc --noEmit"
   ```

8. **CI skeleton — designed to be extended, not replaced.**
   Create `.github/workflows/ci.yml` with install/typecheck/lint/build only. **1B and 1C will add steps to this same file** (Postgres service, migrate, seed, test) — write it now so those additions are appends, not rewrites:
   ```yaml
   name: CI
   on: [push, pull_request]
   jobs:
     ci:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: pnpm/action-setup@v4
         - uses: actions/setup-node@v4
           with:
             node-version: "22"
             cache: "pnpm"
         - run: pnpm install --frozen-lockfile
         - run: pnpm type-check
         - run: pnpm lint
         - run: pnpm build
   ```

9. **Leave the default scaffold page in place** (`src/app/page.tsx`), stripped down to a one-line placeholder (e.g. `<p>PunchStats</p>`) using the new fonts/tokens — just enough to visually confirm fonts and dark theme are applied. The real `/fighters` page is built in 1C.

### Acceptance criteria — 1A

- ✅ `pnpm dev` starts the app and renders the placeholder page in the dark theme with both fonts loading (verify via browser devtools computed font-family).
- ✅ `docker compose up -d` starts Postgres; `psql $DATABASE_URL -c '\l'` (or equivalent) shows both `punchstats` and `punchstats_test` databases exist.
- ✅ `pnpm type-check`, `pnpm lint`, and `pnpm build` all pass locally and in CI.
- ✅ No `tailwind.config.ts` file exists; no `@next/font` dependency exists; no database schema, ORM, or query code exists yet.

### Files touched — 1A

`package.json`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/lib/fonts.ts`, `components.json`, `docker-compose.yml`, `docker/init/01-create-test-db.sql`, `.env.example`, `.github/workflows/ci.yml`

### Model routing — 1A

🟢 **Cheap model:** the entire sub-slice. Scaffolding, token transcription from DESIGN_SYSTEM.md, Docker Compose, CI skeleton — all mechanical, well-specified, low-consequence-if-wrong (nothing here touches data).

---

## Slice 1B — Database schema, migrations, fixtures, and tests

**Goal:** A Postgres schema for reference/directory data, generated migrations, fictional test fixtures, and integration tests proving the constraints hold. No application query layer yet (that's 1C).

### The provenance model for this slice

Follows the canonical model in [DATABASE.md](DATABASE.md#provenance-and-evidence-model-cross-cutting) (ADR-013 in DECISIONS.md) exactly — summarized here for the implementer. Two tables:

```
source_documents
  id             uuid primary key
  publisher      text not null        -- "Nevada Athletic Commission", "Wikimedia Commons", "PunchStats Editorial"
  title          text
  url            text                 -- nullable; some sources have none
  source_type    source_type not null -- enum: official | media_report | editorial | user_submission | licensed_feed
  published_at   date
  retrieved_at   date
  license_name   text
  license_url    text
  license_notes  text                 -- required (app-enforced) for licensed_feed sources and any image
  archived_url   text                 -- Wayback Machine / archive.today snapshot
  created_at     timestamptz not null default now()
  updated_at     timestamptz not null default now()

fighter_evidence
  id                   uuid primary key
  fighter_id           uuid not null references fighters(id) on delete cascade
  field_name           text                 -- NULL = whole-fighter claim; else e.g. 'birth_date', 'reach_cm'
  source_document_id   uuid not null references source_documents(id)
  source_value         text                 -- the value as that source reported it, verbatim
  verification_status  verification_status not null default 'unverified'  -- enum: verified | unverified | user_submitted | disputed
  confidence           confidence_level not null  -- enum: high | medium | low — NO default, every insert must choose explicitly
  notes                text
  verified_by          text                 -- audit snapshot of the reviewer's name at the time, not an identity reference; no admin_users table exists until Slice 7
  verified_at          timestamptz
  created_at           timestamptz not null default now()
  updated_at           timestamptz not null default now()
```

Indexes: `fighter_evidence (fighter_id)` and `fighter_evidence (source_document_id)`.

`confidence` definitions (put these in the Drizzle enum's inline comment and in any admin form help text later): `high` = supported by an authoritative or directly verifiable source; `medium` = supported by a credible secondary source or partially corroborated information; `low` = uncertain, conflicting, incomplete, or awaiting confirmation. Kept distinct from `verification_status`: confidence is about evidence quality, verification status is about editorial review workflow.

**Important — this is `fighter_evidence`, not a generic `entity_evidence` table.** DATABASE.md explicitly rejects a shared polymorphic table with `entity_type`/`entity_id` columns, because Postgres can't enforce a real foreign key across such a pair (no referential integrity, no cascade delete). Instead, each Tier 2 entity gets its own evidence table with a real FK — `fighter_evidence` is the first and, for Slice 1B, only one (since `fighters` is the only Tier 2 entity that exists yet). `bout_evidence`/`event_evidence` follow the identical shape when those tables ship in Slices 4–5 — not built now.

This means **`fighters` and `weight_classes` carry no `source_id` or `verification_status` columns at all** — provenance for fighters is looked up via `fighter_evidence`, not embedded on the row (`weight_classes` needs no provenance at all — it's sport-rule reference data, not a sourced fact). For Slice 1B, fixtures need not populate `fighter_evidence` exhaustively (they're fictional data with nothing to cite) — one or two example rows are enough to prove the join and the constraint shape work. Real coverage arrives with real data, later.

### Tasks

1. **Add dependencies.**
   ```bash
   pnpm add drizzle-orm postgres
   pnpm add -D drizzle-kit
   ```

2. **Configure Drizzle.** Create `drizzle.config.ts` at the repo root pointing at `src/db/schema/index.ts` and outputting to `src/db/migrations/`, dialect `postgresql`, credentials from `DATABASE_URL`.

3. **Define schema** in `src/db/schema/`:
   - `enums.ts` — `sourceType`, `verificationStatus`, `confidenceLevel`, `fighterPublicationStatus` (`draft`/`published`/`archived`), `weightClassGenderEnum`, `fighterStanceEnum`, `fighterStatusEnum`, `fighterAliasKindEnum`, all shared across the files below.
   - `source-documents.ts` — table above.
   - `fighter-evidence.ts` — table above. Named for the one entity it covers — **not** a generic `entity-evidence.ts` (see the "Important" note above for why).
   - `weight-classes.ts` — `id`, `slug` (unique), `name`, `gender` enum, `limit_lbs` (numeric, nullable — heavyweight has no cap), `sort_order` (smallint). No provenance columns.
   - `fighters.ts` — `id`, `slug` (unique), `full_name`, `nickname` (nullable), `birth_date` (nullable), `nationality` (char(2), nullable), `stance` enum (nullable), `height_cm`/`reach_cm` (smallint, nullable), `status` enum, `primary_weight_class_id` (fk → weight_classes, nullable), **`publication_status` enum (`draft`/`published`/`archived`, NOT NULL, default `'draft'`)**, `created_at`/`updated_at`. **No source/verification columns** — see provenance model above. No record-count columns yet (those depend on bouts, which don't exist until Slice 3) — do not add them prematurely. `publication_status` is unrelated to `status` (career state) — see DATABASE.md's note that these answer two different questions.
   - `fighter-aliases.ts` — `id`, `fighter_id` (fk, cascade delete), `alias`, `kind` enum (`nickname`/`ring_name`/`spelling_variant`/`birth_name`), `source_document_id` (fk → source_documents, nullable), `verification_status` enum (default `'unverified'`), unique constraint on `(fighter_id, lower(alias))`. Tier 1 (atomic fact) — direct columns, no separate evidence table.
   - `index.ts` — barrel re-exporting all tables and enums.

4. **Generate the migration.**
   ```bash
   pnpm drizzle-kit generate
   ```
   This produces the initial SQL migration in `src/db/migrations/`. **Do not hand-edit the generated file.** There is no handwritten SQL needed in this slice (no extensions, no custom indexes — those are Slice 2's job). If a future slice needs raw SQL alongside Drizzle-managed tables, use `pnpm drizzle-kit generate --custom --name=<description>` to create a separate migration file rather than editing a generated one.

5. **Apply migrations explicitly.**
   Add to `package.json`:
   ```json
   "db:generate": "drizzle-kit generate",
   "db:migrate": "drizzle-kit migrate"
   ```
   Do **not** run migrations from `drizzle-kit push` (that diffs and applies directly, bypassing the committed SQL files this project relies on for auditability). Do **not** run migrations automatically from app boot, middleware, or a Vercel `postbuild` hook — always an explicit, deliberate `pnpm db:migrate` invocation, run once per environment change.

6. **Create the DB client.** `src/db/client.ts`:
   ```ts
   import { drizzle } from "drizzle-orm/postgres-js";
   import postgres from "postgres";

   const connectionString = process.env.DATABASE_URL!;
   export const db = drizzle(postgres(connectionString));
   ```
   (Swapping to Neon's serverless driver for production is a later, deployment-slice concern — not needed here, don't build for it now.)

7. **Fictional dev/test fixtures — explicitly not real fighters.**
   Create `src/db/fixtures/dev/`:
   - `weight-classes.ts` — the 17 real men's divisions with their real weight limits. This is sport-rule reference data (objective, uncontested, not a "fighter fact"), not the kind of data this rule is protecting against — seed it for real.
   - `fighters.ts` — **fictional** fighters only: e.g. `"Test Fighter One"` / slug `test-fighter-1`, `"Jane Example"` / slug `jane-example-boxer`, with made-up but internally-consistent vitals (birth dates, stances, divisions). Use deterministic fixed UUIDs (not `gen_random_uuid()` at insert time) so tests can assert against known IDs. **Include at least one fighter in each `publication_status`:** one left as `draft` (the default — no evidence needed), and one set to `published` (this one must have a qualifying `fighter_evidence` row — see below — since the seed script should call `publishFighter` for it, not just set the column directly, to exercise the real code path).
   - `fighter-aliases.ts` — one or two fictional aliases per fixture fighter (e.g. "Test Fighter One" → alias "TF1"), optionally citing the fixture source document below.
   - `source-documents.ts` / `fighter-evidence.ts` — one or two example rows (e.g. a fake "Test Commission Report" source, one `fighter_evidence` row citing it for the fixture fighter that will be published — `verification_status: 'verified'`, `confidence` explicitly set — enough to satisfy the publish eligibility rule) — enough to prove the join and the invariant work, not exhaustive.
   - A top-level comment in this folder: `// Fictional data for local development and automated tests. Do not add real fighters here — see docs/SLICE_1_FOUNDATION.md.`
   - Create `src/db/fixtures/production/` as an **empty folder with a `README.md` stub** stating: "Real, source-reviewed fighter data goes here once the data-entry and provenance workflow is finalized (post-MVP-foundation). Not populated during Slice 1."

8. **Publication-state service functions.** Create `src/db/services/fighter-publication.ts` implementing the invariant specified in [DATABASE.md](DATABASE.md#resolving-the-missing-citation-invariant-fighter-publication-state):
   - `publishFighter(fighterId: string)` — in one transaction: query `fighter_evidence` for at least one row with `fighter_id = $1 AND verification_status = 'verified'`; if none, return a typed failure and roll back; if found, `UPDATE fighters SET publication_status = 'published' WHERE id = $1`.
   - `deleteFighterEvidence(evidenceId: string)` — in one transaction: look up the evidence row's `fighter_id`, delete it, then check whether any qualifying (`verified`) evidence rows remain for that fighter; if none remain **and** the fighter is currently `published`, `UPDATE fighters SET publication_status = 'draft'` in the same transaction.
   - Both functions live in `src/db/`, not `src/modules/`, since this is a database-invariant concern owned by the schema, not a "fighters module" query — Slice 1B still ships no application query layer (that stays 1C's job).
   - This task is the one place Slice 1B does more than schema/migrations/fixtures — flagged as an intentional, narrow exception because the invariant is fundamentally a write-time data-integrity rule, not a read concern.

9. **Seed script.** `src/db/seed.ts` imports the dev fixtures and inserts them via the client (weight classes → fighters → aliases → source documents → evidence, in FK order), then calls `publishFighter` for the fixture fighter designated `published` (rather than inserting `publication_status = 'published'` directly), so the seed script itself exercises the real invariant. Add to `package.json`:
   ```json
   "db:seed": "tsx src/db/seed.ts"
   ```

10. **Integration tests — one strategy only.**
    Use the GitHub Actions Postgres service container (already available in CI) plus a dedicated local test database (`punchstats_test`, created by the Docker Compose init script from 1A) for local runs. **Do not introduce Testcontainers** — it duplicates what the Compose init script and CI service already provide, at the cost of a Docker-socket dependency and slower tests.

    Configure `vitest.config.ts` to load `DATABASE_URL_TEST` for any test file under `src/db/`.

    Write `src/db/schema.test.ts`:
    - Inserting a weight class, then a fighter referencing it, succeeds.
    - Inserting a fighter alias with a duplicate `(fighter_id, lower(alias))` pair fails (unique constraint).
    - Deleting a fighter cascades to its aliases **and** to its `fighter_evidence` rows (both have `ON DELETE CASCADE` to `fighters`).
    - Inserting `fighter_evidence` referencing a nonexistent `source_document_id` fails (FK constraint).
    - Inserting `fighter_evidence` referencing a nonexistent `fighter_id` fails (FK constraint) — this is the referential-integrity guarantee the rejected generic `entity_type`/`entity_id` design couldn't provide.
    - Inserting `fighter_evidence` without an explicit `confidence` value fails (`NOT NULL`, no default).
    - A new fighter defaults to `publication_status = 'draft'` when not specified.
    - Each test cleans up its own rows (transaction rollback per test, or truncate in `afterEach`) so tests are independent of fixture/seed state.

    Write `src/db/services/fighter-publication.test.ts` (the invariant itself — this is the test coverage the plan's approval explicitly asked for):
    - Creating a draft fighter with zero `fighter_evidence` rows succeeds (plain insert, no service function needed).
    - `publishFighter` on a fighter with no qualifying evidence fails, and `publication_status` remains `'draft'`.
    - `publishFighter` on a fighter with one `verified` evidence row succeeds, and `publication_status` becomes `'published'`.
    - `deleteFighterEvidence` removing a published fighter's *only* qualifying evidence row reverts `publication_status` to `'draft'` in the same transaction.
    - `deleteFighterEvidence` removing one of *several* qualifying evidence rows leaves `publication_status` as `'published'` (only reverts when the last one goes).
    - `deleteFighterEvidence` on a non-qualifying (e.g. `unverified`) evidence row belonging to a published fighter that still has other qualifying evidence does not change `publication_status`.

11. **Extend CI.** Add to the existing `.github/workflows/ci.yml` job: a `postgres:16-alpine` service container, then after `pnpm build`:
    ```yaml
        services:
          postgres:
            image: postgres:16-alpine
            env:
              POSTGRES_PASSWORD: dev
              POSTGRES_DB: punchstats_test
            ports: ["5432:5432"]
            options: >-
              --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
        steps:
          # ...existing steps...
          - run: pnpm db:migrate
            env:
              DATABASE_URL: postgresql://postgres:dev@localhost:5432/punchstats_test
          - run: pnpm test
            env:
              DATABASE_URL_TEST: postgresql://postgres:dev@localhost:5432/punchstats_test
    ```
    Note CI only needs one database (`punchstats_test`) since it isn't running the dev server — don't replicate the two-database Compose setup here.

### Acceptance criteria — 1B

- ✅ `pnpm db:generate` produces a committed, human-readable SQL migration with no hand-edits.
- ✅ `pnpm db:migrate` applies cleanly to a fresh `punchstats_test` database.
- ✅ `pnpm db:seed` populates fictional fixtures without error.
- ✅ `pnpm test` (schema tests) passes locally and in CI against the Postgres service container.
- ✅ `fighters` and `weight_classes` carry no `source_id`/`verification_status` columns — fighter provenance is only reachable via `fighter_evidence`, with a real FK to `fighters(id)` (not a generic `entity_type`/`entity_id` pair).
- ✅ `src/db/fixtures/dev/` contains zero real fighter names; `src/db/fixtures/production/` exists but is empty except its README stub.
- ✅ A draft fighter can be created with zero `fighter_evidence` rows.
- ✅ `publishFighter` fails on a fighter with no qualifying (`verified`) evidence, and succeeds once one exists.
- ✅ `deleteFighterEvidence` reverts a published fighter to `draft` when its last qualifying evidence row is removed, and leaves other published fighters with remaining qualifying evidence untouched.
- ✅ No Postgres CHECK constraint or trigger enforces the publish invariant in Slice 1B — it is service-layer only, by design (see DATABASE.md/ADR-014).

### Files touched — 1B

`drizzle.config.ts`, `src/db/schema/*.ts`, `src/db/migrations/*` (generated), `src/db/client.ts`, `src/db/services/fighter-publication.ts`, `src/db/services/fighter-publication.test.ts`, `src/db/fixtures/dev/*.ts`, `src/db/fixtures/production/README.md`, `src/db/seed.ts`, `src/db/schema.test.ts`, `vitest.config.ts`, updates to `package.json` and `.github/workflows/ci.yml`

### Model routing — 1B

🔴 **Strong model:** schema definition (constraints, FKs, enum shapes, the evidence-table design), the `fighter-publication.ts` transaction logic (the auto-revert-on-delete case is easy to get subtly wrong), migration review before committing, the CI Postgres wiring, and the constraint-violation tests (getting these subtly wrong defeats their purpose).
🟢 **Cheap model:** fictional fixture data entry (once the schema shape is fixed), the seed script's mechanical insert-in-order logic, the `production/README.md` stub.

---

## Slice 1C — First read-only fighter directory

**Goal:** One query function, one page. Proves the app can read from the database and render it — the actual point of Slice 1.

### Tasks

1. **Query function.** `src/modules/fighters/queries.ts`:
   ```ts
   export async function listFighters() {
     // WHERE publication_status = 'published' -- draft/archived fighters never reach a public query
     // join fighters -> weight_classes, order by full_name
     // return { slug, fullName, nickname, divisionName, divisionSlug, status }[]
   }
   ```
   **No `getFighterBySlug`** — there's no fighter detail page yet (that's Slice 3); don't build a query with no caller. **No pagination parameters** — with a handful of fixtures, return them all; pagination is explicitly deferred (Slice 2 territory, once the directory has filters worth paginating). **The `publication_status = 'published'` filter is not optional** — this is the read-side half of the invariant Slice 1B's `publishFighter`/`deleteFighterEvidence` enforce on the write side (see [DATABASE.md](DATABASE.md#resolving-the-missing-citation-invariant-fighter-publication-state)); a public query with no filter would defeat the whole point of the `draft` state.

2. **Query test.** `src/modules/fighters/queries.test.ts`, using `DATABASE_URL_TEST` and the seeded fixtures from 1B: asserts `listFighters()` returns the known fictional fixtures, correctly joined to their division names, in the expected order. Assert against the deterministic fixture data (names, slugs) established in 1B — not against real fighters. **Include a case proving the filter works:** with the 1B fixture set containing at least one `draft` and one `published` fighter, `listFighters()` must return the published one and must **not** return the draft one.

3. **Page.** `src/app/fighters/page.tsx` — a server component calling `listFighters()` and rendering a plain list (name, nickname, division). No `FighterCard` component, no table styling, no images, no empty/loading/error states beyond what Next.js gives for free — those are design-system-slice concerns. Enough markup to be legible, not to be polished.

4. **Home page link.** Update `src/app/page.tsx` (still just the placeholder from 1A) to add a single link to `/fighters` so the directory is reachable.

5. **One-command setup + docs.** Add to `package.json`:
   ```json
   "setup": "docker compose up -d && pnpm db:migrate && pnpm db:seed"
   ```
   Add a short `README.md` "Getting started" section: `pnpm install && pnpm setup && pnpm dev`, then visit `/fighters`.

6. **Final CI extension.** No new CI infrastructure needed — `pnpm test` (already wired in 1B) now also picks up `queries.test.ts`. Confirm the full pipeline (install → typecheck → lint → build → migrate → seed-equivalent-for-tests → test) is green end to end.

### Acceptance criteria — 1C

- ✅ Fresh clone → `pnpm install && pnpm setup && pnpm dev` → `/fighters` renders the **published** fictional fixture fighter(s) with their divisions, in under 5 minutes.
- ✅ `listFighters()` has a passing integration test against real Postgres (not mocked), including the case that a `draft` fixture fighter is present in the database but absent from the returned list.
- ✅ No `getFighterBySlug`, no pagination UI, no search input, no fighter photos/avatars exist yet.
- ✅ CI is green end-to-end, including the new query test.

### Files touched — 1C

`src/modules/fighters/queries.ts`, `src/modules/fighters/queries.test.ts`, `src/app/fighters/page.tsx`, `src/app/page.tsx`, `README.md`, `package.json`

### Model routing — 1C

🔴 **Strong model:** the query function and its join logic, the integration test (the join is simple but is the first real precedent later query modules will copy — worth getting right deliberately).
🟢 **Cheap model:** the page component, the home-page link, the README update.

---

## Deferred work (explicitly out of scope for all of Slice 1)

- Vercel, Neon, Cloudflare R2, and any production deployment wiring
- `pg_trgm`, `unaccent`, the immutable-unaccent wrapper function, GIN trigram indexes, fuzzy/typo-tolerant search, and any `EXPLAIN`-based index-usage tests — all Slice 2 (Search)
- `getFighterBySlug` and any fighter detail/profile page — Slice 3
- Pagination, filtering, or sorting of any kind
- Real fighter data of any kind, in any table — a separate curated data-entry workflow starts once the provenance model in DATABASE.md is used for real citations, not just fictional fixtures
- shadcn components beyond `init` (Button, Card, Table, Combobox, etc.) — added on-demand when a feature first needs them
- Testcontainers, or any second integration-test strategy alongside the Postgres CI service
- Authentication, server actions, and any `/api/v1` routes
- Bout, event, scorecard, punch-stat, title, or ranking tables (and their eventual `bout_evidence`/`event_evidence` companions) — everything not `weight_classes`/`fighters`/`fighter_aliases`/`source_documents`/`fighter_evidence`
- Styling polish, responsive design, loading/empty/error states, images or avatars
- Populating `src/db/fixtures/production/`
- A per-field publish-eligibility rule (e.g. requiring birth date *and* nationality to each carry verified evidence before publishing) — Slice 1B ships only the single-verified-row bar; see ADR-014's revisit triggers
- A Postgres trigger or CHECK constraint enforcing the publish invariant at the database level — recorded in DATABASE.md/ADR-014 as a future hardening step, not built now
- Any admin UI for publishing a fighter or managing `archived` status — Slice 1B ships the service functions only; Slice 7 builds the admin forms that call them

---

## Combined acceptance criteria (Slice 1, all sub-slices)

- ✅ `pnpm install && pnpm setup && pnpm dev` on a fresh clone renders `/fighters` with seeded fictional data in under 5 minutes.
- ✅ CI (`.github/workflows/ci.yml`) runs install → type-check → lint → build → migrate → test on every push, fully green.
- ✅ Every migration in `src/db/migrations/` is generated (`drizzle-kit generate`), committed, human-auditable, and never hand-edited.
- ✅ `fighters` (the one Tier 2 entity in scope) carries no `source_id`/`verification_status` pair implying one source explains a whole row; its provenance is reachable only via `fighter_evidence`, with a real FK to `fighters(id)` — not a generic polymorphic table.
- ✅ No fighter can be publicly visible without at least one `verified` `fighter_evidence` row: `publishFighter` enforces this on the write side, `listFighters()` enforces it on the read side by filtering to `publication_status = 'published'`, and both are covered by integration tests.
- ✅ Every `fighter_evidence` row has an explicit `confidence` (`high`/`medium`/`low`) — no row is created with confidence unset.
- ✅ Zero real fighter names, records, or biographical facts exist anywhere in the repository (fixtures or otherwise). Real weight-class definitions are the one deliberate exception (sport rules, not fighter facts).
- ✅ Migrations never run automatically from app boot or a deploy hook — only via explicit `pnpm db:migrate`.
- ✅ Exactly one integration-test strategy is in use (CI Postgres service + local Compose test database) — no Testcontainers.
- ✅ No Postgres trigger or CHECK constraint enforces the publish invariant — Slice 1B enforces it entirely in the service layer, by design.
- ✅ The codebase shape (`src/modules/fighters/queries.ts`, `src/db/schema/*`, `src/db/services/*`, fixture/production split) is ready for Slice 2 to extend without rework.

---

## Model routing (summary across 1A–1C)

| Task type | Model |
|---|---|
| Scaffolding, config files, Docker Compose, CI skeleton | 🟢 Cheap |
| Design-token transcription from DESIGN_SYSTEM.md | 🟢 Cheap |
| Fictional fixture data entry (once schema is fixed) | 🟢 Cheap |
| Page components, README updates, home-page link | 🟢 Cheap |
| Schema design: constraints, FKs, enums, evidence-table shape | 🔴 Strong |
| Migration review before commit | 🔴 Strong |
| CI Postgres service wiring | 🔴 Strong |
| Constraint-violation and cascade-delete tests | 🔴 Strong |
| First query function + its integration test (sets the precedent) | 🔴 Strong |
| `fighter-publication.ts` transaction logic + its tests (the auto-revert-on-delete case) | 🔴 Strong |

**Rule of thumb carried over from ROADMAP.md:** the first instance of a pattern goes to the strong model; once a pattern is established (e.g., the second query module in Slice 2), repetitions can go to the cheap model.

---

## Risk checklist

- ⚠️ **Keep DATABASE.md and this doc in sync going forward:** DATABASE.md and [ADR-013](DECISIONS.md) are now the canonical source for the provenance model (`source_documents` + per-domain evidence tables, `fighter_evidence` first). If either changes later, update the other in the same pass — this is exactly the kind of drift that caused the original entity-type/entity-id sketch here to briefly diverge from what DATABASE.md ended up specifying.
- ⚠️ **`drizzle-kit generate` vs `migrate` vs `push` confusion:** a coding model defaulting to `push` from habit will silently bypass the auditable-migration requirement. Call this out explicitly in any prompt handed off for 1B.
- ⚠️ **Fixture drift toward real data:** it's tempting for a coding model to "improve" fictional fixtures by making them resemble real fighters for realism. Explicitly forbid this in task prompts; review fixture files for real names before merging.
- ⚠️ **Two-database Compose setup only matters locally:** CI only ever needs `punchstats_test` (no app boot, no dev database) — don't over-port the local two-database init script into CI.
- ⚠️ **`fighter_evidence` has exactly one consumer in Slice 1B:** `publishFighter`'s eligibility check. No UI reads it yet (provenance badges are a later slice). That's fine — it's not dead code, just not fully exercised — but don't be surprised the query surface is thin.
- ⚠️ **Don't reintroduce the polymorphic pattern by accident:** when `bout_evidence`/`event_evidence` are added in later slices, copy `fighter_evidence`'s shape (a real FK per table) — not a shared `entity_type`/`entity_id` table, which DATABASE.md explicitly rejects (see ADR-013).
- ⚠️ **The publish invariant is a service-layer convention, not a database guarantee:** a direct `UPDATE fighters SET publication_status = 'published'` bypassing `publishFighter` isn't stopped by Postgres in Slice 1B (see ADR-014). Acceptable now because all writes already go through the service layer by project convention — but don't let a later slice add a bulk-import or admin bypass that writes `fighters` directly without noticing this gap.
- ⚠️ **Seed script must call `publishFighter`, not set the column directly:** if `src/db/seed.ts` inserts a fixture fighter with `publication_status: 'published'` hardcoded rather than calling the service function, the seed script stops being a real test of the invariant — it would still "work" today but silently stop catching a regression in `publishFighter` itself.
- ⚠️ **Windows/Docker Desktop path quirks:** if `docker compose up -d` fails to mount `./docker/init`, check for Windows path translation issues (WSL2 backend is more forgiving than Hyper-V).
- ⚠️ **CI workflow file is edited three times (1A, 1B, 1C):** write it in 1A anticipating appends (comments marking where later steps will go) so 1B/1C tasks don't need to restructure it.
