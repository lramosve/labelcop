import { describe, it, expect } from "vitest";
import { finalizeResult } from "./postprocess";
import { GOVERNMENT_WARNING_EXACT_TEXT } from "./ttb";
import type { ModelResponse } from "./prompt";
import type { LabelClaim } from "./types";

const BASE_CLAIM: LabelClaim = {
  brandName: "OLD TOM DISTILLERY",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
  producer: "Old Tom Distillery, Bardstown, KY",
  countryOfOrigin: "",
};

function compliantWarning(): ModelResponse["governmentWarning"] {
  return {
    present: true,
    exactTextMatch: true, // ignored — finalizeResult re-derives
    headerAllCaps: true, // ignored — finalizeResult re-derives
    observedHeader: "GOVERNMENT WARNING:",
    observedText: GOVERNMENT_WARNING_EXACT_TEXT,
    issues: [],
  };
}

function field(
  name: string,
  verdict: ModelResponse["fields"][number]["verdict"],
  observed: string | null = "ok",
) {
  return { field: name, expected: "expected", observed, verdict, note: "" };
}

function withCtx(data: ModelResponse, claim: LabelClaim = BASE_CLAIM) {
  return finalizeResult(data, { latencyMs: 123, provider: "openai", model: "gpt-5.4-mini", claim });
}

describe("finalizeResult — overall verdict aggregation", () => {
  it('returns "approve" when all fields exact_match and warning fully compliant', () => {
    const result = withCtx({
      overall: "approve",
      fields: [field("brandName", "exact_match"), field("alcoholContent", "exact_match")],
      governmentWarning: compliantWarning(),
      notes: [],
    });
    expect(result.overall).toBe("approve");
    expect(result.governmentWarning.exactTextMatch).toBe(true);
    expect(result.governmentWarning.headerAllCaps).toBe(true);
    expect(result.governmentWarning.issues).toEqual([]);
  });

  it('returns "needs_review" when a field is semantic_match (Dave\'s STONE\'S THROW case)', () => {
    const result = withCtx({
      overall: "approve", // model said approve; postprocess should downgrade
      fields: [
        field("brandName", "semantic_match", "Stone's Throw"),
        field("alcoholContent", "exact_match"),
      ],
      governmentWarning: compliantWarning(),
      notes: [],
    });
    expect(result.overall).toBe("needs_review");
  });

  it('returns "reject" when any field is mismatch', () => {
    const result = withCtx({
      overall: "needs_review",
      fields: [field("alcoholContent", "mismatch", "50% Alc./Vol.")],
      governmentWarning: compliantWarning(),
      notes: [],
    });
    expect(result.overall).toBe("reject");
  });

  it('returns "reject" when a required field is missing', () => {
    const result = withCtx({
      overall: "approve",
      fields: [field("brandName", "missing", null)],
      governmentWarning: compliantWarning(),
      notes: [],
    });
    expect(result.overall).toBe("reject");
  });
});

describe("finalizeResult — government warning re-checks", () => {
  it("marks exactTextMatch false and rejects when observed text is paraphrased", () => {
    // Aggressively paraphrased so the keyword safety net rejects it
    // even if the model returned exactTextMatch=true. Only "government warning"
    // matches (1 key phrase) — well below the ambiguous-middle threshold.
    const paraphrased =
      "Drinking may harm pregnant women, cause impaired driving, and lead to health complications.";
    const result = withCtx({
      overall: "needs_review",
      fields: [field("brandName", "exact_match")],
      governmentWarning: {
        present: true,
        exactTextMatch: true, // model lied; postprocess must override
        headerAllCaps: true,
        observedHeader: "GOVERNMENT WARNING:",
        observedText: paraphrased,
        issues: [],
      },
      notes: [],
    });
    expect(result.governmentWarning.exactTextMatch).toBe(false);
    expect(result.overall).toBe("reject");
    expect(result.governmentWarning.issues.join(" ")).toMatch(/regulatory wording/i);
  });

  it("tolerates OCR truncation when enough canonical key phrases are present", () => {
    // Vision models occasionally truncate observedText mid-sentence even when
    // the full warning is on the label. With ≥5 of the 7 canonical key phrases
    // present, we should still mark exactTextMatch true.
    const truncated =
      "(1) According to the Surgeon General, women should not drink alcoholic " +
      "beverages during pregnancy because of the risk of birth defects. " +
      "(2) Consumption of alcoholic beverages impairs your ability to drive a " +
      "car or operate machinery, and may";
    const result = withCtx({
      overall: "approve",
      fields: [field("brandName", "exact_match")],
      governmentWarning: {
        present: true,
        exactTextMatch: false, // model under-reported; safety net should rescue
        headerAllCaps: true,
        observedHeader: "GOVERNMENT WARNING:",
        observedText: truncated,
        issues: [],
      },
      notes: [],
    });
    expect(result.governmentWarning.exactTextMatch).toBe(true);
    expect(result.overall).toBe("approve");
  });

  it("treats whitespace-only differences in warning text as exact match", () => {
    const wonky = GOVERNMENT_WARNING_EXACT_TEXT.replace(/ /g, "  ").replace(/\./g, ".\n");
    const result = withCtx({
      overall: "approve",
      fields: [field("brandName", "exact_match")],
      governmentWarning: { ...compliantWarning(), observedText: wonky },
      notes: [],
    });
    expect(result.governmentWarning.exactTextMatch).toBe(true);
    expect(result.overall).toBe("approve");
  });

  it("flags non-all-caps header as needs_review even when text is correct (Jenny's title-case case)", () => {
    const result = withCtx({
      overall: "approve",
      fields: [field("brandName", "exact_match")],
      governmentWarning: {
        present: true,
        exactTextMatch: true,
        headerAllCaps: true,
        observedHeader: "Government Warning:",
        observedText: GOVERNMENT_WARNING_EXACT_TEXT,
        issues: [],
      },
      notes: [],
    });
    expect(result.governmentWarning.headerAllCaps).toBe(false);
    expect(result.overall).toBe("needs_review");
    expect(result.governmentWarning.issues.join(" ")).toMatch(/all caps/i);
  });

  it("rejects when the warning is absent altogether", () => {
    const result = withCtx({
      overall: "approve",
      fields: [field("brandName", "exact_match")],
      governmentWarning: {
        present: false,
        exactTextMatch: false,
        headerAllCaps: false,
        observedHeader: null,
        observedText: null,
        issues: [],
      },
      notes: [],
    });
    expect(result.overall).toBe("reject");
    expect(result.governmentWarning.issues.join(" ")).toMatch(/missing/i);
  });
});

describe("finalizeResult — country of origin is optional", () => {
  it("ignores a missing country-of-origin field when applicant did not claim one", () => {
    const result = withCtx({
      overall: "needs_review",
      fields: [
        field("brandName", "exact_match"),
        field("countryOfOrigin", "missing", null),
      ],
      governmentWarning: compliantWarning(),
      notes: [],
    });
    // Should still be approve — applicant left countryOfOrigin blank in BASE_CLAIM.
    expect(result.overall).toBe("approve");
  });

  it("rejects when country-of-origin is claimed but missing on the label", () => {
    const result = withCtx(
      {
        overall: "approve",
        fields: [
          field("brandName", "exact_match"),
          field("countryOfOrigin", "missing", null),
        ],
        governmentWarning: compliantWarning(),
        notes: [],
      },
      { ...BASE_CLAIM, countryOfOrigin: "Product of Scotland" },
    );
    expect(result.overall).toBe("reject");
  });
});

describe("finalizeResult — passes through provider metadata", () => {
  it("preserves latency, provider and model on the returned result", () => {
    const result = withCtx({
      overall: "approve",
      fields: [field("brandName", "exact_match")],
      governmentWarning: compliantWarning(),
      notes: ["looks clean"],
    });
    expect(result.latencyMs).toBe(123);
    expect(result.provider).toBe("openai");
    expect(result.model).toBe("gpt-5.4-mini");
    expect(result.notes).toEqual(["looks clean"]);
  });
});
