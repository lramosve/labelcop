import type { LabelClaim } from "./ttb";
export type { LabelClaim, BeverageType } from "./ttb";

export type MatchVerdict = "exact_match" | "semantic_match" | "mismatch" | "missing";

export interface FieldResult {
  field: string;
  expected: string;
  observed: string | null;
  verdict: MatchVerdict;
  note?: string;
}

export interface GovernmentWarningResult {
  present: boolean;
  exactTextMatch: boolean;
  headerAllCaps: boolean;
  observedHeader: string | null;
  observedText: string | null;
  issues: string[];
}

export type OverallVerdict = "approve" | "needs_review" | "reject";

export interface VerificationResult {
  overall: OverallVerdict;
  fields: FieldResult[];
  governmentWarning: GovernmentWarningResult;
  notes: string[];
  latencyMs: number;
  provider: "anthropic" | "openai";
  model: string;
}

export interface VerifyInput {
  imageBase64: string;
  mimeType: string;
  claim: LabelClaim;
}

export interface LabelVerifier {
  verify(input: VerifyInput): Promise<VerificationResult>;
  readonly provider: "anthropic" | "openai";
  readonly model: string;
}
