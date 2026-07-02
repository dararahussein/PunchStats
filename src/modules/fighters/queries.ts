import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { fighters, weightClasses } from "@/db/schema";

/**
 * Public query: list all published fighters with their division information.
 *
 * Filters on publication_status = 'published' — draft and archived fighters are
 * never visible to public queries. This is the read-side enforcement of the
 * invariant defined in docs/DATABASE.md "Resolving the missing-citation
 * invariant: fighter publication state".
 *
 * Returns fighters ordered by full name.
 */
export async function listFighters() {
  const result = await db
    .select({
      slug: fighters.slug,
      fullName: fighters.fullName,
      nickname: fighters.nickname,
      divisionName: weightClasses.name,
      divisionSlug: weightClasses.slug,
      status: fighters.status,
    })
    .from(fighters)
    .leftJoin(
      weightClasses,
      eq(fighters.primaryWeightClassId, weightClasses.id),
    )
    .where(eq(fighters.publicationStatus, "published"))
    .orderBy(fighters.fullName);

  return result;
}
