import { listFighters } from "@/modules/fighters/queries";

export default async function FightersPage() {
  const fighters = await listFighters();

  return (
    <main className="space-y-4 p-4">
      <h1 className="text-3xl font-bold text-foreground">Fighters</h1>

      {fighters.length === 0 ? (
        <p className="text-muted-foreground">No fighters found.</p>
      ) : (
        <ul className="space-y-3">
          {fighters.map((fighter) => (
            <li
              key={fighter.slug}
              className="border-l-4 border-accent bg-surface p-3"
            >
              <div className="flex flex-col gap-1">
                <div className="font-semibold text-foreground">
                  {fighter.fullName}
                </div>
                {fighter.nickname && (
                  <div className="text-sm text-muted-foreground">
                    &quot;{fighter.nickname}&quot;
                  </div>
                )}
                <div className="text-sm text-muted-foreground">
                  {fighter.divisionName ? fighter.divisionName : "No division"}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
