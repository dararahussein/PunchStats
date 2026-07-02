// Fictional data for local development and automated tests. Do not add real fighters here — see docs/SLICE_1_FOUNDATION.md.

export type SourceDocumentFixture = {
  id: string;
  publisher: string;
  title: string | null;
  url: string | null;
  sourceType: "official" | "media_report" | "editorial" | "user_submission" | "licensed_feed";
  publishedAt: string | null;
  retrievedAt: string | null;
  licenseName: string | null;
  licenseUrl: string | null;
  licenseNotes: string | null;
  archivedUrl: string | null;
};

export const SOURCE_DOC_ID = "00000000-0000-4000-8000-000000000201";

export const sourceDocumentsFixture: SourceDocumentFixture[] = [
  {
    id: SOURCE_DOC_ID,
    publisher: "Test Commission",
    title: "Test Commission Report (fictional)",
    url: null,
    sourceType: "official",
    publishedAt: "2020-01-01",
    retrievedAt: "2020-01-02",
    licenseName: null,
    licenseUrl: null,
    licenseNotes: null,
    archivedUrl: null,
  },
];
