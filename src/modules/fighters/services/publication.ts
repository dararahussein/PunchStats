import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { fighters, fighterEvidence } from "@/db/schema";
import { countQualifyingEvidence } from "@/db/queries/fighter-evidence";

/**
 * Fighter publication-state business logic. This is fighter-domain write logic,
 * NOT a generic database concern — it lives in the fighters module and calls the
 * transaction/query primitives the db layer exposes. See docs/DATABASE.md
 * "Resolving the missing-citation invariant: fighter publication state".
 *
 * Invariant: a fighter may only be `published` while it has at least one
 * *qualifying* fighter_evidence row (verified + confidence high|medium). Nothing
 * else in the codebase may write `publication_status`.
 */

export type PublishFighterResult =
  | { ok: true }
  | { ok: false; error: "FIGHTER_NOT_FOUND" | "NO_QUALIFYING_EVIDENCE" };

export type DeleteFighterEvidenceResult =
  | { ok: true; revertedToDraft: boolean }
  | { ok: false; error: "EVIDENCE_NOT_FOUND" };

/**
 * Publish a fighter iff it has qualifying evidence.
 *
 * One transaction: lock the fighter row FIRST (`SELECT ... FOR UPDATE`), then
 * count qualifying evidence. Zero => roll back with a typed failure. >=1 =>
 * set publication_status = 'published' and commit. Locking first serializes this
 * against a concurrent deleteFighterEvidence on the same fighter's last row.
 */
export async function publishFighter(
  fighterId: string,
): Promise<PublishFighterResult> {
  return db.transaction(async (tx) => {
    const locked = await tx
      .select({ id: fighters.id })
      .from(fighters)
      .where(eq(fighters.id, fighterId))
      .for("update");

    if (locked.length === 0) {
      return { ok: false, error: "FIGHTER_NOT_FOUND" };
    }

    const qualifying = await countQualifyingEvidence(tx, fighterId);
    if (qualifying === 0) {
      return { ok: false, error: "NO_QUALIFYING_EVIDENCE" };
    }

    await tx
      .update(fighters)
      .set({ publicationStatus: "published", updatedAt: new Date() })
      .where(eq(fighters.id, fighterId));

    return { ok: true };
  });
}

/**
 * Delete a piece of evidence, auto-reverting the fighter to `draft` if that
 * removed its last qualifying row while published.
 *
 * One transaction: read the evidence row's fighter_id, lock THAT fighter row
 * (`SELECT ... FOR UPDATE`) BEFORE deleting anything, delete the evidence row,
 * re-count qualifying evidence, and only if the count is now zero AND the locked
 * fighter is currently 'published', set it back to 'draft' — all in the same
 * transaction. Policy is auto-revert, not reject-the-delete.
 */
export async function deleteFighterEvidence(
  evidenceId: string,
): Promise<DeleteFighterEvidenceResult> {
  return db.transaction(async (tx) => {
    const evidenceRows = await tx
      .select({ fighterId: fighterEvidence.fighterId })
      .from(fighterEvidence)
      .where(eq(fighterEvidence.id, evidenceId));

    const evidence = evidenceRows[0];
    if (!evidence) {
      return { ok: false, error: "EVIDENCE_NOT_FOUND" };
    }

    // Lock the fighter row BEFORE deleting anything — this is what serializes
    // us against a concurrent publishFighter on the same fighter.
    const lockedFighter = await tx
      .select({ publicationStatus: fighters.publicationStatus })
      .from(fighters)
      .where(eq(fighters.id, evidence.fighterId))
      .for("update");

    await tx
      .delete(fighterEvidence)
      .where(eq(fighterEvidence.id, evidenceId));

    const remaining = await countQualifyingEvidence(tx, evidence.fighterId);

    let revertedToDraft = false;
    const currentStatus = lockedFighter[0]?.publicationStatus;
    if (remaining === 0 && currentStatus === "published") {
      await tx
        .update(fighters)
        .set({ publicationStatus: "draft", updatedAt: new Date() })
        .where(eq(fighters.id, evidence.fighterId));
      revertedToDraft = true;
    }

    return { ok: true, revertedToDraft };
  });
}
