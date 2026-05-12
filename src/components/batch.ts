// Pure (browser-API-free) logic for the batch verification flow. This lives
// in its own module so it can be unit-tested without rendering React or
// touching File / Blob / URL APIs.

import type { LabelClaim } from "@/lib/verifier";
import type { VerificationResult } from "@/lib/verifier/types";

export type BatchStatus = "queued" | "running" | "done" | "error" | "missing_image";

export interface BatchRow {
  rowIndex: number;
  imageFilename: string;
  claim: LabelClaim;
  status: BatchStatus;
  result?: VerificationResult;
  error?: string;
}

export const TEMPLATE_HEADERS = [
  "imageFilename",
  "brandName",
  "classType",
  "alcoholContent",
  "netContents",
  "producer",
  "countryOfOrigin",
  "beverageType",
] as const;

export const TEMPLATE_ROWS: string[][] = [
  [
    "01-perfect-label.png",
    "OLD TOM DISTILLERY",
    "Kentucky Straight Bourbon Whiskey",
    "45% Alc./Vol. (90 Proof)",
    "750 mL",
    "Old Tom Distillery, Bardstown, KY",
    "",
    "spirits",
  ],
];

// Filenames of the demo PNGs served from /public/demo/. The "Try sample batch"
// button fetches these and a hand-crafted CSV so a reviewer can exercise the
// batch flow without finding their own labels.
export const SAMPLE_BATCH_IMAGES = [
  "01-perfect-label.png",
  "02-lowercase-warning-header.png",
  "03-missing-warning.png",
] as const;

export const SAMPLE_BATCH_BASE_CLAIM: LabelClaim = {
  brandName: "OLD TOM DISTILLERY",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
  producer: "Old Tom Distillery, Bardstown, KY",
  countryOfOrigin: undefined,
  beverageType: "spirits",
};

/** Lowercase a filename for case-insensitive matching against uploaded images. */
export function imageKey(filename: string): string {
  return filename.toLowerCase();
}

/**
 * Convert a single parsed CSV record (header → cell) into a BatchRow.
 * Trims whitespace, normalizes empty country-of-origin to undefined, and
 * lowercases the beverage type. Unknown columns are ignored.
 */
export function csvRecordToBatchRow(
  record: Record<string, string | undefined>,
  rowIndex: number,
): BatchRow {
  const beverageRaw = (record.beverageType ?? "").trim().toLowerCase();
  return {
    rowIndex,
    imageFilename: (record.imageFilename ?? "").trim(),
    claim: {
      brandName: (record.brandName ?? "").trim(),
      classType: (record.classType ?? "").trim(),
      alcoholContent: (record.alcoholContent ?? "").trim(),
      netContents: (record.netContents ?? "").trim(),
      producer: (record.producer ?? "").trim(),
      countryOfOrigin: (record.countryOfOrigin ?? "").trim() || undefined,
      beverageType: beverageRaw ? (beverageRaw as LabelClaim["beverageType"]) : undefined,
    },
    status: "queued",
  };
}

/** Returns the rows whose imageFilename does not match any uploaded image. */
export function rowsWithoutImage(rows: BatchRow[], availableImageKeys: Iterable<string>): BatchRow[] {
  const have = new Set<string>();
  for (const k of availableImageKeys) have.add(imageKey(k));
  return rows.filter((r) => !have.has(imageKey(r.imageFilename)));
}

/** Mark rows that have no matching image with status "missing_image". */
export function markMissingImages(
  rows: BatchRow[],
  availableImageKeys: Iterable<string>,
): BatchRow[] {
  const have = new Set<string>();
  for (const k of availableImageKeys) have.add(imageKey(k));
  return rows.map((r) => (have.has(imageKey(r.imageFilename)) ? r : { ...r, status: "missing_image" }));
}

export interface ResultsCsvRecord {
  imageFilename: string;
  brandName: string;
  status: BatchStatus;
  overall: string;
  warningPresent: boolean | "";
  warningExactText: boolean | "";
  warningHeaderAllCaps: boolean | "";
  fieldsExact: number | "";
  fieldsSemantic: number | "";
  fieldsMismatch: number | "";
  fieldsMissing: number | "";
  latencyMs: number | "";
  error: string;
}

/**
 * Build a flat CSV-shaped record list from a batch's terminal state.
 * Empty strings (rather than nulls) are used for cells that are not
 * applicable (e.g. result fields when a row never ran) so the resulting
 * CSV is consistent with Papa Parse's defaults.
 */
export function buildResultsCsvRecords(rows: BatchRow[]): ResultsCsvRecord[] {
  return rows.map((r) => ({
    imageFilename: r.imageFilename,
    brandName: r.claim.brandName,
    status: r.status,
    overall: r.result?.overall ?? "",
    warningPresent: r.result?.governmentWarning.present ?? "",
    warningExactText: r.result?.governmentWarning.exactTextMatch ?? "",
    warningHeaderAllCaps: r.result?.governmentWarning.headerAllCaps ?? "",
    fieldsExact: r.result?.fields.filter((f) => f.verdict === "exact_match").length ?? "",
    fieldsSemantic: r.result?.fields.filter((f) => f.verdict === "semantic_match").length ?? "",
    fieldsMismatch: r.result?.fields.filter((f) => f.verdict === "mismatch").length ?? "",
    fieldsMissing: r.result?.fields.filter((f) => f.verdict === "missing").length ?? "",
    latencyMs: r.result?.latencyMs ?? "",
    error: r.error ?? "",
  }));
}
