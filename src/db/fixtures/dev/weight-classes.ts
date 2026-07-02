// Fictional data for local development and automated tests. Do not add real fighters here — see docs/SLICE_1_FOUNDATION.md.
//
// The 17 real men's divisions ARE seeded for real: these are sport-rule
// reference data (objective, uncontested), the one deliberate exception to the
// "no real data" rule. See docs/DATABASE.md "Two tiers".

export type WeightClassFixture = {
  id: string;
  slug: string;
  name: string;
  gender: "male" | "female";
  limitLbs: string | null; // numeric passed as string to postgres
  sortOrder: number;
};

// Deterministic UUIDs so tests/fixtures can reference divisions by known id.
export const weightClassesFixture: WeightClassFixture[] = [
  { id: "00000000-0000-4000-8000-0000000000f1", slug: "heavyweight", name: "Heavyweight", gender: "male", limitLbs: null, sortOrder: 1 },
  { id: "00000000-0000-4000-8000-0000000000f2", slug: "cruiserweight", name: "Cruiserweight", gender: "male", limitLbs: "200.0", sortOrder: 2 },
  { id: "00000000-0000-4000-8000-0000000000f3", slug: "light-heavyweight", name: "Light Heavyweight", gender: "male", limitLbs: "175.0", sortOrder: 3 },
  { id: "00000000-0000-4000-8000-0000000000f4", slug: "super-middleweight", name: "Super Middleweight", gender: "male", limitLbs: "168.0", sortOrder: 4 },
  { id: "00000000-0000-4000-8000-0000000000f5", slug: "middleweight", name: "Middleweight", gender: "male", limitLbs: "160.0", sortOrder: 5 },
  { id: "00000000-0000-4000-8000-0000000000f6", slug: "super-welterweight", name: "Super Welterweight", gender: "male", limitLbs: "154.0", sortOrder: 6 },
  { id: "00000000-0000-4000-8000-0000000000f7", slug: "welterweight", name: "Welterweight", gender: "male", limitLbs: "147.0", sortOrder: 7 },
  { id: "00000000-0000-4000-8000-0000000000f8", slug: "super-lightweight", name: "Super Lightweight", gender: "male", limitLbs: "140.0", sortOrder: 8 },
  { id: "00000000-0000-4000-8000-0000000000f9", slug: "lightweight", name: "Lightweight", gender: "male", limitLbs: "135.0", sortOrder: 9 },
  { id: "00000000-0000-4000-8000-0000000000fa", slug: "super-featherweight", name: "Super Featherweight", gender: "male", limitLbs: "130.0", sortOrder: 10 },
  { id: "00000000-0000-4000-8000-0000000000fb", slug: "featherweight", name: "Featherweight", gender: "male", limitLbs: "126.0", sortOrder: 11 },
  { id: "00000000-0000-4000-8000-0000000000fc", slug: "super-bantamweight", name: "Super Bantamweight", gender: "male", limitLbs: "122.0", sortOrder: 12 },
  { id: "00000000-0000-4000-8000-0000000000fd", slug: "bantamweight", name: "Bantamweight", gender: "male", limitLbs: "118.0", sortOrder: 13 },
  { id: "00000000-0000-4000-8000-0000000000fe", slug: "super-flyweight", name: "Super Flyweight", gender: "male", limitLbs: "115.0", sortOrder: 14 },
  { id: "00000000-0000-4000-8000-0000000000ff", slug: "flyweight", name: "Flyweight", gender: "male", limitLbs: "112.0", sortOrder: 15 },
  { id: "00000000-0000-4000-8000-000000000101", slug: "light-flyweight", name: "Light Flyweight", gender: "male", limitLbs: "108.0", sortOrder: 16 },
  { id: "00000000-0000-4000-8000-000000000102", slug: "minimumweight", name: "Minimumweight", gender: "male", limitLbs: "105.0", sortOrder: 17 },
];
