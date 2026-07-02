# PunchStats — Design System

## Visual direction

**"Broadcast graphics meet editorial sports page."** Dark-first UI (boxing is a night sport; photography and division colors pop on dark), restrained color, big confident numerals for records and scores, dense-but-breathable data tables. The reference feeling is a modern F1/NBA stats property, not a database admin panel — and explicitly not BoxRec's spreadsheet aesthetic.

Rules of the direction:

- **Numbers are the heroes.** Records (42-0), scorecards (117-111), and round counts get display treatment; labels stay quiet.
- **One accent, used sparingly.** A saturated red (`--accent`) for wins/KO moments, interactive emphasis, and the logo; gold reserved exclusively for championship/title markers so it retains meaning.
- **Provenance is visible but calm** — small badges/footnote glyphs, never shouting.
- Dark theme ships first; light theme is a token swap left post-MVP (tokens are structured for it from day one).

## Tokens

Implemented as CSS variables consumed by Tailwind v4 `@theme` + shadcn/ui conventions.

```
--background        #0B0D10   (near-black, blue-tinted)
--surface           #14171C   (cards)
--surface-raised    #1B1F26   (hover, nested cards)
--border            #262B33
--foreground        #F2F4F7
--muted-foreground  #98A2B3
--accent            #E5484D   (red — interactive/emphasis)
--gold              #D4A843   (titles/champions ONLY)
--win               #46A758   --loss #E5484D   --draw #98A2B3   --nc #8E4EC6
```

Result colors are always paired with a letter (W/L/D/NC) — color is never the only signal (see Accessibility).

## Typography

| Role | Face | Notes |
|---|---|---|
| Display / numerals | **Space Grotesk** (variable) | Headlines, records, scorecard numbers; `font-feature-settings: "tnum"` — **tabular figures are mandatory in every stat context** so columns of numbers align |
| UI / body | **Inter** (variable) | Everything else |
| Mono | system mono | Admin-only (IDs, raw data) |

Scale (rem): 3.0 / 2.25 / 1.5 / 1.25 / 1.0 / 0.875 / 0.75 with line-heights 1.1 for display, 1.5 for body. Two families, self-hosted via `next/font`, zero layout shift.

## Spacing & layout

- 4px base scale (Tailwind default). Page gutters: 16px mobile, 24px tablet, max-width `1200px` centered on desktop.
- Card padding 16/20px; table cell padding 12px vertical minimum (touch targets).
- Section rhythm: 48px between major page sections, 24px within.

## Cards & tables

**Card:** `--surface` background, 1px `--border`, 12px radius, no shadows at rest (dark UIs read shadows poorly) — elevation is expressed by background step (`--surface-raised`) on hover for interactive cards. Interactive cards get a 150ms background/border transition and a visible focus ring.

**Tables** (fight history, rankings, scorecards):

- Sticky header row on desktop; horizontal scroll is **forbidden** as the primary mobile strategy for fight history — see mobile pattern below.
- Row hover = `--surface-raised`; whole row is the link (with a real `<a>` covering it, not a JS onclick).
- Result cells: pill badge — letter + color (`W · TKO 9`).
- Numeric columns right-aligned, tabular figures; text columns left-aligned. Zebra striping off; 1px row borders on.
- **Mobile fight history**: rows collapse to stacked two-line cards (opponent + result pill on line one; date, event, method on line two). Implemented as one component with a container-query breakpoint, not two data sources.

## Navigation

**Desktop:** slim sticky top bar — logo, primary nav (Fighters, Events, Rankings, Divisions), and an ever-present search field (⌘K opens the same combobox as a command palette). No mega-menus.

**Mobile:** sticky top bar with logo + search icon (opens full-screen search) + hamburger opening a full-height sheet with the four primary destinations and division quick-links. A bottom tab bar was considered and rejected: only four destinations, and content pages (profiles) matter more than section-switching — a tab bar steals 56px of stat-table viewport permanently.

**Cross-linking is the real navigation:** every fighter name, event name, division label, and title chip anywhere in the UI is a link. Breadcrumbs on detail pages (`Events → Riyadh Season → Crawford vs. Canelo`).

## Page layouts

### Fighter profile

1. **Header band**: photo/placeholder left; name, nickname ("Bud"), nationality flag, division chip, status; **record hero** right — `42-0-0` huge with `31 KO` beneath, calculated-provenance footnote glyph.
2. **Vitals strip**: age/born, height, reach, stance, debut — horizontal definition list, wraps to 2×3 grid on mobile. Unknown values render "—".
3. **Titles**: gold-accented chips for current titles, muted for past reigns (with dates).
4. **Fight history table**: newest first — Date, Opponent (+record-at-the-time when known), Result pill, Method, Rd, Event, Location. Title fights get a subtle gold left-border on the row.
5. **Bio** (short, collapsible past 4 lines) and **aliases** footer, provenance footnote block.

### Event page

1. Header: event name, date, venue/city/country, promoter, status badge (upcoming/completed/canceled).
2. **The card**: bouts grouped by billing (Main event → Co-main → Undercard → Prelims), main event visually largest (two fighter photo tiles facing off), others as list rows: `Fighter A vs. Fighter B · division · result pill or "12 rds"`. Bout order within groups follows `bout_order` descending.
3. Every bout row links to the fight page; every name to a profile.

### Fight page

1. **Tale-of-the-tape header**: two fighter columns (photo, name, record before the fight) facing a center column (division, rounds, date, event link, titles-at-stake gold chips).
2. **Result banner**: `Crawford def. Álvarez · UD · 12 rounds` — the single most important line, rendered as such. `result_status` ≠ official adds an amber "Under review" / "Overturned" banner beneath, linking to the revisions timeline.
3. **Scorecards**: three judge cards side by side (stacked on mobile): judge name, `117-111` totals colored toward the winner; per-round 12-column grid when data exists, "Round-by-round not available" otherwise.
4. **Knockdowns & punch stats**: comparative bars (thrown vs. landed) when data exists; the section renders an explicit "Punch statistics not available for this bout" empty state otherwise — never zeros.
5. **Result history** timeline (only when revisions exist).

### Rankings page

1. Division switcher: horizontal scrollable chip row (weight order), gender toggle.
2. **Champion block** above the table: per-body champion cards (body logo/abbrev, fighter, since-date) — gold treatment.
3. Ranked table: `#, Fighter (photo thumb, name, record), Last fight (result + date)`. Movement arrows (▲2) once two snapshots exist.
4. Footer: "Editorial rankings · as of {date} · methodology" — the honesty requirement.

## Loading, empty, and error states

Every one designed, none default:

- **Loading**: skeletons matching real layout geometry (header band, table rows) via route-level `loading.tsx`; no spinners on page loads. Search combobox gets an inline spinner (only place one is allowed).
- **Empty**: distinct copy per cause — *no data yet* ("Punch stats not available"), *no results* ("No fighters match — try fewer filters", with a clear-filters action), *future data* ("Card not yet announced").
- **Error**: route-level `error.tsx` with retry; `not-found.tsx` for bad slugs suggests search. Admin forms surface field-level Zod errors inline.

## Accessibility requirements (WCAG 2.1 AA)

1. Contrast ≥ 4.5:1 for text (dark theme tokens above are chosen to pass; `--muted-foreground` on `--surface` must be verified whenever tokens change).
2. **Color never sole signal** — result pills always carry W/L/D/NC letters; movement arrows carry +/− text.
3. Real semantics: data tables are `<table>` with `<th scope>`; nav is `<nav>`; one `<h1>` per page; landmark regions.
4. Full keyboard support: visible focus rings (accent, 2px offset), search combobox follows the ARIA combobox pattern (shadcn/cmdk provides this — verify, don't assume), skip-to-content link.
5. Images: meaningful alt ("Terence Crawford") or empty alt for decorative; placeholder avatars are decorative.
6. `prefers-reduced-motion` disables transitions; touch targets ≥ 44px; zoom to 200% doesn't break layouts.
7. Flags as sole nationality indicators are insufficient — pair with country name or `aria-label`.

## Reusable components

**From shadcn/ui (as-is or lightly themed):** Button, Input, Select, Dialog, Sheet (mobile nav), Command (search/⌘K), Tabs, Badge, Skeleton, Table primitives, Form + field wrappers (admin), Toast (admin feedback), DropdownMenu, Tooltip (provenance hints).

**Custom composites (the project's real design work):**

| Component | Used on | Notes |
|---|---|---|
| `RecordDisplay` | profiles, cards, search results | `42-0-0 (31 KO)` w/ size variants + provenance glyph |
| `ResultPill` | every fight row | W/L/D/NC + method + round |
| `FighterCard` | directories, rankings, search | photo/placeholder, name, division, record |
| `FighterAvatar` | everywhere | licensed photo or designed initials placeholder |
| `BoutRow` | event cards, fight history | responsive table-row ↔ stacked-card morph |
| `TaleOfTheTape` | fight pages | two-column comparison |
| `ScorecardGrid` | fight pages | totals + optional round grid |
| `StatBarPair` | fight pages | comparative punch-stat bars |
| `TitleChip` | profiles, fights, rankings | the only gold component |
| `ProvenanceBadge` | all data displays | verified ✓ / user-submitted / calculated ƒ, tooltip with source |
| `DivisionChip`, `EmptyState`, `PageHeader`, `DataFootnote` | throughout | |

Storybook is **not** used (overhead for one dev); instead a single `/dev/components` route (excluded from prod builds) renders every composite in all states — cheap visual regression by eyeball.
