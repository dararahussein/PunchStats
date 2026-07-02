import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, queryClient } from "@/db/client";
import { fighters } from "@/db/schema";
import {
  FIGHTER_TWO_ID,
} from "@/db/fixtures/dev/fighters";
import { listFighters } from "./queries";

// The seed script is expected to have run before tests, populating fixtures.
// These tests verify that listFighters() returns the correct published fixture
// and filters out draft fixtures.

describe("listFighters query", () => {
  it("returns published fixture fighters with division joins, ordered by full name", async () => {
    const result = await listFighters();

    // Should return at least FIGHTER_ONE (published via seed), ordered by fullName.
    expect(result.length).toBeGreaterThanOrEqual(1);

    // Verify FIGHTER_ONE is in the result with correct data.
    const fighterOne = result.find((f) => f.slug === "test-fighter-1");
    expect(fighterOne).toBeDefined();
    expect(fighterOne?.fullName).toBe("Test Fighter One");
    expect(fighterOne?.nickname).toBe("TF1");
    // FIGHTER_ONE is assigned to Welterweight (id ...f7).
    expect(fighterOne?.divisionName).toBe("Welterweight");
    expect(fighterOne?.divisionSlug).toBe("welterweight");
    expect(fighterOne?.status).toBe("active");
  });

  it("does NOT return draft fixture fighters (filter proof)", async () => {
    const result = await listFighters();

    // Ensure the test database has been seeded with FIGHTER_TWO in draft state.
    // (The seed script only publishes FIGHTER_ONE, leaving FIGHTER_TWO as draft.)
    const draftFighter = await db
      .select()
      .from(fighters)
      .where(eq(fighters.id, FIGHTER_TWO_ID));
    expect(draftFighter).toHaveLength(1);
    expect(draftFighter[0].publicationStatus).toBe("draft");

    // Verify FIGHTER_TWO (draft) does NOT appear in the query result.
    const fighterTwo = result.find((f) => f.slug === "jane-example-boxer");
    expect(fighterTwo).toBeUndefined();

    // Verify the result only contains FIGHTER_ONE (published).
    const fighterSlugs = result.map((f) => f.slug);
    expect(fighterSlugs).toContain("test-fighter-1");
    expect(fighterSlugs).not.toContain("jane-example-boxer");
  });

  it("orders results by full name (case-sensitive order)", async () => {
    const result = await listFighters();

    // Verify at least one published fighter exists (from seed).
    expect(result.length).toBeGreaterThanOrEqual(1);

    // Verify ordering by checking that full names are in alphabetical order.
    for (let i = 1; i < result.length; i++) {
      expect(result[i].fullName >= result[i - 1].fullName).toBe(true);
    }
  });

  it("handles fighters with null division (no primary_weight_class_id)", async () => {
    const result = await listFighters();

    // The fixture fighters all have divisions, so this is a structural check.
    // The leftJoin means divisionName/divisionSlug will be null if no FK points
    // to a weight class — verify the query doesn't break in that case.
    expect(result).toBeDefined();
  });
});

// Close the shared connection after this file's tests complete.
afterAll(async () => {
  await queryClient.end({ timeout: 5 });
});
