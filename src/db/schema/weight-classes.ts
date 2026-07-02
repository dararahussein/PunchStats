import { pgTable, uuid, text, numeric, smallint, timestamp } from "drizzle-orm/pg-core";
import { weightClassGenderEnum } from "./enums";

/**
 * Divisions per gender, with poundage limits. Sport-rule reference data —
 * NO provenance columns (see docs/DATABASE.md "Two tiers, not one universal table").
 */
export const weightClasses = pgTable("weight_classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  gender: weightClassGenderEnum("gender").notNull(),
  // NULL for heavyweight — no upper limit.
  limitLbs: numeric("limit_lbs", { precision: 5, scale: 1 }),
  sortOrder: smallint("sort_order").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
