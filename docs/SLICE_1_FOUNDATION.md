# Slice 1 — Foundation & Database Core

**Goal:** Prove the stack works end-to-end with the smallest possible surface area. Split into three independently-shippable sub-slices so each can be handed to a coding model as a self-contained task without the model needing to hold the whole foundation in its head at once.

**Architecture note (read before starting 1B):** This revision changes the provenance model described in [DATABASE.md](DATABASE.md) and ADR-005 in [DECISIONS.md](DECISIONS.md). The original design put a single `source_id` + `verification_status` column directly on `fighters`, `weight_classes`, etc. — implying one source explains an entire row. That's wrong: a fighter's birth date, reach, and nationality routinely come from different places. Slice 1B replaces that with a generic `source_documents` + `entity_evidence` model (detailed below). **DATABASE.md and ADR-005 need a follow-up edit to match** — flagged here, not done in this pass, since this document is scoped to Slice 1 only.

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

Two tables carry provenance for everything else, instead of a `source_id` column bolted onto every content table:

```
source_documents
  id              uuid primary key
  publisher       text not null        -- "Nevada Athletic Commission", "Wikimedia Commons"
  title           text
  url             text
  published_at    date
  retrieved_at    date
  license         text                 -- required for anything image/media-related
  notes           text
  created_at      timestamptz not null default now()

entity_evidence
  id                    uuid primary key
  entity_type           text not null       -- "fighter", "weight_class", "fighter_alias" (extend later)
  entity_id             uuid not null       -- no FK — deliberately generic across entity types
  field_name            text not null       -- "birth_date", "reach_cm", "nationality"
  source_document_id    uuid not null references source_documents(id)
  source_value          text                -- raw value as reported, for audit when it differs from the stored value
  verification_status   text not null       -- enum: verified | unverified | user_submitted | disputed
  created_at            timestamptz not null default now()
```

Index: `(entity_type, entity_id)` on `entity_evidence` for the lookup pattern "give me all evidence for this fighter."

This means **`fighters` and `weight_classes` carry no `source_id` or `verification_status` columns at all** — provenance is looked up via `entity_evidence`, not embedded on the row. For Slice 1B, fixtures need not populate `entity_evidence` exhaustively (they're fictional data with nothing to cite) — one or two example rows are enough to prove the join and the constraint shape work. Real coverage arrives with real data, later.

### Tasks

1. **Add dependencies.**
   ```bash
   pnpm add drizzle-orm postgres
   pnpm add -D drizzle-kit
   ```

2. **Configure Drizzle.** Create `drizzle.config.ts` at the repo root pointing at `src/db/schema/index.ts` and outputting to `src/db/migrations/`, dialect `postgresql`, credentials from `DATABASE_URL`.

3. **Define schema** in `src/db/schema/`:
   - `source-documents.ts` — table above.
   - `entity-evidence.ts` — table above, with the verification-status enum shared from a `enums.ts` file (also export `weightClassGenderEnum`, `fighterStanceEnum`, `fighterStatusEnum` here for reuse).
   - `weight-classes.ts` — `id`, `slug` (unique), `name`, `gender` enum, `limit_lbs` (numeric, nullable — heavyweight has no cap), `sort_order` (smallint).
   - `fighters.ts` — `id`, `slug` (unique), `full_name`, `nickname` (nullable), `birth_date` (nullable), `nationality` (char(2), nullable), `stance` enum (nullable), `height_cm`/`reach_cm` (smallint, nullable), `status` enum, `primary_weight_class_id` (fk → weight_classes, nullable), `created_at`/`updated_at`. **No source/verification columns** — see provenance model above. No record-count columns yet (those depend on bouts, which don't exist until Slice 3) — do not add them prematurely.
   - `fighter-aliases.ts` — `id`, `fighter_id` (fk, cascade delete), `alias`, `kind` enum (`nickname`/`ring_name`/`spelling_variant`/`birth_name`), unique constraint on `(fighter_id, lower(alias))`.
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
   - `fighters.ts` — **fictional** fighters only: e.g. `"Test Fighter One"` / slug `test-fighter-1`, `"Jane Example"` / slug `jane-example-boxer`, with made-up but internally-consistent vitals (birth dates, stances, divisions). Use deterministic fixed UUIDs (not `gen_random_uuid()` at insert time) so tests can assert against known IDs.
   - `fighter-aliases.ts` — one or two fictional aliases per fixture fighter (e.g. "Test Fighter One" → alias "TF1").
   - `source-documents.ts` / `entity-evidence.ts` — one or two example rows (e.g. a fake "Test Commission Report" source, one evidence row citing it for one fixture fighter's birth date) — enough to prove the shape works, not exhaustive.
   - A top-level comment in this folder: `// Fictional data for local development and automated tests. Do not add real fighters here — see docs/SLICE_1_FOUNDATION.md.`
   - Create `src/db/fixtures/production/` as an **empty folder with a `README.md` stub** stating: "Real, source-reviewed fighter data goes here once the data-entry and provenance workflow is finalized (post-MVP-foundation). Not populated during Slice 1."

8. **Seed script.** `src/db/seed.ts` imports the dev fixtures and inserts them via the client (weight classes → fighters → aliases → source documents → evidence, in FK order). Add to `package.json`:
   ```json
   "db:seed": "tsx src/db/seed.ts"
   ```

9. **Integration tests — one strategy only.**
   Use the GitHub Actions Postgres service container (already available in CI) plus a dedicated local test database (`punchstats_test`, created by the Docker Compose init script from 1A) for local runs. **Do not introduce Testcontainers** — it duplicates what the Compose init script and CI service already provide, at the cost of a Docker-socket dependency and slower tests.

   Configure `vitest.config.ts` to load `DATABASE_URL_TEST` for any test file under `src/db/`.

   Write `src/db/schema.test.ts`:
   - Inserting a weight class, then a fighter referencing it, succeeds.
   - Inserting a fighter alias with a duplicate `(fighter_id, lower(alias))` pair fails (unique constraint).
   - Deleting a fighter cascades to its aliases.
   - Inserting `entity_evidence` referencing a nonexistent `source_document_id` fails (FK constraint).
   - Each test cleans up its own rows (transaction rollback per test, or truncate in `afterEach`) so tests are independent of fixture/seed state.

10. **Extend CI.** Add to the existing `.github/workflows/ci.yml` job: a `postgres:16-alpine` service container, then after `pnpm build`:
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
- ✅ No table in this slice has a `source_id` or single `verification_status` column directly on it — provenance is only reachable via `entity_evidence`.
- ✅ `src/db/fixtures/dev/` contains zero real fighter names; `src/db/fixtures/production/` exists but is empty except its README stub.

### Files touched — 1B

`drizzle.config.ts`, `src/db/schema/*.ts`, `src/db/migrations/*` (generated), `src/db/client.ts`, `src/db/fixtures/dev/*.ts`, `src/db/fixtures/production/README.md`, `src/db/seed.ts`, `src/db/schema.test.ts`, `vitest.config.ts`, updates to `package.json` and `.github/workflows/ci.yml`

### Model routing — 1B

🔴 **Strong model:** schema definition (constraints, FKs, enum shapes, the evidence-table design), migration review before committing, the CI Postgres wiring, and the constraint-violation tests (getting these subtly wrong defeats their purpose).
🟢 **Cheap model:** fictional fixture data entry (once the schema shape is fixed), the seed script's mechanical insert-in-order logic, the `production/README.md` stub.

---

## Slice 1C — First read-only fighter directory

**Goal:** One query function, one page. Proves the app can read from the database and render it — the actual point of Slice 1.

### Tasks

1. **Query function.** `src/modules/fighters/queries.ts`:
   ```ts
   export async function listFighters() {
     // join fighters -> weight_classes, order by full_name
     // return { slug, fullName, nickname, divisionName, divisionSlug, status }[]
   }
   ```
   **No `getFighterBySlug`** — there's no fighter detail page yet (that's Slice 3); don't build a query with no caller. **No pagination parameters** — with a handful of fixtures, return them all; pagination is explicitly deferred (Slice 2 territory, once the directory has filters worth paginating).

2. **Query test.** `src/modules/fighters/queries.test.ts`, using `DATABASE_URL_TEST` and the seeded fixtures from 1B: asserts `listFighters()` returns the known fictional fixtures, correctly joined to their division names, in the expected order. Assert against the deterministic fixture data (names, slugs) established in 1B — not against real fighters.

3. **Page.** `src/app/fighters/page.tsx` — a server component calling `listFighters()` and rendering a plain list (name, nickname, division). No `FighterCard` component, no table styling, no images, no empty/loading/error states beyond what Next.js gives for free — those are design-system-slice concerns. Enough markup to be legible, not to be polished.

4. **Home page link.** Update `src/app/page.tsx` (still just the placeholder from 1A) to add a single link to `/fighters` so the directory is reachable.

5. **One-command setup + docs.** Add to `package.json`:
   ```json
   "setup": "docker compose up -d && pnpm db:migrate && pnpm db:seed"
   ```
   Add a short `README.md` "Getting started" section: `pnpm install && pnpm setup && pnpm dev`, then visit `/fighters`.

6. **Final CI extension.** No new CI infrastructure needed — `pnpm test` (already wired in 1B) now also picks up `queries.test.ts`. Confirm the full pipeline (install → typecheck → lint → build → migrate → seed-equivalent-for-tests → test) is green end to end.

### Acceptance criteria — 1C

- ✅ Fresh clone → `pnpm install && pnpm setup && pnpm dev` → `/fighters` renders the fictional fixture fighters with their divisions, in under 5 minutes.
- ✅ `listFighters()` has a passing integration test against real Postgres (not mocked).
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
- Real fighter data of any kind, in any table — a separate curated data-entry workflow starts once DATABASE.md's provenance section is updated to match the `entity_evidence` model introduced here
- shadcn components beyond `init` (Button, Card, Table, Combobox, etc.) — added on-demand when a feature first needs them
- Testcontainers, or any second integration-test strategy alongside the Postgres CI service
- Authentication, server actions, and any `/api/v1` routes
- Bout, event, scorecard, punch-stat, title, or ranking tables — everything not `weight_classes`/`fighters`/`fighter_aliases`/`source_documents`/`entity_evidence`
- Styling polish, responsive design, loading/empty/error states, images or avatars
- Populating `src/db/fixtures/production/`

---

## Combined acceptance criteria (Slice 1, all sub-slices)

- ✅ `pnpm install && pnpm setup && pnpm dev` on a fresh clone renders `/fighters` with seeded fictional data in under 5 minutes.
- ✅ CI (`.github/workflows/ci.yml`) runs install → type-check → lint → build → migrate → test on every push, fully green.
- ✅ Every migration in `src/db/migrations/` is generated (`drizzle-kit generate`), committed, human-auditable, and never hand-edited.
- ✅ No table carries a single `source_id`/`verification_status` pair implying one source explains a whole row; provenance is reachable only via `entity_evidence`.
- ✅ Zero real fighter names, records, or biographical facts exist anywhere in the repository (fixtures or otherwise). Real weight-class definitions are the one deliberate exception (sport rules, not fighter facts).
- ✅ Migrations never run automatically from app boot or a deploy hook — only via explicit `pnpm db:migrate`.
- ✅ Exactly one integration-test strategy is in use (CI Postgres service + local Compose test database) — no Testcontainers.
- ✅ The codebase shape (`src/modules/fighters/queries.ts`, `src/db/schema/*`, fixture/production split) is ready for Slice 2 to extend without rework.

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

**Rule of thumb carried over from ROADMAP.md:** the first instance of a pattern goes to the strong model; once a pattern is established (e.g., the second query module in Slice 2), repetitions can go to the cheap model.

---

## Risk checklist

- ⚠️ **Provenance model divergence:** this doc's `entity_evidence` design supersedes DATABASE.md's row-level `source_id` approach and ADR-005. Update those docs before or during 1B implementation so later slices (3, 5, 6 — which all reference row-level provenance today) aren't built against a stale model.
- ⚠️ **`drizzle-kit generate` vs `migrate` vs `push` confusion:** a coding model defaulting to `push` from habit will silently bypass the auditable-migration requirement. Call this out explicitly in any prompt handed off for 1B.
- ⚠️ **Fixture drift toward real data:** it's tempting for a coding model to "improve" fictional fixtures by making them resemble real fighters for realism. Explicitly forbid this in task prompts; review fixture files for real names before merging.
- ⚠️ **Two-database Compose setup only matters locally:** CI only ever needs `punchstats_test` (no app boot, no dev database) — don't over-port the local two-database init script into CI.
- ⚠️ **`entity_evidence` has no consumer yet:** it exists in Slice 1B purely as groundwork; nothing queries it until a later slice surfaces provenance badges in the UI. Leave the one-line comment pointing back to this doc so it doesn't read as dead/accidental complexity.
- ⚠️ **Windows/Docker Desktop path quirks:** if `docker compose up -d` fails to mount `./docker/init`, check for Windows path translation issues (WSL2 backend is more forgiving than Hyper-V).
- ⚠️ **CI workflow file is edited three times (1A, 1B, 1C):** write it in 1A anticipating appends (comments marking where later steps will go) so 1B/1C tasks don't need to restructure it.
