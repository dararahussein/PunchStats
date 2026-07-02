import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db, queryClient } from "./client";
import {
  weightClasses,
  fighters,
  fighterAliases,
  sourceDocuments,
  fighterEvidence,
} from "./schema";

// Track ids created per test so each test cleans up after itself and stays
// independent of seed/fixture ordering. Deleting fighters cascades to their
// aliases + evidence; weight classes and source documents are deleted directly.
const createdFighterIds: string[] = [];
const createdWeightClassIds: string[] = [];
const createdSourceDocIds: string[] = [];

afterEach(async () => {
  if (createdFighterIds.length) {
    await db.delete(fighters).where(inArray(fighters.id, createdFighterIds));
  }
  if (createdSourceDocIds.length) {
    await db
      .delete(sourceDocuments)
      .where(inArray(sourceDocuments.id, createdSourceDocIds));
  }
  if (createdWeightClassIds.length) {
    await db
      .delete(weightClasses)
      .where(inArray(weightClasses.id, createdWeightClassIds));
  }
  createdFighterIds.length = 0;
  createdWeightClassIds.length = 0;
  createdSourceDocIds.length = 0;
});

async function insertWeightClass() {
  const id = randomUUID();
  createdWeightClassIds.push(id);
  await db.insert(weightClasses).values({
    id,
    slug: `wc-${id}`,
    name: "Test Division",
    gender: "male",
    limitLbs: "147.0",
    sortOrder: 1,
  });
  return id;
}

async function insertFighter(overrides: Partial<{ primaryWeightClassId: string }> = {}) {
  const id = randomUUID();
  createdFighterIds.push(id);
  await db.insert(fighters).values({
    id,
    slug: `f-${id}`,
    fullName: "Schema Test Fighter",
    status: "active",
    ...overrides,
  });
  return id;
}

async function insertSourceDoc() {
  const id = randomUUID();
  createdSourceDocIds.push(id);
  await db.insert(sourceDocuments).values({
    id,
    publisher: "Schema Test Source",
    sourceType: "official",
  });
  return id;
}

describe("schema constraints", () => {
  it("inserts a weight class, then a fighter referencing it", async () => {
    const wcId = await insertWeightClass();
    const fighterId = await insertFighter({ primaryWeightClassId: wcId });

    const rows = await db
      .select()
      .from(fighters)
      .where(eq(fighters.id, fighterId));
    expect(rows).toHaveLength(1);
    expect(rows[0].primaryWeightClassId).toBe(wcId);
  });

  it("rejects a duplicate (fighter_id, lower(alias)) alias", async () => {
    const fighterId = await insertFighter();
    await db.insert(fighterAliases).values({
      fighterId,
      alias: "Duplicate",
      kind: "nickname",
    });

    // Same fighter, alias differing only by case -> unique index on lower(alias).
    await expect(
      db.insert(fighterAliases).values({
        fighterId,
        alias: "duplicate",
        kind: "spelling_variant",
      }),
    ).rejects.toThrow();
  });

  it("cascades a fighter delete to its aliases AND its fighter_evidence", async () => {
    const fighterId = await insertFighter();
    const sourceDocId = await insertSourceDoc();

    await db.insert(fighterAliases).values({
      fighterId,
      alias: "CascadeAlias",
      kind: "nickname",
    });
    await db.insert(fighterEvidence).values({
      fighterId,
      sourceDocumentId: sourceDocId,
      confidence: "high",
    });

    // Delete the fighter directly (bypass the tracked cleanup array below).
    createdFighterIds.splice(createdFighterIds.indexOf(fighterId), 1);
    await db.delete(fighters).where(eq(fighters.id, fighterId));

    const aliases = await db
      .select()
      .from(fighterAliases)
      .where(eq(fighterAliases.fighterId, fighterId));
    const evidence = await db
      .select()
      .from(fighterEvidence)
      .where(eq(fighterEvidence.fighterId, fighterId));

    expect(aliases).toHaveLength(0);
    expect(evidence).toHaveLength(0);
  });

  it("rejects fighter_evidence with a nonexistent source_document_id (FK)", async () => {
    const fighterId = await insertFighter();
    await expect(
      db.insert(fighterEvidence).values({
        fighterId,
        sourceDocumentId: randomUUID(), // no such source document
        confidence: "high",
      }),
    ).rejects.toThrow();
  });

  it("rejects fighter_evidence with a nonexistent fighter_id (FK)", async () => {
    const sourceDocId = await insertSourceDoc();
    await expect(
      db.insert(fighterEvidence).values({
        fighterId: randomUUID(), // no such fighter
        sourceDocumentId: sourceDocId,
        confidence: "high",
      }),
    ).rejects.toThrow();
  });

  it("rejects fighter_evidence without an explicit confidence (NOT NULL, no default)", async () => {
    const fighterId = await insertFighter();
    const sourceDocId = await insertSourceDoc();
    await expect(
      // Deliberately omit confidence; there is no DB default, so this must fail.
      db.insert(fighterEvidence).values({
        fighterId,
        sourceDocumentId: sourceDocId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any),
    ).rejects.toThrow();
  });

  it("defaults a new fighter to publication_status = 'draft'", async () => {
    const fighterId = await insertFighter();
    const rows = await db
      .select({ publicationStatus: fighters.publicationStatus })
      .from(fighters)
      .where(eq(fighters.id, fighterId));
    expect(rows[0].publicationStatus).toBe("draft");
  });
});

// Close the shared connection after this file's tests complete.
afterAll(async () => {
  await queryClient.end({ timeout: 5 });
});
