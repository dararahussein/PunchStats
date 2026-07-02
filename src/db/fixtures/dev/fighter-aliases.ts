// Fictional data for local development and automated tests. Do not add real fighters here — see docs/SLICE_1_FOUNDATION.md.

import { FIGHTER_ONE_ID, FIGHTER_TWO_ID } from "./fighters";
import { SOURCE_DOC_ID } from "./source-documents";

export type FighterAliasFixture = {
  id: string;
  fighterId: string;
  alias: string;
  kind: "nickname" | "ring_name" | "spelling_variant" | "birth_name";
  sourceDocumentId: string | null;
  verificationStatus: "verified" | "unverified" | "user_submitted" | "disputed";
};

export const fighterAliasesFixture: FighterAliasFixture[] = [
  {
    id: "00000000-0000-4000-8000-000000000401",
    fighterId: FIGHTER_ONE_ID,
    alias: "TF1",
    kind: "nickname",
    sourceDocumentId: SOURCE_DOC_ID,
    verificationStatus: "verified",
  },
  {
    id: "00000000-0000-4000-8000-000000000402",
    fighterId: FIGHTER_TWO_ID,
    alias: "JE",
    kind: "nickname",
    sourceDocumentId: null,
    verificationStatus: "unverified",
  },
];
