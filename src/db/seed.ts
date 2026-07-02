// Seeds fictional dev/test fixtures. Real data never lives here — see
// docs/SLICE_1_FOUNDATION.md.
//
// Insert order follows FK dependencies:
//   weight_classes -> fighters -> source_documents -> fighter_aliases -> fighter_evidence
// then publishFighter() is called for the designated fighter so the seed
// exercises the real publication invariant rather than hardcoding the column.

import { db, queryClient } from "./client";
import {
  weightClasses,
  fighters,
  fighterAliases,
  sourceDocuments,
  fighterEvidence,
} from "./schema";
import { weightClassesFixture } from "./fixtures/dev/weight-classes";
import {
  fightersFixture,
  PUBLISHED_FIXTURE_FIGHTER_ID,
} from "./fixtures/dev/fighters";
import { fighterAliasesFixture } from "./fixtures/dev/fighter-aliases";
import { sourceDocumentsFixture } from "./fixtures/dev/source-documents";
import { fighterEvidenceFixture } from "./fixtures/dev/fighter-evidence";
import { publishFighter } from "@/modules/fighters/services/publication";

async function seed() {
  console.log("Seeding fictional dev fixtures...");

  await db.insert(weightClasses).values(weightClassesFixture).onConflictDoNothing();
  await db.insert(fighters).values(fightersFixture).onConflictDoNothing();
  await db.insert(sourceDocuments).values(sourceDocumentsFixture).onConflictDoNothing();
  await db.insert(fighterAliases).values(fighterAliasesFixture).onConflictDoNothing();
  await db.insert(fighterEvidence).values(fighterEvidenceFixture).onConflictDoNothing();

  // Exercise the real invariant — do NOT set publication_status directly.
  const result = await publishFighter(PUBLISHED_FIXTURE_FIGHTER_ID);
  if (!result.ok) {
    throw new Error(
      `Seed failed to publish fixture fighter ${PUBLISHED_FIXTURE_FIGHTER_ID}: ${result.error}`,
    );
  }

  console.log(
    `Published fixture fighter ${PUBLISHED_FIXTURE_FIGHTER_ID} via publishFighter().`,
  );
  console.log("Seed complete.");
}

seed()
  .then(async () => {
    await queryClient.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await queryClient.end();
    process.exit(1);
  });
