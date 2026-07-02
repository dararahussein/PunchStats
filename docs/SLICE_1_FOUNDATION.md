# Slice 1 — Foundation & Database Core

**Goal:** Prove the whole stack works end-to-end. After this slice, `docker compose up && pnpm dev` produces a working app with seeded data, migrations apply via CI, and the codebase is shaped for slices 2–8 to plug in cleanly.

**Deliverable:** A deployed app showing a home page that lists ~10 seeded fighters. Every system is wired and working; the UI is intentionally minimal (no design polish, no search, no links between pages).

**Size estimate:** 40–60 hours for a developer new to this codebase; 20–30 hours if you're already familiar with Next/Drizzle.

---

## In scope

- **Project scaffold:** Next.js 15 (App Router, TypeScript, `src/` directory), Tailwind v4, shadcn/ui initialized with dark tokens, Drizzle ORM + CLI, postgres driver.
- **Database & migrations:** Docker Compose running Postgres 16 locally; Drizzle schema (`sources`, `weight_classes`, `fighters`, `fighter_aliases`) with all columns, enums, CHECK constraints, and unique constraints from DATABASE.md; migrations 0000–0002 (extensions + immutable function, schema, indexes); Drizzle migrations run on app boot (local dev) and CI (production deploy).
- **Seed data:** All 17 men's weight classes with correct limits; 3 hand-written sources (e.g., "Manual entry — Crawford profile", "Manual entry — 2024 ESPN reports", "Wikimedia Commons"); 10 well-known fighters (active, current top names like Crawford, Canelo, Spence) with realistic vitals; 3–5 aliases per fighter (e.g., Canelo = "Saúl Álvarez", "Goldboy").
- **Backend wiring:** Drizzle client instantiation (Neon serverless in production, node-postgres locally via env); module folder structure (`src/modules/fighters/queries.ts`) with two query functions: `getFighterBySlug(slug)` and `listFighters(params)` returning structured types.
- **Frontend:** App shell (sticky top bar with logo + placeholder nav; footer; dark token application; Space Grotesk + Inter fonts loaded via `next/font`); home page (`src/app/page.tsx`, a server component) that calls `listFighters()` and renders a simple `<ul>` of fighter names and divisions (no styling beyond tokens, no `FighterCard` component yet — that comes in slice 2).
- **Configuration:** `.env.example` documenting all required variables; `docker-compose.yml` for local Postgres; `.npmrc` for pnpm; `.eslintrc.json` with import-boundary rule skeletons (not enforced yet, prep for slice 2).
- **CI/CD:** GitHub Actions workflow that runs on push to main: typecheck (`tsc --noEmit`), lint (`eslint`), Drizzle migration check, unit tests. Vercel preview deployments per PR. No tests need to pass yet (they don't exist), but the workflow structure is there.
- **Testing infrastructure:** Vitest configured, one example unit test (slug generation utility), one example Drizzle query test against a disposable Postgres container in CI (proving the index is used, via `EXPLAIN`). No Playwright yet (that's slice 2).

## Out of scope (explicitly)

- ❌ Search, filtering, or any query parameters on the home page
- ❌ Any page besides `/` and 404 (no fighter profiles, no events, no admin)
- ❌ Admin auth or server actions
- ❌ Public API routes (`/api/v1`)
- ❌ Any interactive components (forms, comboboxes, buttons that do anything)
- ❌ Lighthouse/SEO/accessibility polish (basic semantic HTML only; detailed a11y comes in slice 8)
- ❌ Error states, loading states, or empty states beyond basic HTML
- ❌ Any styling beyond applying dark tokens; no cards, no tables, no responsive design
- ❌ Images, photos, or placeholders
- ❌ Database seeding from external sources; hand-written seed file only
- ❌ Production deployment (Vercel is wired but the app doesn't go live yet)

---

## Concrete tasks

### Phase 1: Project scaffold (4–6 hours)

1. **Initialize Next.js:** `pnpm create next-app@15` with:
   - TypeScript, App Router, `src/` directory, Tailwind, ESLint
   - No example pages (delete `src/app/page.tsx` for now, rebuild it)
   - Reject: Next.js import alias, shadcn/ui setup (do it manually so you own it)

2. **Add dependencies:**
   ```
   pnpm add drizzle-orm postgres
   pnpm add -D drizzle-kit
   pnpm add @hookform/resolvers zod  # for slice 7; just install now
   ```

3. **Initialize shadcn/ui:**
   - `npx shadcn-ui@latest init`
   - Choose dark theme
   - Edit `components/ui/` to set CSS variables from DESIGN_SYSTEM.md (tokens section)
   - Test by rendering one shadcn button on a blank page; verify dark tokens apply

4. **Configure fonts:**
   - `pnpm add @next/font` (likely already included)
   - Create `src/lib/fonts.ts` exporting Space Grotesk and Inter via `next/font/google`
   - Import into `src/app/layout.tsx` and apply `className` to root

5. **Add Tailwind v4 configuration:**
   - `tailwind.config.ts` with `@theme` pointing to tokens from step 3
   - Verify Space Grotesk is in `fontFamily` config

### Phase 2: Database (8–12 hours)

1. **Create `src/db/` folder structure:**
   ```
   src/db/
     schema/
       index.ts          # all table exports
       sources.ts        # one file per logical group
       fighters.ts
     migrations/         # generated by drizzle-kit
     client.ts           # Neon client instantiation
     seed.ts             # hand-written seed script
   ```

2. **Define schema in code** (`schema/sources.ts`, `schema/fighters.ts`, etc.):
   - `sources` table with `name`, `kind`, `url`, `license_notes` text fields
   - `weight_classes` with `slug`, `name`, `gender` enum, `limit_lbs`, `sort_order`
   - `fighters` with all columns from DATABASE.md (full list: slug, full_name, birth_name, nickname, birth_date, death_date, nationality, stance, height_cm, reach_cm, pro_debut_date, status enum, primary_weight_class_id fk, all record counters, bio, photo_key/license/attribution, sex, source_id fk, verification_status enum, created_at/updated_at)
   - `fighter_aliases` with fighter_id fk, alias, kind enum, unique constraint
   - All constraints from DATABASE.md exactly (CHECK conditions, NOT NULLs, FKs)
   - Use Drizzle's `.references()` for FKs, `unique()` for constraints, enums for enums

3. **Generate migrations:**
   - `pnpm drizzle-kit generate`
   - Drizzle creates `src/db/migrations/0001_init.sql`
   - **Hand-edit this file** to prepend extensions:
     ```sql
     CREATE EXTENSION IF NOT EXISTS pg_trgm;
     CREATE EXTENSION IF NOT EXISTS unaccent;
     
     CREATE OR REPLACE FUNCTION immutable_unaccent(regdictionary, text)
     RETURNS text AS 'unaccent' LANGUAGE c IMMUTABLE STRICT;
     CREATE OPERATOR CLASS unaccent_ops FOR TYPE text ...;  -- full SQL from DATABASE.md
     ```
   - Add the two trigram GIN indexes from DATABASE.md manually (they reference the immutable function)
   - Verify the file is valid SQL by eye

4. **Create Drizzle client** (`src/db/client.ts`):
   ```typescript
   import { drizzle } from 'drizzle-orm/postgres-js';
   import postgres from 'postgres';
   
   const client = postgres(process.env.DATABASE_URL!);
   export const db = drizzle(client);
   ```

5. **Create `docker-compose.yml`:**
   ```yaml
   version: '3.8'
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
   volumes:
     punchstats-db:
   ```

6. **Create `.env.example`:**
   ```
   DATABASE_URL=postgresql://postgres:dev@localhost:5432/punchstats
   NEXT_PUBLIC_API_URL=http://localhost:3000
   ```

7. **Add `pnpm db:migrate` and `pnpm db:seed` scripts** to `package.json`:
   ```json
   "db:migrate": "drizzle-kit push --dialect postgresql",
   "db:seed": "node -r ts-node/register src/db/seed.ts"
   ```

### Phase 3: Seed data (6–8 hours)

1. **Create `src/db/seed.ts`:**
   - Import the db client and schema
   - Insert all 17 weight classes (hardcoded array, loop with `db.insert()`)
   - Insert 3 sources by hand:
     - "Manual entry — Crawford profile" (kind: editorial)
     - "Manual entry — 2024 ESPN reports" (kind: media_report)
     - "Wikimedia Commons" (kind: licensed_feed with license_notes)
   - Insert 10 fighters: Crawford, Canelo, Spence Jr., Benavidez, Bivol, Haney, Pacquiao, Mayweather, etc. — with realistic vitals, birth dates, stances. Keep it real; look up actual data.
   - For each fighter, insert 2–3 aliases via `db.insert(fighterAliases)`
   - At the end: `await client.end()`
   - Run `pnpm db:seed` locally and verify data appears in Postgres

2. **Test seed runs clean:**
   - `docker compose down && docker compose up -d && pnpm db:migrate && pnpm db:seed && docker compose down`
   - Verify no errors

### Phase 4: Backend queries (4–6 hours)

1. **Create `src/modules/fighters/queries.ts`:**
   - `getFighterBySlug(slug: string)` → returns one fighter row + aliases joined (not needed for slice 1, but define the pattern)
   - `listFighters(page = 1, perPage = 25)` → returns paginated list of all fighters with basic fields (slug, full_name, nickname, division, record) and total count
   - Both use the db client; both return strongly-typed results (either via Drizzle's `.$inferSelect` or manual type definitions)
   - Add JSDoc comments explaining what each returns

2. **Test the queries:**
   - Write Vitest unit tests in `src/modules/fighters/queries.test.ts`
   - Test: `listFighters` returns 10 rows, correct pagination, correct total count
   - Test: `getFighterBySlug('terence-crawford')` returns Crawford with 3 aliases
   - Test: `listFighters(2, 5)` returns the correct page
   - Run against a disposable Postgres container in the test (use `testcontainers` or `docker-compose` in CI)

### Phase 5: Frontend (4–6 hours)

1. **Create app shell** (`src/app/layout.tsx`):
   - Import fonts from `src/lib/fonts.ts`
   - Apply to html element
   - Basic dark theme structure (no fancy styling)
   - A header `<nav>` with the logo text ("PunchStats") and a placeholder "Nav will go here"
   - A footer with "© 2025 PunchStats" and "Built with Next.js & PostgreSQL"
   - `{children}` in the middle
   - All using Tailwind dark tokens

2. **Create home page** (`src/app/page.tsx`):
   - Server component
   - Call `listFighters()` from the query module
   - Render an `<h1>Fighters</h1>` and a `<ul>` with each fighter as `<li>{name} — {division} — {record}</li>`
   - Render pagination: "Page 1 of {total pages}" (no clickable pagination yet)
   - No error handling (slice 1 assumes happy path); if the DB is down, let the error surface to the browser

3. **Create a 404 page** (`src/app/not-found.tsx`):
   - Simple: "Page not found"

4. **Test locally:**
   - `docker compose up -d && pnpm dev`
   - Visit `http://localhost:3000`
   - See the fighter list render with 10 fighters on page 1

### Phase 6: Testing & CI (6–8 hours)

1. **Configure Vitest** (`vitest.config.ts`):
   - Set up TypeScript resolution
   - Point to postgres container for DB tests (use docker socket if available, else `testcontainers-node`)

2. **Write schema validation tests** (`src/db/schema.test.ts`):
   - Test: sources table can be inserted
   - Test: weight classes have required constraints
   - Test: fighters can be inserted with valid source_id
   - Test: fighter aliases enforce uniqueness per fighter
   - (These are more about testing the schema than the app, but they catch migration errors early)

3. **Write query tests** (already outlined in Phase 4)

4. **Create GitHub Actions workflow** (`.github/workflows/ci.yml`):
   ```yaml
   name: CI
   on: [push]
   jobs:
     test:
       runs-on: ubuntu-latest
       services:
         postgres:
           image: postgres:16-alpine
           env:
             POSTGRES_PASSWORD: test
           options: >-
             --health-cmd pg_isready
             --health-interval 10s
             --health-timeout 5s
             --health-retries 5
           ports:
             - 5432:5432
       steps:
         - uses: actions/checkout@v4
         - uses: pnpm/action-setup@v2
         - uses: actions/setup-node@v4
           with:
             node-version: '20'
             cache: 'pnpm'
         - run: pnpm install
         - run: pnpm run type-check
         - run: pnpm run lint
         - run: DATABASE_URL=... pnpm run test  # e2e with real postgres
   ```

5. **Add lint & type-check scripts** to `package.json`:
   ```json
   "type-check": "tsc --noEmit",
   "lint": "eslint .",
   "test": "vitest run"
   ```

6. **Configure ESLint** (`.eslintrc.json`):
   - Start basic (Next.js recommended config)
   - Add placeholder import-boundary rules (not enforced yet, just structure for slice 2)

### Phase 7: Deployment wiring (4–6 hours)

1. **Connect to Vercel:**
   - Push repo to GitHub (already done)
   - Link Vercel project to the repo
   - Set `DATABASE_URL` env var in Vercel to a Neon staging DB
   - Configure Neon account + create a database
   - Test: push a commit, preview deployment runs CI, migrates DB, renders home page

2. **Create `.vercelignore`:**
   - Ignore Docker files, local dev config, migration source files (the compiled migrations should ship, not the source)

3. **Update `package.json` scripts** for Vercel:
   - `"build"`: `next build` (Vercel runs this automatically)
   - `"postbuild"`: Run migrations after build (via a Node script that imports Drizzle and calls migrate)

4. **Test production-like locally:**
   - `pnpm build && pnpm start`
   - Verify it works

---

## Acceptance criteria

✅ **Local dev workflow:** Cloning the repo, running `docker compose up -d && pnpm dev`, and seeing the fighter list on `http://localhost:3000` takes < 5 minutes.

✅ **CI passes:** GitHub Actions runs on every push; typecheck, lint, and tests all green.

✅ **Migrations:** Drizzle migrations in `src/db/migrations/` are hand-auditable SQL; running `pnpm db:migrate` on a fresh Postgres instance results in a working schema with all indexes.

✅ **Seed data:** 10 well-known fighters with realistic vitals, all 17 weight classes, 3 sources, aliases working.

✅ **Frontend renders:** Home page displays the fighter list, uses dark tokens, renders on both desktop and mobile without obvious layout breaks.

✅ **Query tests pass:** `listFighters()` and `getFighterBySlug()` are tested against real Postgres in CI.

✅ **Deployable:** Merging to main triggers a Vercel preview; the preview runs migrations and renders the home page successfully.

✅ **Codebase shape is right:** Module structure (`modules/fighters/queries.ts`), Drizzle schema split across files, `.env` example matches reality, all future slices can plug in cleanly.

---

## Model routing

🟢 **Cheap model (Haiku):**
- Seed data entry (hand-writing fighter records)
- UI scaffold (home page HTML, dark tokens, fonts)
- GitHub Actions CI boilerplate
- Docker Compose file
- `.env` and config files

🔴 **Strong model (Fable/Opus):**
- Drizzle schema with complex constraints (CHECK, FK relationships, enums, generated columns if needed)
- Migration generation and hand-editing (extensions, immutable functions, index definitions)
- DB client wiring and testing
- Query functions and their unit tests
- Vercel/Neon deployment setup and env wiring

---

## Risk checklist

- ⚠️ **Drizzle schema complexity:** If the schema hand-edit feels fragile, rope in the strong model to review before running migrations.
- ⚠️ **Postgres setup:** Windows Docker Desktop can be finicky. If `docker compose up` fails, you may need to adjust volume paths (`C:\...` vs `/mnt/c/...`).
- ⚠️ **Seed data typos:** A misspelled fighter name or wrong birth date here will propagate to every later slice. Have someone (or ChatGPT) spot-check the seed.
- ⚠️ **CI database:** GitHub Actions' Postgres service can be slow. If tests time out, increase timeouts or use a lighter test suite in CI (reserve heavy tests for local runs).

---

## What slice 1 *doesn't* prove but is set up for

- ❌ Search works (slice 2)
- ❌ Authentication works (slice 7)
- ❌ Admin writes work (slice 7)
- ❌ Performance is good (slice 8)
- ❌ Scalability to 10k fighters (but nothing here suggests it won't work)

Slice 1 is boring by design: it's the foundation, not the showcase. Slices 2–3 are where the product starts to sing.
