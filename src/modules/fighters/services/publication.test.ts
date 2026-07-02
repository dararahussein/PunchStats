import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db, queryClient } from "@/db/client";
import { fighters, sourceDocuments, fighterEvidence } from "@/db/schema";
import { publishFighter, deleteFighterEvidence } from "./publication";

const createdFighterIds: string[] = [];
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
  createdFighterIds.length = 0;
  createdSourceDocIds.length = 0;
});

afterAll(async () => {
  await queryClient.end({ timeout: 5 });
});

async function insertFighter() {
  const id = randomUUID();
  createdFighterIds.push(id);
  await db.insert(fighters).values({
    id,
    slug: `pub-${id}`,
    fullName: "Publication Test Fighter",
    status: "active",
  });
  return id;
}

async function insertSourceDoc() {
  const id = randomUUID();
  createdSourceDocIds.push(id);
  await db
    .insert(sourceDocuments)
    .values({ id, publisher: "Pub Test Source", sourceType: "official" });
  return id;
}

async function insertEvidence(
  fighterId: string,
  sourceDocId: string,
  opts: {
    verificationStatus?: "verified" | "unverified" | "user_submitted" | "disputed";
    confidence?: "high" | "medium" | "low";
  } = {},
) {
  const id = randomUUID();
  await db.insert(fighterEvidence).values({
    id,
    fighterId,
    sourceDocumentId: sourceDocId,
    verificationStatus: opts.verificationStatus ?? "verified",
    confidence: opts.confidence ?? "high",
  });
  return id;
}

async function getStatus(fighterId: string) {
  const rows = await db
    .select({ s: fighters.publicationStatus })
    .from(fighters)
    .where(eq(fighters.id, fighterId));
  return rows[0]?.s;
}

async function countEvidence(fighterId: string) {
  const rows = await db
    .select({ id: fighterEvidence.id })
    .from(fighterEvidence)
    .where(eq(fighterEvidence.fighterId, fighterId));
  return rows.length;
}

describe("publishFighter", () => {
  it("creates a draft fighter with zero evidence via a plain insert", async () => {
    const fighterId = await insertFighter();
    expect(await getStatus(fighterId)).toBe("draft");
    expect(await countEvidence(fighterId)).toBe(0);
  });

  it("fails with no qualifying evidence and leaves the fighter draft", async () => {
    const fighterId = await insertFighter();
    const result = await publishFighter(fighterId);
    expect(result).toEqual({ ok: false, error: "NO_QUALIFYING_EVIDENCE" });
    expect(await getStatus(fighterId)).toBe("draft");
  });

  it("succeeds with one verified high-confidence evidence row", async () => {
    const fighterId = await insertFighter();
    const sourceDocId = await insertSourceDoc();
    await insertEvidence(fighterId, sourceDocId, {
      verificationStatus: "verified",
      confidence: "high",
    });
    const result = await publishFighter(fighterId);
    expect(result).toEqual({ ok: true });
    expect(await getStatus(fighterId)).toBe("published");
  });

  it("succeeds with one verified medium-confidence evidence row", async () => {
    const fighterId = await insertFighter();
    const sourceDocId = await insertSourceDoc();
    await insertEvidence(fighterId, sourceDocId, {
      verificationStatus: "verified",
      confidence: "medium",
    });
    expect(await publishFighter(fighterId)).toEqual({ ok: true });
    expect(await getStatus(fighterId)).toBe("published");
  });

  it("FAILS on verified-but-low-confidence evidence (confidence floor is real)", async () => {
    const fighterId = await insertFighter();
    const sourceDocId = await insertSourceDoc();
    await insertEvidence(fighterId, sourceDocId, {
      verificationStatus: "verified",
      confidence: "low",
    });
    const result = await publishFighter(fighterId);
    expect(result).toEqual({ ok: false, error: "NO_QUALIFYING_EVIDENCE" });
    expect(await getStatus(fighterId)).toBe("draft");
  });

  it("returns FIGHTER_NOT_FOUND for an unknown fighter", async () => {
    const result = await publishFighter(randomUUID());
    expect(result).toEqual({ ok: false, error: "FIGHTER_NOT_FOUND" });
  });
});

describe("deleteFighterEvidence", () => {
  it("reverts a published fighter to draft when its only qualifying row is removed", async () => {
    const fighterId = await insertFighter();
    const sourceDocId = await insertSourceDoc();
    const evidenceId = await insertEvidence(fighterId, sourceDocId, {
      verificationStatus: "verified",
      confidence: "high",
    });
    expect(await publishFighter(fighterId)).toEqual({ ok: true });
    expect(await getStatus(fighterId)).toBe("published");

    const result = await deleteFighterEvidence(evidenceId);
    expect(result).toEqual({ ok: true, revertedToDraft: true });
    expect(await getStatus(fighterId)).toBe("draft");
    expect(await countEvidence(fighterId)).toBe(0);
  });

  it("leaves the fighter published when one of several qualifying rows is removed", async () => {
    const fighterId = await insertFighter();
    const sourceDocId = await insertSourceDoc();
    const e1 = await insertEvidence(fighterId, sourceDocId, {
      verificationStatus: "verified",
      confidence: "high",
    });
    await insertEvidence(fighterId, sourceDocId, {
      verificationStatus: "verified",
      confidence: "medium",
    });
    expect(await publishFighter(fighterId)).toEqual({ ok: true });

    const result = await deleteFighterEvidence(e1);
    expect(result).toEqual({ ok: true, revertedToDraft: false });
    expect(await getStatus(fighterId)).toBe("published");
  });

  it("does not change status when a non-qualifying row is removed and qualifying evidence remains", async () => {
    const fighterId = await insertFighter();
    const sourceDocId = await insertSourceDoc();
    await insertEvidence(fighterId, sourceDocId, {
      verificationStatus: "verified",
      confidence: "high",
    });
    // Non-qualifying: verified but low confidence.
    const nonQualifying = await insertEvidence(fighterId, sourceDocId, {
      verificationStatus: "verified",
      confidence: "low",
    });
    expect(await publishFighter(fighterId)).toEqual({ ok: true });

    const result = await deleteFighterEvidence(nonQualifying);
    expect(result).toEqual({ ok: true, revertedToDraft: false });
    expect(await getStatus(fighterId)).toBe("published");
  });

  it("returns EVIDENCE_NOT_FOUND for an unknown evidence id", async () => {
    expect(await deleteFighterEvidence(randomUUID())).toEqual({
      ok: false,
      error: "EVIDENCE_NOT_FOUND",
    });
  });
});

describe("concurrency", () => {
  it("publishFighter + deleteFighterEvidence on the last qualifying row never lands in the broken in-between", async () => {
    // Run the race repeatedly to shake out interleavings.
    for (let i = 0; i < 5; i++) {
      const fighterId = await insertFighter();
      const sourceDocId = await insertSourceDoc();
      const evidenceId = await insertEvidence(fighterId, sourceDocId, {
        verificationStatus: "verified",
        confidence: "high",
      });

      // Fire both near-simultaneously at the same fighter's last qualifying row.
      const [publishResult] = await Promise.allSettled([
        publishFighter(fighterId),
        deleteFighterEvidence(evidenceId),
      ]);

      const finalStatus = await getStatus(fighterId);
      const remaining = await countEvidence(fighterId);

      // The invariant: a published fighter must have qualifying evidence.
      // Fighter-row locking serializes the two ops, so the end state is always
      // one of the two consistent outcomes, never published-with-zero-evidence.
      if (finalStatus === "published") {
        expect(remaining).toBeGreaterThan(0);
      } else {
        expect(finalStatus).toBe("draft");
      }

      // Sanity: publishFighter either committed (ok) or was serialized behind
      // the delete and found no qualifying evidence — both are acceptable.
      expect(publishResult.status).toBe("fulfilled");
    }
  });
});
