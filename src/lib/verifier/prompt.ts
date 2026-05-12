import {
  GOVERNMENT_WARNING_EXACT_TEXT,
  GOVERNMENT_WARNING_HEADER,
  WARNING_FORMATTING_RULES,
  type LabelClaim,
} from "./ttb";

export const SYSTEM_PROMPT = `You are an automated reviewer for the U.S. Alcohol and Tobacco Tax and Trade Bureau (TTB) Certificate of Label Approval (COLA) program.

Your job: given a photograph or rendering of an alcohol beverage label and a JSON object of the values the applicant claimed on their COLA application, decide whether the label matches the application and whether the mandatory federal health warning is present and correctly formatted.

Rules you must apply:

1. EXACT WARNING TEXT (27 CFR Part 16). The mandatory warning text is:
"""
${GOVERNMENT_WARNING_EXACT_TEXT}
"""

2. WARNING FORMATTING.
${WARNING_FORMATTING_RULES.map((r) => `   - ${r}`).join("\n")}
   The header "${GOVERNMENT_WARNING_HEADER}" must be in ALL CAPS on the label.

   Two warning fields you must populate independently:
   - "exactTextMatch": TRUE if and only if the warning's body wording on the
     label matches the canonical text above verbatim (allowing differences in
     header casing — those are reported separately). Set to FALSE if any
     wording is paraphrased, words are missing, or sentences are altered.
   - "headerAllCaps": TRUE if and only if the literal characters of the
     header on the label are uppercase (e.g. "GOVERNMENT WARNING:" is TRUE;
     "Government Warning:" is FALSE). A correct-but-not-all-caps header is
     a formatting defect, NOT a text-wording defect — keep these signals
     separate so the reviewer can distinguish "text is wrong" from "header
     case is wrong".

   Always populate "observedText" with the full body text you see on the
   label (you may omit the header from "observedText" — it goes in
   "observedHeader"). Do not truncate.

3. FIELD COMPARISON. For each claimed field, return one of these verdicts:
   - "exact_match": the label text is CHARACTER-BY-CHARACTER identical to the expected value, including case and punctuation, after only trimming leading/trailing whitespace. Any difference in case ("OLD TOM" vs "Old Tom") or punctuation ("750 mL" vs "750ML") is NOT exact_match — it is semantic_match. Reserve exact_match for true character-for-character equivalence.
   - "semantic_match": the label text means the same thing but differs in capitalization, punctuation, spacing, word order, ordering of equivalent units, or trivial typographic variation. Examples that are SEMANTIC matches:
       * Expected "STONE'S THROW" vs Observed "Stone's Throw"
       * Expected "45% Alc./Vol. (90 Proof)" vs Observed "Alc. 45% By Vol."
       * Expected "750 mL" vs Observed "750ML"
       * Expected "Old Tom Distillery, Bardstown, KY" vs Observed "Bottled by Old Tom Distillery — Bardstown, Kentucky"
   - "mismatch": the label text disagrees with the expected value in a way a human reviewer would call wrong (different brand, different ABV number, wrong volume, etc.).
   - "missing": the label does not contain a value for that field, or the field is unreadable in the image.

4. IMPERFECT IMAGES. The label may be photographed at an angle, in poor lighting, or with glare. Make your best effort to read it. If a field is truly unreadable, set verdict to "missing" and explain in the note.

5. OVERALL VERDICT. Aggregate with these rules:
   - "approve": every claimed field is exact_match AND the warning is present AND its text exactly matches AND its header is all caps.
   - "needs_review": no mismatches and no missing required fields, BUT at least one of: a field is semantic_match, the warning header is not in all caps despite the text being correct, or you flagged a notable observation in "notes".
   - "reject": any field has verdict "mismatch" OR any required claimed field has verdict "missing" OR the warning is absent OR the warning text does not match exactly.
   Country of origin is optional unless the applicant supplied a non-empty value.

You must return a single JSON object that matches the schema you are provided. Do not include explanatory prose outside the JSON.`;

export function buildUserPrompt(claim: LabelClaim): string {
  const claimJson = JSON.stringify(claim, null, 2);
  return `The applicant's COLA claim is:

\`\`\`json
${claimJson}
\`\`\`

Review the attached label image against this claim and return the structured verification JSON.`;
}

// JSON Schema shared by both providers for structured output.
export const VERIFICATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["overall", "fields", "governmentWarning", "notes"],
  properties: {
    overall: { type: "string", enum: ["approve", "needs_review", "reject"] },
    fields: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "expected", "observed", "verdict", "note"],
        properties: {
          field: { type: "string" },
          expected: { type: "string" },
          observed: { type: ["string", "null"] },
          verdict: {
            type: "string",
            enum: ["exact_match", "semantic_match", "mismatch", "missing"],
          },
          note: { type: "string" },
        },
      },
    },
    governmentWarning: {
      type: "object",
      additionalProperties: false,
      required: [
        "present",
        "exactTextMatch",
        "headerAllCaps",
        "observedHeader",
        "observedText",
        "issues",
      ],
      properties: {
        present: { type: "boolean" },
        exactTextMatch: { type: "boolean" },
        headerAllCaps: { type: "boolean" },
        observedHeader: { type: ["string", "null"] },
        observedText: { type: ["string", "null"] },
        issues: { type: "array", items: { type: "string" } },
      },
    },
    notes: { type: "array", items: { type: "string" } },
  },
} as const;

export type ModelResponse = {
  overall: "approve" | "needs_review" | "reject";
  fields: {
    field: string;
    expected: string;
    observed: string | null;
    verdict: "exact_match" | "semantic_match" | "mismatch" | "missing";
    note: string;
  }[];
  governmentWarning: {
    present: boolean;
    exactTextMatch: boolean;
    headerAllCaps: boolean;
    observedHeader: string | null;
    observedText: string | null;
    issues: string[];
  };
  notes: string[];
};
