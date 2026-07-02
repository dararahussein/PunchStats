import { pgTable, uuid, text, date, char, smallint, timestamp } from "drizzle-orm/pg-core";
import {
  fighterStanceEnum,
  fighterStatusEnum,
  fighterPublicationStatus,
} from "./enums";
import { weightClasses } from "./weight-classes";

/**
 * Canonical fighter records. Tier 2 multi-field entity — carries NO
 * source_id/verification_status columns; provenance lives in `fighter_evidence`.
 * See docs/DATABASE.md "fighters" and "Provenance and evidence model".
 *
 * Record-count columns (record_wins/losses/...) are intentionally omitted here:
 * they depend on `bouts`, which don't exist until Slice 3.
 */
export const fighters = pgTable("fighters", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  fullName: text("full_name").notNull(),
  nickname: text("nickname"),
  birthDate: date("birth_date"),
  // ISO 3166-1 alpha-2.
  nationality: char("nationality", { length: 2 }),
  stance: fighterStanceEnum("stance"),
  heightCm: smallint("height_cm"),
  reachCm: smallint("reach_cm"),
  status: fighterStatusEnum("status").notNull(),
  primaryWeightClassId: uuid("primary_weight_class_id").references(
    () => weightClasses.id,
  ),
  // Gates public visibility. Independent of `status` (career state).
  // Only publishFighter / deleteFighterEvidence may write this column.
  publicationStatus: fighterPublicationStatus("publication_status")
    .notNull()
    .default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
