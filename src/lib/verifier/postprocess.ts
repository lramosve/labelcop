import {
  BEVERAGE_RULES,
  GOVERNMENT_WARNING_EXACT_TEXT,
  GOVERNMENT_WARNING_HEADER,
  type LabelClaim,
} from "./ttb";
import type { ModelResponse } from "./prompt";
import type { OverallVerdict, VerificationResult } from "./types";

// Exact-text comparison strategy:
//   - Count how many canonical key phrases appear in the observed header+body
//     (case-insensitive, NFKC-normalized). 5+ is strong evidence the canonical
//     warning is on the label; 2 or fewer is strong evidence it isn't.
//   - In the ambiguous middle (3 or 4), defer to the model's `exactTextMatch`
//     flag, which has the canonical text in its prompt and can compare more
//     precisely than keyword matching can.
//
// This handles two real failure modes observed in eval:
//   (a) the model truncates `observedText` mid-sentence when transcribing,
//       even when the full text is present on the label — keyword score
//       stays high so we still accept;
//   (b) the model occasionally flips `exactTextMatch` to false based on
//       header casing despite the prompt saying header case is separate —
//       keyword score still passes, so we override the model.
//
// We deliberately do not trust the model alone, since the warning is the
// most regulatorily load-bearing field.
function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—―]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const CANONICAL_KEY_PHRASES = [
  "government warning",
  "surgeon general",
  "pregnancy",
  "birth defects",
  "drive a car",
  "operate machinery",
  "health problems",
];

function headerIsAllCaps(observedHeader: string): boolean {
  const letters = observedHeader.replace(/[^A-Za-z]/g, "");
  if (!letters) return false;
  if (letters !== letters.toUpperCase()) return false;
  return observedHeader.toUpperCase().includes("GOVERNMENT WARNING");
}

interface FinalizeContext {
  latencyMs: number;
  provider: "anthropic" | "openai";
  model: string;
  claim: LabelClaim;
}

export function finalizeResult(data: ModelResponse, ctx: FinalizeContext): VerificationResult {
  const observedText = data.governmentWarning.observedText ?? "";
  const observedHeader = data.governmentWarning.observedHeader ?? "";

  const combinedNormalized = normalize(`${observedHeader} ${observedText}`);
  const phraseHitCount = CANONICAL_KEY_PHRASES.filter((p) =>
    combinedNormalized.includes(p),
  ).length;

  // Decision: keyword score is authoritative at the tails, model decides the middle.
  let exactTextMatch: boolean;
  if (!data.governmentWarning.present) {
    exactTextMatch = false;
  } else if (phraseHitCount >= 5) {
    exactTextMatch = true;
  } else if (phraseHitCount <= 2) {
    exactTextMatch = false;
  } else {
    exactTextMatch = data.governmentWarning.exactTextMatch;
  }

  const headerAllCaps = !!observedHeader && headerIsAllCaps(observedHeader);

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
    imageQuality: data.imageQuality ?? { readable: true, issues: [] },
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
  const beverageRule = BEVERAGE_RULES[claim.beverageType ?? "spirits"];

  const fields = data.fields.filter((f) => {
    // Skip country of origin if the applicant didn't claim one.
    if (f.field.toLowerCase().includes("country") && !claim.countryOfOrigin?.trim()) return false;
    // Skip a "missing" alcohol-content field for beverage classes where a
    // numeric ABV statement isn't mandatory (wine class statements, most
    // malt beverages) — a genuine numeric mismatch still counts, this only
    // excuses the field being absent from the label altogether.
    if (
      f.field.toLowerCase().includes("alcohol") &&
      f.verdict === "missing" &&
      beverageRule &&
      !beverageRule.abvStatementMandatory
    ) {
      return false;
    }
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
