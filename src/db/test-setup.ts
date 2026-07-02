// Point the DB client at the dedicated test database for every test file.
// Runs (via vitest `setupFiles`) before any test module imports src/db/client,
// which reads process.env.DATABASE_URL at import time.
const testUrl = process.env.DATABASE_URL_TEST;
if (!testUrl) {
  throw new Error(
    "DATABASE_URL_TEST is not set. Integration tests require a test database " +
      "(e.g. postgresql://postgres:dev@localhost:5432/punchstats_test).",
  );
}
process.env.DATABASE_URL = testUrl;
