# PunchStats — API & Server Actions

Two write/read surfaces, one shared query layer:

1. **Public reads** — React Server Components call module query functions directly (no HTTP). This serves the actual UI.
2. **Public JSON API** — read-only route handlers under `/api/v1/*`, thin wrappers over the *same* query functions. Exists to demonstrate API design and enable future consumers; the UI does not depend on it.
3. **Admin writes** — Next.js Server Actions only. No admin REST endpoints in the MVP (actions are typed end-to-end, CSRF-protected by the framework, and integrate with form progressive enhancement).

All request validation (route params, search params, action inputs) uses Zod schemas co-located with each module. IDs in URLs are **slugs** for fighters/events/divisions (SEO + readability) and UUIDs for bouts (bouts have no natural readable name; their URL is `/fights/{uuid}` with a human slug segment appended for SEO: `/fights/{uuid}/crawford-vs-canelo`).

## Public JSON API (`/api/v1`)

All endpoints are `GET`, return `application/json`, are unauthenticated, and are cached with the same tags as the pages (`Cache-Control: public, s-maxage=300, stale-while-revalidate=3600`).

| Endpoint | Purpose | Key params |
|---|---|---|
| `/api/v1/fighters` | Directory listing | `q`, `division`, `status`, `nationality`, `sort` (`name`,`-wins`,`-lastFight`), `page`, `perPage` |
| `/api/v1/fighters/{slug}` | Full profile | — |
| `/api/v1/fighters/{slug}/bouts` | Fight history | `page`, `perPage` (default 50, newest first) |
| `/api/v1/events` | Event directory | `from`, `to` (ISO dates), `country`, `status`, `page`, `perPage` |
| `/api/v1/events/{slug}` | Event + full card | — |
| `/api/v1/bouts/{id}` | Fight detail | — |
| `/api/v1/divisions` | All weight classes | `gender` |
| `/api/v1/divisions/{slug}/rankings` | Latest ranking snapshot | `asOf` (optional, historical) |
| `/api/v1/search` | Grouped global search | `q` (min 2 chars), `limit` per group (max 10) |

### Response envelope

Single resource:

```json
{ "data": { ... } }
```

Collections:

```json
{
  "data": [ ... ],
  "meta": { "page": 1, "perPage": 25, "total": 312, "totalPages": 13 }
}
```

### Representative shapes

`GET /api/v1/fighters/terence-crawford`:

```json
{
  "data": {
    "slug": "terence-crawford",
    "fullName": "Terence Crawford",
    "nickname": "Bud",
    "aliases": [{ "alias": "Terence Allan Crawford", "kind": "birth_name" }],
    "nationality": "US",
    "stance": "switch",
    "heightCm": 173,
    "reachCm": 188,
    "birthDate": "1987-09-28",
    "status": "active",
    "division": { "slug": "super-middleweight", "name": "Super middleweight" },
    "record": { "wins": 42, "losses": 0, "draws": 0, "noContests": 0, "koWins": 31, "provenance": "calculated" },
    "currentTitles": [{ "body": "WBA", "name": "WBA World Super Middleweight", "since": "2025-09-13" }],
    "photo": { "url": "…", "attribution": "…", "license": "CC BY-SA 4.0" },
    "provenance": { "verificationStatus": "verified", "source": { "name": "…", "kind": "media_report" } }
  }
}
```

`GET /api/v1/bouts/{id}` (abridged):

```json
{
  "data": {
    "id": "0197…",
    "event": { "slug": "crawford-vs-canelo-2025-09-13", "name": "…", "date": "2025-09-13" },
    "weightClass": { "slug": "super-middleweight" },
    "scheduledRounds": 12,
    "fighters": {
      "fighter1": { "slug": "canelo-alvarez", "recordBefore": { "wins": 63, "losses": 2, "draws": 2, "provenance": "calculated" } },
      "fighter2": { "slug": "terence-crawford", "recordBefore": { "wins": 41, "losses": 0, "draws": 0, "provenance": "calculated" } }
    },
    "result": { "outcome": "fighter2", "method": "UD", "endingRound": 12, "status": "official" },
    "titles": [{ "body": "WBC", "name": "…", "vacantBefore": false }],
    "scorecards": [{ "judge": "…", "fighter1Total": 111, "fighter2Total": 117, "rounds": null }],
    "punchStats": null,
    "resultRevisions": []
  }
}
```

`null` vs empty-array convention: `null` = "not available / never entered" (punch stats, per-round cards); `[]` = "known to be none" (no titles at stake, no revisions). The UI renders these differently ("Not available" vs. omitting the section), so the API must preserve the distinction.

## Pagination

**Offset pagination** (`page` ≥ 1, `perPage` default 25, max 100) everywhere. Rationale: dataset is small, offset supports "jump to page N" UIs and is trivially cacheable by URL; cursor pagination's consistency benefits matter at write volumes and depths this project won't see. Escape hatch recorded: if a collection grows past ~50k rows, switch that endpoint to keyset pagination behind the same query function. Out-of-range pages return an empty `data` with correct `meta`, not an error.

## Filtering & sorting conventions

- Filters are flat query params, validated by Zod enums/schemas; unknown params are **ignored** (lenient), invalid *values* for known params are a `400` (strict where it matters).
- Multi-value: repeat the param (`?division=heavyweight&division=cruiserweight`).
- Sort: single `sort` param, `-` prefix for descending (`sort=-lastFight`). Whitelisted fields only — sort maps to an allowlisted ORDER BY, never string interpolation.

## Search

`GET /api/v1/search?q=golovkn` →

```json
{
  "data": {
    "fighters": [{ "slug": "gennadiy-golovkin", "fullName": "Gennadiy Golovkin", "nickname": "GGG",
                   "division": "middleweight", "record": "42-2-1", "matchedOn": "alias:GGG" }],
    "events": []
  }
}
```

- Minimum 2 characters (else `400 VALIDATION`); results capped per group; trigram similarity threshold ~0.3 with exact-prefix matches boosted above fuzzy ones.
- `matchedOn` tells the UI why a result appeared (matched an alias vs. canonical name) so the combobox can show "GGG → Gennadiy Golovkin".
- The header combobox calls this endpoint from the client (debounced 200ms); it is the one public endpoint the UI itself uses.

## Error handling conventions

Errors return a single stable shape (loosely RFC 7807-inspired, simplified):

```json
{ "error": { "code": "NOT_FOUND", "message": "No fighter with slug 'terence-crawfrod'.", "details": null } }
```

| HTTP | `code` | When |
|---|---|---|
| 400 | `VALIDATION` | Bad param values; `details` carries Zod's flattened field errors |
| 404 | `NOT_FOUND` | Unknown slug/id — page routes render `notFound()` UI instead |
| 429 | `RATE_LIMITED` | Search endpoint only (simple fixed-window per-IP limit in middleware) |
| 500 | `INTERNAL` | Generic message; details logged server-side, never leaked |

No `401/403` on the public API (it's read-only public). Server actions don't use this envelope — they return typed discriminated unions `{ ok: true, data } | { ok: false, fieldErrors }` consumed by `useActionState` forms.

## Admin operations (Server Actions)

Every action: (1) asserts a valid admin session (middleware is not the security boundary — each action re-checks), (2) parses input with the module's Zod schema, (3) runs the service in a transaction, (4) calls `revalidateTag()` for every affected entity, (5) writes provenance (`source_id`, `verification_status` are required form fields).

| Module | Actions (representative) | Cache tags revalidated |
|---|---|---|
| fighters | `createFighter`, `updateFighter`, `addAlias`, `removeAlias`, `uploadFighterPhoto` | `fighter:{id}`, `fighters:list`, `search` |
| events | `createEvent`, `updateEvent`, `reorderCard` | `event:{id}`, `events:list` |
| bouts | `createBout`, `recordResult`, `amendResult` (writes a `bout_result_revisions` row + updates bout), `setTitlesAtStake` | `bout:{id}`, `event:{id}`, `fighter:{f1}`, `fighter:{f2}`, `division:{slug}` |
| scorecards | `upsertScorecard`, `upsertScorecardRounds` | `bout:{id}` |
| punch-stats | `upsertPunchStats` (refuses sources lacking license notes) | `bout:{id}` |
| rankings | `publishRankingSnapshot` (whole division at once, append-only) | `division:{slug}`, `rankings:list` |
| titles | `createTitle`, `startReign`, `endReign` | `division:{slug}`, `fighter:{id}` |
| admin-auth | `login`, `logout` | — |

Deletes are rare and guarded: fighters/events/bouts get `deleteX` actions that refuse when dependents exist (no cascading content deletes from the UI); hard cleanup is a deliberate DB task.

**Mutating anything from `/api/v1` is out of scope** — if a third party ever needs write access, that's a post-MVP API-key design, recorded as a non-goal now to avoid accidentally shipping an unauthenticated write path.
