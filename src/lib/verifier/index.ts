import type { LabelVerifier } from "./types";
import { createAnthropicVerifier } from "./anthropic";
import { createOpenAIVerifier } from "./openai";

export type Provider = "anthropic" | "openai";

let cached: LabelVerifier | null = null;

export function getVerifier(): LabelVerifier {
  if (cached) return cached;
  const provider = (process.env.LLM_PROVIDER || "openai").toLowerCase() as Provider;
  switch (provider) {
    case "openai":
      cached = createOpenAIVerifier();
      return cached;
    case "anthropic":
      cached = createAnthropicVerifier();
      return cached;
    default:
      throw new Error(
        `Unknown LLM_PROVIDER "${provider}". Set LLM_PROVIDER to "anthropic" or "openai".`,
      );
  }
}

export function resetVerifierForTest(): void {
  cached = null;
}

export type {
  LabelVerifier,
  VerificationResult,
  FieldResult,
  GovernmentWarningResult,
  ImageQualityResult,
} from "./types";
export type { LabelClaim, BeverageType } from "./ttb";
