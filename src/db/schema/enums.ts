import { pgEnum } from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Provenance / evidence enums (shared across source_documents, fighter_evidence,
// fighter_aliases). See docs/DATABASE.md "Provenance and evidence model".
// ---------------------------------------------------------------------------

/** A specific retrieved source document's kind. */
export const sourceType = pgEnum("source_type", [
  "official",
  "media_report",
  "editorial",
  "user_submission",
  "licensed_feed",
]);

/** Editorial review workflow state of a claim (Tier 1 rows or Tier 2 evidence rows). */
export const verificationStatus = pgEnum("verification_status", [
  "verified",
  "unverified",
  "user_submitted",
  "disputed",
]);

/**
 * Evidence quality, independent of the review workflow (Tier 2 evidence only).
 * - high:   authoritative or directly verifiable source (commission license, primary document).
 * - medium: credible secondary source, or partially corroborated information.
 * - low:    uncertain, conflicting, incomplete, or awaiting confirmation.
 */
export const confidenceLevel = pgEnum("confidence_level", [
  "high",
  "medium",
  "low",
]);

// ---------------------------------------------------------------------------
// Fighter publication state. Gates public visibility; unrelated to career
// `status`. See docs/DATABASE.md "Resolving the missing-citation invariant".
// ---------------------------------------------------------------------------
export const fighterPublicationStatus = pgEnum("fighter_publication_status", [
  "draft",
  "published",
  "archived",
]);

// ---------------------------------------------------------------------------
// Weight class enums.
// ---------------------------------------------------------------------------
export const weightClassGenderEnum = pgEnum("weight_class_gender", [
  "male",
  "female",
]);

// ---------------------------------------------------------------------------
// Fighter enums.
// ---------------------------------------------------------------------------
export const fighterStanceEnum = pgEnum("fighter_stance", [
  "orthodox",
  "southpaw",
  "switch",
]);

export const fighterStatusEnum = pgEnum("fighter_status", [
  "active",
  "inactive",
  "retired",
  "deceased",
]);

// ---------------------------------------------------------------------------
// Fighter alias enum.
// ---------------------------------------------------------------------------
export const fighterAliasKindEnum = pgEnum("fighter_alias_kind", [
  "nickname",
  "ring_name",
  "spelling_variant",
  "birth_name",
]);
