import type { LabelClaim } from "./ttb";
export type { LabelClaim, BeverageType } from "./ttb";

export type MatchVerdict = "exact_match" | "semantic_match" | "mismatch" | "missing";

export interface FieldResult {
  field: string;
  expected: string;
  observed: string | null;
  verdict: MatchVerdict;
  note?: string;
  /** 1-based index into the submitted images this value was read from, or null if not found on any. */
  sourceImage?: number | null;
}

export interface GovernmentWarningResult {
  present: boolean;
  exactTextMatch: boolean;
  headerAllCaps: boolean;
  observedHeader: string | null;
  observedText: string | null;
  issues: string[];
  /** 1-based index into the submitted images the warning was read from, or null if not found on any. */
  sourceImage?: number | null;
}

export interface ImageQualityResult {
  readable: boolean;
  issues: string[];
}

export type OverallVerdict = "approve" | "needs_review" | "reject";

export interface VerificationResult {
  overall: OverallVerdict;
  fields: FieldResult[];
  governmentWarning: GovernmentWarningResult;
  imageQuality: ImageQualityResult;
  notes: string[];
  latencyMs: number;
  provider: "anthropic" | "openai";
  model: string;
}

export interface LabelImage {
  imageBase64: string;
  mimeType: string;
}

export interface VerifyInput {
  /** One or more images of the same physical label set (e.g. front, back, neck). */
  images: LabelImage[];
  claim: LabelClaim;
}

export interface LabelVerifier {
  verify(input: VerifyInput): Promise<VerificationResult>;
  readonly provider: "anthropic" | "openai";
  readonly model: string;
}
