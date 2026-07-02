import { and, eq, inArray, sql } from "drizzle-orm";
import { fighterEvidence } from "../schema";
import type { db } from "../client";

/**
 * A Drizzle handle that may be either the base `db` client or a transaction
 * object passed into a `db.transaction(async (tx) => ...)` callback. Both share
 * the same query-builder surface used by these primitives.
 */
export type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Count the fighter's *qualifying* evidence rows, per docs/DATABASE.md:
 *   - belongs to the fighter,
 *   - verification_status = 'verified',
 *   - confidence IN ('high', 'medium')  (low never qualifies, even if verified),
 *   - source_document_id FK resolves (guaranteed by the NOT NULL FK in schema).
 *
 * Runs on whatever handle is passed in, so callers can invoke it inside the
 * same transaction (and after the fighter row is locked) that they mutate in.
 */
export async function countQualifyingEvidence(
  handle: DbOrTx,
  fighterId: string,
): Promise<number> {
  const rows = await handle
    .select({ count: sql<number>`count(*)::int` })
    .from(fighterEvidence)
    .where(
      and(
        eq(fighterEvidence.fighterId, fighterId),
        eq(fighterEvidence.verificationStatus, "verified"),
        inArray(fighterEvidence.confidence, ["high", "medium"]),
      ),
    );

  return rows[0]?.count ?? 0;
}
