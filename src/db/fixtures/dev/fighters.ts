// Fictional data for local development and automated tests. Do not add real fighters here — see docs/SLICE_1_FOUNDATION.md.

export type FighterFixture = {
  id: string;
  slug: string;
  fullName: string;
  nickname: string | null;
  birthDate: string | null;
  nationality: string | null;
  stance: "orthodox" | "southpaw" | "switch" | null;
  heightCm: number | null;
  reachCm: number | null;
  status: "active" | "inactive" | "retired" | "deceased";
  primaryWeightClassId: string | null;
  // publication_status is intentionally omitted: the seed script publishes the
  // designated fighter via publishFighter(), never by setting the column here.
};

// Deterministic UUIDs so tests can assert against known ids.
export const FIGHTER_ONE_ID = "00000000-0000-4000-8000-000000000001";
export const FIGHTER_TWO_ID = "00000000-0000-4000-8000-000000000002";

// FIGHTER_ONE is designated to be published by the seed (has qualifying evidence).
// FIGHTER_TWO is left as draft (default) with no evidence.
export const fightersFixture: FighterFixture[] = [
  {
    id: FIGHTER_ONE_ID,
    slug: "test-fighter-1",
    fullName: "Test Fighter One",
    nickname: "TF1",
    birthDate: "1990-01-15",
    nationality: "US",
    stance: "orthodox",
    heightCm: 180,
    reachCm: 183,
    status: "active",
    // Welterweight
    primaryWeightClassId: "00000000-0000-4000-8000-0000000000f7",
  },
  {
    id: FIGHTER_TWO_ID,
    slug: "jane-example-boxer",
    fullName: "Jane Example",
    nickname: null,
    birthDate: "1995-06-30",
    nationality: "GB",
    stance: "southpaw",
    heightCm: 168,
    reachCm: 170,
    status: "active",
    // Lightweight
    primaryWeightClassId: "00000000-0000-4000-8000-0000000000f9",
  },
];

// The fixture fighter the seed will publish via publishFighter().
export const PUBLISHED_FIXTURE_FIGHTER_ID = FIGHTER_ONE_ID;
