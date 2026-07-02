import { pgTable, uuid, text, date, timestamp } from "drizzle-orm/pg-core";
import { sourceType } from "./enums";

/**
 * A specific retrieved source document (provenance), not a generic publisher
 * record. See docs/DATABASE.md "source_documents — a specific retrieved source".
 */
export const sourceDocuments = pgTable("source_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  publisher: text("publisher").notNull(),
  title: text("title"),
  url: text("url"),
  sourceType: sourceType("source_type").notNull(),
  publishedAt: date("published_at"),
  retrievedAt: date("retrieved_at"),
  licenseName: text("license_name"),
  licenseUrl: text("license_url"),
  // App-enforced required for licensed_feed sources and any image (not DB-enforced).
  licenseNotes: text("license_notes"),
  archivedUrl: text("archived_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
