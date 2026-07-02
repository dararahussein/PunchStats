// Fictional data for local development and automated tests. Do not add real fighters here — see docs/SLICE_1_FOUNDATION.md.

import { FIGHTER_ONE_ID } from "./fighters";
import { SOURCE_DOC_ID } from "./source-documents";

export type FighterEvidenceFixture = {
  id: string;
  fighterId: string;
  fieldName: string | null;
  sourceDocumentId: string;
  sourceValue: string | null;
  verificationStatus: "verified" | "unverified" | "user_submitted" | "disputed";
  confidence: "high" | "medium" | "low";
  notes: string | null;
  verifiedBy: string | null;
  verifiedAt: Date | null;
};

// One qualifying row for FIGHTER_ONE (verified + high) so the seed can publish it.
export const fighterEvidenceFixture: FighterEvidenceFixture[] = [
  {
    id: "00000000-0000-4000-8000-000000000301",
    fighterId: FIGHTER_ONE_ID,
    fieldName: "birth_date",
    sourceDocumentId: SOURCE_DOC_ID,
    sourceValue: "1990-01-15",
    verificationStatus: "verified",
    confidence: "high",
    notes: "Fictional example evidence to exercise the publish invariant.",
    verifiedBy: "Fixture Editor",
    verifiedAt: new Date("2020-01-03T00:00:00Z"),
  },
];
