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

**Status:** Superseded by [ADR-013](#adr-013--tiered-provenance-per-domain-evidence-tables-over-row-level-or-fully-generic-models) — the row-level `source_id` model didn't hold up once multi-field entities like `fighters` needed to cite more than one source per row. Retained here for history, per this document's own rule that superseded decisions are marked, not deleted.

**Original reasoning:** `source_id` + `verification_status` per row covers the product promise (badging verified/user-submitted/calculated) at 1/10th the complexity of field-level lineage. Calculated values are structurally separate (denormalized columns / derived in services), so "calculated" needs no row status.

**Original alternatives rejected:** *field-level provenance tables* (huge write amplification, no UI to justify it) · *no provenance until later* (retrofitting NOT NULL source columns onto populated tables is miserable; the columns must exist from row one).

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

## ADR-013 — Tiered provenance: per-domain evidence tables over row-level or fully generic models

**Status:** Accepted — supersedes [ADR-005](#adr-005--row-level-provenance-not-field-level)'s row-level provenance decision.

**Why it was revisited:** ADR-005's design conflated two very different kinds of table. A `scorecards` row genuinely is one atomic fact from one source — row-level provenance is correct there. But `fighters` aggregates dozens of independently-sourced facts (birth date from a commission license, reach from a promoter's press kit, a photo from Wikimedia Commons) collected at different times. A single `source_id` on that row forces every field to share one citation, so either a later, better source for one field silently overwrites the citation for all the others, or admins pick whichever source happens to be "best enough" and misrepresent the rest. That's not a hypothetical edge case — it's the normal case for any fighter profile assembled from more than one source.

**New decision — a two-tier model:**

- **Tier 1 (atomic-fact tables — unchanged in shape from ADR-005):** `fighter_aliases`, `scorecards`, `punch_stats`, `rankings`, `title_reigns`, `bout_result_revisions` keep a direct `source_document_id` + `verification_status` pair, because a row in these tables really is one fact from one source. Only the target table changes — `source_documents` (below) replaces the original thin `sources` table.
- **Tier 2 (multi-field entities):** `fighters` now, `events`/`bouts` once they exist, carry **no** source/verification columns at all. A companion `<entity>_evidence` table (`fighter_evidence` first, in Slice 1B) holds one row per claim about one field (or the entity generally, via a nullable `field_name`), so independently-sourced, possibly-conflicting facts about the same entity coexist instead of competing for one column.
- **Source documents, not source publishers:** `sources` is replaced by `source_documents`, where each row is one specific retrieved document (a particular article, report, or filing — with its own `url`, `published_at`, `retrieved_at`, `archived_url`), not a generic stand-in for a publisher. The same outlet gets a new row per distinct document cited.

Full field lists and worked examples (conflict storage, canonical-value selection, corrections, editorial entries, archived URLs) are in [DATABASE.md](DATABASE.md#provenance-and-evidence-model-cross-cutting) — this ADR records the decision and its alternatives, not the schema.

**Alternatives considered:**

1. *Keep ADR-005's row-level model everywhere* (do nothing) — rejected: doesn't fix the problem this ADR responds to; every Tier 2 entity would still misrepresent multi-source facts.
2. *Full field-level provenance everywhere, including Tier 1 tables* — rejected: a `scorecards` row is already atomic; giving it a full evidence side-table adds a join and a table for a distinction that table structurally can't have (there's only one fact in the row). This was ADR-005's original objection to field-level provenance in general — it still holds, just narrowed to the tables where it actually applies (Tier 2).
3. *One generic polymorphic `entity_evidence` table with `entity_type` + `entity_id` columns, shared by every Tier 2 entity* — this was the first sketch of this fix. Rejected in favor of per-domain tables: Postgres cannot enforce a real foreign key across a polymorphic `(entity_type, entity_id)` pair, so referential integrity and cascade deletes become application-level promises instead of database guarantees — a real regression on a schema whose entire design philosophy elsewhere is "let Postgres enforce it" (CHECK constraints, NOT NULL, unique indexes throughout DATABASE.md). The cost of the alternative — one small, near-identical table per Tier 2 entity — is low and mechanical with Drizzle's schema-as-code migrations.
4. *A shared "anchor"/registry table* (every Tier 2 entity also gets a row in a central `provenance_subjects` table; both the entity table and one generic evidence table FK to that registry's surrogate key) — this would preserve real referential integrity with only one physical evidence table. Rejected for now: it requires an extra insert and an extra join for every Tier 2 entity, to save table-count duplication that doesn't matter until there are many more Tier 2 entity types than this project has (currently one: `fighters`). Recorded as the escalation path if the number of `<entity>_evidence` tables grows past roughly six or seven and the per-table duplication becomes the bigger cost than the registry indirection.

**Tradeoffs accepted:**

- Removing `source_id NOT NULL` from `fighters` means the database no longer guarantees every fighter row has a citation at *creation* time — that guarantee is redirected to *publication* time instead, via the fighter publication-state model in [ADR-014](#adr-014--fighter-publication-state-gates-the-missing-citation-invariant). This is a real, accepted cost of supporting multiple independently-verifiable sources per entity.
- Every future Tier 2 entity (`bouts`, `events`) needs its own evidence table, migration, and query helpers, rather than reusing one universal table. Judged cheap relative to the referential-integrity loss of the polymorphic alternative.
- `verified_by` on `fighter_evidence` is free text, not a FK, because `admin_users` doesn't exist until Slice 7. It is an intentional audit snapshot of the reviewer's name, not a placeholder: when Slice 7 adds `admin_users`, a nullable `verified_by_admin_user_id` column is added *alongside* it, not as a replacement — the historical text should survive an account being renamed or removed.
- `confidence` on `fighter_evidence` is `NOT NULL` with no database default — every evidence row must state its confidence explicitly at creation; there is no silent "unset" state.

**Consequences:**

- DATABASE.md's provenance section, every Tier 1/Tier 2 table spec, the ER diagram, and the indexes list are updated to match (done alongside this ADR).
- Any doc or code that assumed a single `source_id` column on `fighters`/`events`/`bouts` (API.md's response-shape examples, admin server-action descriptions) needs to describe evidence-aware provenance instead — corrected where found in this pass; flag anything missed for follow-up.
- Slice 1B (see [SLICE_1_FOUNDATION.md](SLICE_1_FOUNDATION.md)) builds exactly `source_documents` + `fighter_evidence`; no other evidence table is built until its parent entity ships.

**Migration implications:** none yet — no production data exists. This decision lands as part of Slice 1B's initial migration, not a schema change against populated tables. The `verified_by` → FK conversion (above) and "add `bout_evidence`/`event_evidence` when their parent tables ship" are the known future migrations this decision commits to.

**Revisit triggers:**

- The number of `<entity>_evidence` tables exceeds ~6–7 → reconsider the shared-registry/anchor-table alternative (rejected above, not ruled out permanently).
- Community submissions (post-MVP) need to attach evidence to more granular objects than "one field on one entity" (e.g., disputing a single sentence within a bio) → revisit whether `field_name` needs to become more structured than a flat text column.
- If `fighter_evidence` in practice is never populated with more than one row per field even for real, multi-sourced data → that would suggest the tiering assumption was wrong for `fighters` specifically, and Tier 1's simpler shape might have sufficed there too.

## ADR-014 — Fighter publication state gates the missing-citation invariant

**Status:** Accepted

**Why:** [ADR-013](#adr-013--tiered-provenance-per-domain-evidence-tables-over-row-level-or-fully-generic-models) removed `source_id NOT NULL` from `fighters`, which was an honest tradeoff but left a real gap: nothing stops a fighter from existing — and being shown publicly — with zero supporting evidence. That gap needs a replacement guarantee, and the replacement also needs to solve a workflow problem the old model never had: admins should be able to save an incomplete profile mid-entry without either faking a citation to satisfy a NOT NULL column or being blocked from creating the row at all.

**Decision:** add `fighters.publication_status` (`draft` | `published` | `archived`, `NOT NULL DEFAULT 'draft'`). A fighter may be created and edited freely in `draft` with zero evidence. Transitioning to `published` requires at least one **qualifying** `fighter_evidence` row — `verification_status = 'verified'`, `confidence IN ('high','medium')`, belonging to that fighter, with its `source_document_id` FK intact (guaranteed by the schema) — enforced by a `publishFighter(fighterId)` function running the check and the state change in one transaction, locking the fighter row first (`SELECT ... FOR UPDATE`) to prevent racing with concurrent evidence deletion. Deleting a fighter's last qualifying evidence row while it is `published` auto-reverts it to `draft` in the same transaction (via `deleteFighterEvidence(evidenceId)`, which locks the fighter row before deleting and re-counts afterward), rather than blocking the delete. Both functions live in `src/modules/fighters/services/publication.ts` — this is fighter-domain business logic, not a database-layer concern, so it belongs in the fighters module, not `src/db/`. Public queries (`listFighters()`, and later every other public read path) filter to `publication_status = 'published'` only.

Full mechanics, the two service functions, and the enforcement boundary are specified in [DATABASE.md](DATABASE.md#resolving-the-missing-citation-invariant-fighter-publication-state); this ADR records the decision and alternatives.

**Alternatives considered:**

1. *Do nothing — accept the gap as documented but unenforced* — rejected: "a fighter can be created with zero evidence" was flagged as an accepted tradeoff in ADR-013, but leaving it completely unenforced would mean the product's core promise (every displayed fact is sourced) has no actual guarantee behind it, only a convention.
2. *Re-add a NOT NULL source column to `fighters`, in some form* — rejected: this is exactly what ADR-013 already rejected, and for the same reason — it re-imposes "one citation for the whole row" on a genuinely multi-sourced entity, or forces a placeholder citation at creation time that misrepresents an incomplete profile as sourced.
3. *A Postgres CHECK constraint or trigger enforcing "published implies at least one verified evidence row" at the database level* — rejected for now, not permanently: a trigger is the more airtight guarantee, but writing and testing one correctly (handling inserts, updates, and the evidence-deletion cascade case) is nontrivial, and Slice 1B's brief is explicitly to avoid introducing that complexity without a clean, well-tested implementation already in hand. Recorded below as the intended hardening step if service-layer discipline ever proves insufficient.
4. *Reject deletion of a published fighter's last qualifying evidence, instead of auto-reverting to draft* — considered as the enforcement policy for `deleteFighterEvidence`. Rejected: it blocks a legitimate admin action (removing evidence later judged wrong or mistaken) unless a replacement is published first, which is more friction than the alternative of quietly unpublishing the fighter until new qualifying evidence exists. Auto-revert was chosen instead.
5. *Require verified evidence for every individual field before publishing, not just one row anywhere on the fighter* — considered as a stricter eligibility rule. Rejected for Slice 1B as unnecessary complexity: it requires defining which fields are "required" per fighter (birth date? nationality? both?), which is a real product decision not yet made. The single-verified-row bar is a deliberately low floor, not the final word — recorded as a revisit trigger below.

**Tradeoffs accepted:**

- The invariant is enforced only for writes that go through `publishFighter`/`deleteFighterEvidence` — a direct `UPDATE fighters SET publication_status = 'published'` bypassing the module is not stopped by the database. Mitigated at the type level (any general fighter-update function's input type omits `publication_status` entirely, so there's nothing to pass through by accident) but not at the database level. Accepted because this codebase's convention is that all writes go through the service layer already (see [ARCHITECTURE.md](ARCHITECTURE.md)); this is not a new category of trust being extended.
- `archived` is added to the enum now for completeness (so `draft`/`published`/`archived` don't need a later migration to introduce a third state), even though no workflow transitions a fighter into it until Slice 7. A small amount of speculative schema, judged cheap relative to an enum-value migration later.

**Consequences:**

- `fighters` gains `publication_status` (Slice 1B migration).
- Two new functions ship in Slice 1B: `publishFighter` and `deleteFighterEvidence`, in `src/modules/fighters/services/publication.ts`, both integration-tested.
- `listFighters()` (Slice 1C) filters to `publication_status = 'published'`; Slice 1B's fixtures need at least one fixture fighter in each of `draft` and `published` state (the published one carrying a qualifying `fighter_evidence` row) so both the write-side invariant and the read-side filter are exercised by real data, not asserted in the abstract.

**Migration implications:** none yet — lands as part of Slice 1B's initial migration, alongside ADR-013's tables. No populated data exists to backfill.

**Revisit triggers:**

- If the single-verified-row bar for publishing proves too permissive in practice (e.g., a fighter gets published on the strength of one trivial verified fact while its birth date and record remain entirely unsourced) → introduce a stricter, field-specific eligibility rule (see alternative 5 above).
- If direct-write bypasses of `publishFighter`/`deleteFighterEvidence` are ever observed or become a real risk (e.g., once ingestion adapters or bulk-import tooling write directly to `fighters`) → build the Postgres trigger described in alternative 3, converting this from a service-layer convention into a database guarantee.
- If `archived` needs its own eligibility rules or admin workflow before Slice 7 arrives naturally → revisit whether it should have shipped later instead of speculatively now.
