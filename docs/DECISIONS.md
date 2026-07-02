# PunchStats — Architecture Decision Records

Short-form ADRs. Status values: **Accepted** (build on it) · **Provisional** (accepted, with a named trigger for revisiting). New decisions get appended, never rewritten — superseded ADRs are marked, not deleted.

---

## ADR-001 — Modular monolith in a single Next.js app

**Status:** Accepted

One Next.js App Router application containing UI, admin, public API, and all business logic in `src/modules/*`; one Postgres database.

**Alternatives rejected:**
- *Separate API service (Nest/Fastify) + Next frontend* — doubles deployment, auth, and type-sharing surface for one developer; the public API is read-only and thin, so it doesn't justify its own service.
- *Microservices* — nothing here has independent scaling or team boundaries; rejected without much ceremony.

**Consequence accepted:** module boundaries are convention. Mitigation: route files never import Drizzle directly; ESLint import rules if discipline slips.

## ADR-002 — Drizzle over Prisma

**Status:** Accepted

**Why Drizzle:** the schema leans on Postgres-specific features — `pg_trgm` GIN indexes with expression wrappers (`immutable_unaccent`), generated `tsvector` columns, partial indexes, CHECK constraints. Drizzle treats these as first-class (schema-as-code emitting plain SQL migrations you can read and hand-edit); Prisma historically pushes them into unsupported-feature escape hatches and hides SQL behind a query engine. Drizzle is also lighter at serverless cold-start (no engine binary) and pairs natively with Neon's serverless driver.

**Alternatives rejected:**
- *Prisma* — better beginner DX and docs, and a fine choice generally; rejected because this schema's value is in Postgres features Prisma abstracts awkwardly, and raw-SQL migration hand-editing is a first-class need here.
- *Kysely / raw SQL* — maximum control, but no schema-as-code or migration generation; more discipline required than a solo project should spend.

**Consequence accepted:** fewer Stack Overflow answers than Prisma; migration review discipline is on us (CI applies committed SQL only).

## ADR-003 — Postgres-native search (pg_trgm + FTS), no search engine

**Status:** Provisional — revisit if search p95 > 100ms or corpus > ~100k documents or faceted search becomes a feature.

**Why:** the corpus is thousands of rows; trigram similarity is genuinely strong at person-name misspellings; one less service to run, sync, and pay for. Aliases table makes nickname search a data problem, not an engine problem.

**Alternatives rejected:** *Meilisearch/Typesense* (great, but real infra + index-sync code for no MVP benefit) · *Algolia* (vendor cost, data egress for a free product) · *Postgres FTS alone without trgm* (stems words, doesn't fix misspelled names — names need trigrams).

## ADR-004 — Two fighter columns on `bouts`, not a participants join table

**Status:** Provisional — revisit if per-fighter bout attributes exceed ~4 pairs or non-two-participant needs appear (they can't, in boxing).

**Why:** boxing guarantees exactly two participants; two FK columns keep every read one join flatter, keep admin forms and seed files legible, and index cleanly (`(fighter1_id)`, `(fighter2_id)`).

**Alternatives rejected:** *`bout_participants`* — more normalized, natural home for per-fighter attributes, but every query pays two joins forever and "did X fight Y" logic gets clumsier. The migration path (insert-select into a participants table) is mechanical if ever needed.

**Consequence accepted:** fight-history queries use `OR` across two indexed columns; per-fighter fields come in awkward pairs (`fighter1_weight_lbs`…).

## ADR-005 — Row-level provenance, not field-level

**Status:** Provisional — revisit when community submissions require per-field merge/review.

**Why:** `source_id` + `verification_status` per row covers the product promise (badging verified/user-submitted/calculated) at 1/10th the complexity of field-level lineage. Calculated values are structurally separate (denormalized columns / derived in services), so "calculated" needs no row status.

**Alternatives rejected:** *field-level provenance tables* (huge write amplification, no UI to justify it) · *no provenance until later* (retrofitting NOT NULL source columns onto populated tables is miserable; the columns must exist from row one).

## ADR-006 — Minimal custom admin auth (one credential, signed cookie)

**Status:** Provisional — swap to **better-auth** the day a second user role exists.

**Why:** MVP has exactly one authenticated human. ~80 lines (argon2 verify, `jose` JWT cookie, middleware + per-action assertion) is auditable; an auth framework at 2% utilization is configuration risk without payoff.

**Alternatives rejected:** *Auth.js v5* (credentials-provider path is its most awkward flow) · *Clerk* (vendor dependency + cost for one user) · *HTTP Basic Auth* (no logout/expiry ergonomics, hostile to server actions).

**Consequence accepted:** we own security-sensitive code — kept deliberately boring, rate-limited, and tested (roadmap slice 7 routes it to the strong model).

## ADR-007 — ISR + tag-based revalidation; no Redis

**Status:** Provisional — add Redis only on measured DB pressure or a feature needing shared ephemeral state (rate limits currently fit in middleware memory per-instance, acceptable at MVP traffic).

**Why:** content changes only on admin writes, which know exactly what they touched — the perfect shape for `revalidateTag`. CDN-cached static pages + hour-level fallback revalidation gives near-static performance with second-level freshness after edits.

**Alternatives rejected:** *fully dynamic SSR + Redis cache* (infrastructure to reproduce what ISR does natively) · *pure static export* (no on-demand revalidation, rebuild-the-world on every edit).

## ADR-008 — Vercel + Neon + R2 over a self-managed VPS

**Status:** Provisional — revisit if hosting cost exceeds ~$25/mo or the portfolio goal shifts toward ops demonstration.

**Why:** zero-ops deploys, preview environments per PR (Neon branch per preview is a standout demo), free tiers cover MVP traffic entirely. One developer's scarce resource is attention, not compute. R2 for images specifically for zero egress fees and S3 API portability.

**Alternatives rejected:** *VPS + Docker Compose + Caddy* (cheaper at scale, better ops story, but adds backups/patching/TLS/monitoring to a solo project) · *Vercel Blob* (egress pricing, weaker portability) · *images in repo* (no license metadata, repo bloat).

## ADR-009 — Manual admin data entry now; ingestion behind the same service layer later

**Status:** Accepted

All data enters through module services (admin UI or seed scripts) with mandatory provenance. Future licensed/open feeds become *ingestion adapters* — code that maps an external format onto the same service calls with a `licensed_feed` source row. No scraping of BoxRec or republication of CompuBox numbers, ever, encoded as app-level validation (punch stats require license-noted sources), not just policy.

**Alternatives rejected:** *scrape-first* (BoxRec ToS violation, EU database-right exposure, and the product thesis is presentation, not data volume) · *designing a full ingestion pipeline now* (speculative generality; the `sources` table and service seam are the cheap 20% that preserves the option).

**Consequence accepted:** content grows slowly by hand; scope is a curated dataset (~4 divisions deep), stated honestly in PRODUCT.md.

## ADR-010 — Editorial rankings as append-only dated snapshots

**Status:** Accepted

Publishing rankings inserts a complete new `as_of` set per division; nothing is updated in place. Movement arrows are calculated by diffing snapshots.

**Alternatives rejected:** *mutable rank rows with history triggers* (audit complexity, race-prone) · *sanctioning-body rankings at MVP* (republication of curated lists carries licensing/database-right risk and a freshness obligation we can't meet; editorial-with-methodology is honest and legally clean).

## ADR-011 — Offset pagination on the public API

**Status:** Provisional — switch any collection crossing ~50k rows to keyset pagination.

**Why:** URL-addressable pages, trivial caching, "page 3 of 13" UIs; the deep-offset performance cliff and write-skew inconsistencies that motivate cursors don't exist at this volume or write rate.

**Alternatives rejected:** *cursor/keyset now* (correct at scale, but complicates the UI and shareable URLs for zero current benefit).

## ADR-012 — UUIDv7 primary keys + slug business keys

**Status:** Accepted

**Why:** UUIDv7 is time-ordered (avoids the index-locality pain of v4) and lets seed scripts and future importers generate IDs without round-trips; slugs carry all public URL duty so IDs never leak into UX. Bouts, having no natural name, use `/fights/{uuid}/{derived-slug}` URLs.

**Alternatives rejected:** *bigserial* (fine, but couples ID generation to the DB and leaks ordinals) · *slugs as PKs* (slugs must be renameable — fighters change ring names; PKs must not change).
