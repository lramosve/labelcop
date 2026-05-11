import { GOVERNMENT_WARNING_EXACT_TEXT, GOVERNMENT_WARNING_HEADER, type LabelClaim } from "./ttb";
import type { ModelResponse } from "./prompt";
import type { OverallVerdict, VerificationResult } from "./types";

// Server-side checks that don't depend on model judgment.
// We re-evaluate the warning text against the canonical regulatory text rather
// than trusting the model's `exactTextMatch` flag — this avoids drift if the
// model paraphrases or normalizes whitespace.
function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

interface FinalizeContext {
  latencyMs: number;
  provider: "anthropic" | "openai";
  model: string;
  claim: LabelClaim;
}

export function finalizeResult(data: ModelResponse, ctx: FinalizeContext): VerificationResult {
  const observedText = data.governmentWarning.observedText ?? "";
  const exactTextMatch =
    !!observedText && normalize(observedText) === normalize(GOVERNMENT_WARNING_EXACT_TEXT);
  const observedHeader = data.governmentWarning.observedHeader ?? "";
  const headerAllCaps =
    !!observedHeader && observedHeader.replace(/[^A-Za-z:]/g, "") ===
      observedHeader.replace(/[^A-Za-z:]/g, "").toUpperCase() &&
    observedHeader.toUpperCase().includes("GOVERNMENT WARNING");

  const warning = {
    ...data.governmentWarning,
    exactTextMatch,
    headerAllCaps,
    issues: [...data.governmentWarning.issues],
  };
  if (warning.present && !exactTextMatch) {
    warning.issues.push(
      `Warning text does not match the regulatory wording exactly. Required: "${GOVERNMENT_WARNING_EXACT_TEXT}"`,
    );
  }
  if (warning.present && !headerAllCaps) {
    warning.issues.push(
      `Header is not in all caps. Required form: "${GOVERNMENT_WARNING_HEADER}"`,
    );
  }
  if (!warning.present) {
    warning.issues.push("Government warning is missing from the label.");
  }

  // Re-derive overall so it's consistent with the deterministic warning check
  // and treats an empty country-of-origin claim as not required.
  const overall = deriveOverall(data, warning.exactTextMatch, warning.headerAllCaps, ctx.claim);

  return {
    overall,
    fields: data.fields,
    governmentWarning: warning,
    notes: data.notes,
    latencyMs: ctx.latencyMs,
    provider: ctx.provider,
    model: ctx.model,
  };
}

function deriveOverall(
  data: ModelResponse,
  exactWarningText: boolean,
  headerAllCaps: boolean,
  claim: LabelClaim,
): OverallVerdict {
  const fields = data.fields.filter((f) => {
    // Skip country of origin if the applicant didn't claim one.
    if (f.field.toLowerCase().includes("country") && !claim.countryOfOrigin?.trim()) return false;
    return true;
  });

  const anyMismatch = fields.some((f) => f.verdict === "mismatch");
  const anyMissing = fields.some((f) => f.verdict === "missing");
  const anySemantic = fields.some((f) => f.verdict === "semantic_match");

  const warningOK = data.governmentWarning.present && exactWarningText && headerAllCaps;
  const warningPresentButFormat =
    data.governmentWarning.present && exactWarningText && !headerAllCaps;

  if (anyMismatch || anyMissing || !data.governmentWarning.present || !exactWarningText) {
    return "reject";
  }
  if (anySemantic || warningPresentButFormat) {
    return "needs_review";
  }
  if (warningOK) return "approve";
  return "needs_review";
}
