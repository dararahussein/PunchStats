import Link from "next/link";

export default function Home() {
  return (
    <main className="space-y-4 p-4">
      <h1 className="text-3xl font-bold text-foreground">PunchStats</h1>
      <nav className="space-y-2">
        <p className="text-sm text-muted-foreground">Navigation</p>
        <ul className="space-y-1">
          <li>
            <Link
              href="/fighters"
              className="text-accent hover:underline"
            >
              View fighters
            </Link>
          </li>
        </ul>
      </nav>
    </main>
  );
}
