import { describe, it, expect } from "vitest";
import {
  buildResultsCsvRecords,
  csvRecordToBatchRow,
  imageKey,
  markMissingImages,
  rowsWithoutImage,
  type BatchRow,
} from "./batch";
import type { VerificationResult } from "@/lib/verifier/types";

const SAMPLE_RECORD = {
  imageFilename: "  old_tom_750ml.png  ",
  brandName: " OLD TOM DISTILLERY ",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
  producer: "Old Tom Distillery, Bardstown, KY",
  countryOfOrigin: "  ",
  beverageType: " Spirits ",
};

function fakeResult(overrides: Partial<VerificationResult> = {}): VerificationResult {
  return {
    overall: "approve",
    fields: [
      { field: "brandName", expected: "OLD TOM", observed: "OLD TOM", verdict: "exact_match", note: "" },
      { field: "alcoholContent", expected: "45%", observed: "45%", verdict: "exact_match", note: "" },
      { field: "netContents", expected: "750 mL", observed: "750ML", verdict: "semantic_match", note: "" },
    ],
    governmentWarning: {
      present: true,
      exactTextMatch: true,
      headerAllCaps: true,
      observedHeader: "GOVERNMENT WARNING:",
      observedText: "(1) ...",
      issues: [],
    },
    imageQuality: { readable: true, issues: [] },
    notes: [],
    latencyMs: 2700,
    provider: "openai",
    model: "gpt-5.4-mini",
    ...overrides,
  };
}

describe("csvRecordToBatchRow", () => {
  it("trims whitespace from every field and normalizes the beverage type", () => {
    const row = csvRecordToBatchRow(SAMPLE_RECORD, 0);
    expect(row.imageFilename).toBe("old_tom_750ml.png");
    expect(row.claim.brandName).toBe("OLD TOM DISTILLERY");
    expect(row.claim.beverageType).toBe("spirits");
  });

  it("collapses a blank countryOfOrigin to undefined (it is optional)", () => {
    const row = csvRecordToBatchRow(SAMPLE_RECORD, 0);
    expect(row.claim.countryOfOrigin).toBeUndefined();
  });

  it("preserves a non-empty countryOfOrigin", () => {
    const row = csvRecordToBatchRow(
      { ...SAMPLE_RECORD, countryOfOrigin: " Product of Scotland " },
      0,
    );
    expect(row.claim.countryOfOrigin).toBe("Product of Scotland");
  });

  it("defaults the row to queued status with the provided rowIndex", () => {
    const row = csvRecordToBatchRow(SAMPLE_RECORD, 7);
    expect(row.status).toBe("queued");
    expect(row.rowIndex).toBe(7);
  });

  it("tolerates missing optional columns", () => {
    const row = csvRecordToBatchRow(
      { imageFilename: "x.png", brandName: "Acme" },
      0,
    );
    expect(row.claim.brandName).toBe("Acme");
    expect(row.claim.classType).toBe("");
    expect(row.claim.beverageType).toBeUndefined();
  });
});

describe("imageKey / matching", () => {
  const rows: BatchRow[] = [
    csvRecordToBatchRow({ imageFilename: "Old_Tom.png", brandName: "A" }, 0),
    csvRecordToBatchRow({ imageFilename: "STONES_THROW.PNG", brandName: "B" }, 1),
    csvRecordToBatchRow({ imageFilename: "missing.png", brandName: "C" }, 2),
  ];

  it("matches uploaded image filenames case-insensitively", () => {
    const uploaded = ["old_tom.png", "stones_throw.png"];
    const missing = rowsWithoutImage(rows, uploaded);
    expect(missing).toHaveLength(1);
    expect(missing[0].imageFilename).toBe("missing.png");
  });

  it("marks unmatched rows with status 'missing_image' without touching matched ones", () => {
    const marked = markMissingImages(rows, ["old_tom.png", "stones_throw.png"]);
    expect(marked[0].status).toBe("queued");
    expect(marked[1].status).toBe("queued");
    expect(marked[2].status).toBe("missing_image");
  });

  it("imageKey is the lowercase form used everywhere for matching", () => {
    expect(imageKey("Foo.PNG")).toBe("foo.png");
  });
});

describe("buildResultsCsvRecords", () => {
  it("flattens per-row results into the CSV shape, with verdict counts", () => {
    const rows: BatchRow[] = [
      {
        ...csvRecordToBatchRow({ imageFilename: "ok.png", brandName: "OK" }, 0),
        status: "done",
        result: fakeResult(),
      },
      {
        ...csvRecordToBatchRow({ imageFilename: "missing.png", brandName: "M" }, 1),
        status: "missing_image",
      },
      {
        ...csvRecordToBatchRow({ imageFilename: "bad.png", brandName: "B" }, 2),
        status: "error",
        error: "network timeout",
      },
    ];
    const records = buildResultsCsvRecords(rows);
    expect(records).toHaveLength(3);

    // Row 0: successful result, counts derived.
    expect(records[0]).toMatchObject({
      imageFilename: "ok.png",
      brandName: "OK",
      status: "done",
      overall: "approve",
      warningPresent: true,
      warningExactText: true,
      warningHeaderAllCaps: true,
      fieldsExact: 2,
      fieldsSemantic: 1,
      fieldsMismatch: 0,
      fieldsMissing: 0,
      latencyMs: 2700,
      error: "",
    });

    // Row 1: never ran — result columns blank, status reflects state.
    expect(records[1]).toMatchObject({
      status: "missing_image",
      overall: "",
      warningPresent: "",
      fieldsExact: "",
      error: "",
    });

    // Row 2: errored — the error text is preserved for CSV consumers.
    expect(records[2].status).toBe("error");
    expect(records[2].error).toBe("network timeout");
  });
});
