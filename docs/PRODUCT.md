# PunchStats — Product Definition

## Vision

PunchStats is a modern boxing records platform. It does not claim more data than BoxRec — it presents boxing data **dramatically better**: fast pages, clean typography, obvious navigation between fighters, fights, events, divisions, and titles, and honest labeling of where every number came from.

The one-sentence pitch: *"The boxing record site you actually enjoy using."*

Guiding principles:

1. **Presentation over quantity.** A fighter profile with 40 well-organized fights beats a database with 40,000 fighters behind a 2003-era UI.
2. **Honesty about data.** Every record is visibly labeled as *verified*, *user-submitted*, or *calculated*. Missing data (e.g., punch stats) is shown as missing, never faked or zero-filled.
3. **Legally clean.** No scraped BoxRec content. Facts are entered by hand, computed, or ingested from sources we are allowed to use (see risks below).
4. **Built to grow, shipped small.** A modular monolith with a schema that already supports analytics, multiple data sources, and community submissions — but an MVP scope one developer can finish.

## Target users

| User | What they want | MVP priority |
|---|---|---|
| **Casual fan** | "What's Crawford's record? Who did he beat last?" — fast lookup on a phone, usually arriving from Google | Primary |
| **Hardcore fan / historian** | Full fight histories, scorecards, title lineage, division rankings, cross-linking between fighters and events | Primary |
| **Writer / content creator** | Reliable facts to cite, shareable pages, clean stat tables | Secondary |
| **Hiring manager / peer developer** | (Implicit) evidence of product and engineering quality — this is a portfolio project | Implicit but real |

Assumption: users are anonymous readers. There are **no public accounts in the MVP**; the only authenticated user is the admin (you).

## Primary user journeys

1. **Fighter lookup (the money path).** Google → fighter profile → scan record header (W-L-D, KOs) → scroll fight history → tap a fight → fight detail with scorecards → tap the opponent → their profile. Every step must work well on mobile and be crawlable for SEO.
2. **Event exploration.** Home or search → event page → full card in billing order → each bout links to its fight page and both fighters.
3. **Division browsing.** Nav → divisions → a division's rankings → champion and top 10 → fighter profiles.
4. **Search.** Header search (always visible) → type a partial or misspelled name ("golovkin", "ggg", "canelo") → grouped results (fighters, events) → destination page.
5. **Admin data entry (internal).** Log in → create/edit fighters, events, bouts, scorecards, rankings → changes appear on the public site within seconds.

## MVP features

- **Fighter directory** with search, division/status filters, and pagination.
- **Fighter profiles**: photo (when licensed), vitals (stance, height, reach, nationality, born), calculated record (W-L-D, KOs), current/primary division, titles held, aliases/nicknames, short bio, full fight history table (opponent, result, method, round, date, event, location), each row linking onward.
- **Fight (bout) pages**: both fighters, result and method, round/time, weight class and weigh-in weights, titles at stake, referee, judges' scorecards (totals always; per-round when available), knockdowns, punch stats *when legally available*, result revision history for overturned/amended results, link to the event.
- **Event pages**: date, venue, city/country, promoter, full card in order with per-bout results.
- **Event directory**: upcoming and past, filterable by date and country.
- **Division rankings**: per weight class, editorial top-10 + champion(s) by sanctioning body, with an "as of" date and methodology note.
- **Global search** for fighters and events with typo tolerance.
- **Admin tools** (auth-protected): CRUD for all of the above, with a source citation and verification status required before anything reaches the public site — one citation per row for single-fact tables (e.g. scorecards), and per-field citations for multi-source entities (e.g. fighters). Fighters specifically can be saved as an incomplete `draft` with no citation yet — the requirement is enforced at publish time, not creation time, so editors can build a profile incrementally — see [DATABASE.md](DATABASE.md#provenance-and-evidence-model-cross-cutting).
- **Data provenance surfaced in the UI**: small badges/footnotes distinguishing verified / user-submitted / calculated data.
- **SEO**: server-rendered pages, canonical URLs with slugs, OpenGraph images, structured data (`Person`, `SportsEvent`) where it fits.

## Explicit non-goals (MVP)

These are cut deliberately, not forgotten:

- Live round-by-round scoring or play-by-play
- Betting odds or affiliate links
- Social features (comments, follows, user profiles, forums)
- Subscriptions, paywalls, or any monetization
- News/editorial content
- Public write access (community submissions come later; the schema supports them now)
- Amateur boxing, MMA, or other combat sports
- Native mobile apps (the responsive web app is the mobile experience)
- Full historical coverage — the MVP ships with a **curated dataset** (roughly the current top 10–15 per major division plus their fight histories, ~150–300 fighters, ~1,500–3,000 bouts), not all of boxing history

## Future features (post-MVP, schema-ready today)

- Community submissions with moderation queue (the `verification_status` + provenance model exists for this)
- Advanced analytics: punch-stat trends, opponent-quality metrics, head-to-head comparisons
- Title lineage visualizations and championship history timelines
- Sanctioning-body rankings alongside editorial rankings
- Ingestion adapters for licensed/open data feeds (the `sources` model exists for this)
- Public read API with keys and rate limits
- Women's boxing parity as a first-class filter (schema supports it from day one via per-division gender)

## Success criteria

Because this is a portfolio MVP, criteria are quality-based, not traffic-based:

1. **Complete core loop**: a visitor can go search → fighter → fight → event → other fighter without hitting a dead end, on a phone.
2. **Performance**: Lighthouse ≥ 90 on Performance/SEO/Accessibility/Best Practices for fighter, event, and fight pages; LCP < 2.0s on 4G for a fighter profile.
3. **Data honesty**: every displayed record carries a provenance state; zero fabricated values in the seed data.
4. **Content depth**: at least 4 divisions fully populated (champion + top 10 + complete recent fight histories) so demo browsing never feels empty.
5. **Admin viability**: entering a full event card (say, 8 bouts with results and scorecards) takes under 20 minutes.
6. **Legal cleanliness**: no BoxRec-scraped content, no CompuBox numbers without a license, image licenses recorded per image.

## Key risks (product-level)

- **Data acquisition is the real bottleneck, not code.** Fight *facts* (who fought whom, when, result) are not copyrightable in the US, but compiled databases can be protected (EU database right; BoxRec's terms prohibit scraping). Mitigation: hand-compile from primary/public reporting, record a source per row, keep scope curated. This is the #1 project risk.
- **Punch statistics are mostly proprietary** (CompuBox). The schema and UI must treat them as optional garnish, never a core dependency. Ship the MVP assuming zero punch-stat rows.
- **Fighter photos** are almost all rights-encumbered. Default to high-quality placeholder avatars; use Wikimedia Commons images with recorded attribution when available.
- **Rankings are opinions.** Editorial rankings must be clearly labeled as ours, with a date and a short methodology note, to avoid implying sanctioning-body authority.
