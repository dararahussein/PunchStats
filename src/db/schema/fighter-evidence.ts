import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { verificationStatus, confidenceLevel } from "./enums";
import { fighters } from "./fighters";
import { sourceDocuments } from "./source-documents";

/**
 * The first (and, for Slice 1B, only) Tier 2 evidence table. One row per claim
 * about a fighter field (or the whole fighter when field_name IS NULL).
 *
 * Named for the one entity it covers — NOT a generic `entity_evidence` table:
 * a real FK to fighters(id) gives referential integrity + cascade delete that a
 * polymorphic (entity_type, entity_id) pair cannot. See docs/DATABASE.md
 * "Why per-domain evidence tables, not one generic polymorphic table".
 */
export const fighterEvidence = pgTable(
  "fighter_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fighterId: uuid("fighter_id")
      .notNull()
      .references(() => fighters.id, { onDelete: "cascade" }),
    // NULL = whole-fighter claim; else a specific column, e.g. 'birth_date'.
    fieldName: text("field_name"),
    sourceDocumentId: uuid("source_document_id")
      .notNull()
      .references(() => sourceDocuments.id),
    // The value as that source reported it, verbatim.
    sourceValue: text("source_value"),
    verificationStatus: verificationStatus("verification_status")
      .notNull()
      .default("unverified"),
    // NO default — every insert must choose high | medium | low explicitly.
    confidence: confidenceLevel("confidence").notNull(),
    notes: text("notes"),
    // Audit snapshot of the reviewer's name at the time — free text, NOT a FK.
    verifiedBy: text("verified_by"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("fighter_evidence_fighter").on(table.fighterId),
    index("fighter_evidence_source").on(table.sourceDocumentId),
  ],
);
