import { pgTable, uuid, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { fighterAliasKindEnum, verificationStatus } from "./enums";
import { fighters } from "./fighters";
import { sourceDocuments } from "./source-documents";

/**
 * Nicknames, ring names, spelling variants. Tier 1 (atomic fact) — one alias,
 * one citation — so it carries direct source_document_id + verification_status
 * columns, not its own evidence table. See docs/DATABASE.md "fighter_aliases".
 */
export const fighterAliases = pgTable(
  "fighter_aliases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fighterId: uuid("fighter_id")
      .notNull()
      .references(() => fighters.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    kind: fighterAliasKindEnum("kind").notNull(),
    sourceDocumentId: uuid("source_document_id").references(
      () => sourceDocuments.id,
    ),
    verificationStatus: verificationStatus("verification_status")
      .notNull()
      .default("unverified"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fighter_aliases_fighter_lower_alias").on(
      table.fighterId,
      sql`lower(${table.alias})`,
    ),
  ],
);
