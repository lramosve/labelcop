import Anthropic from "@anthropic-ai/sdk";
import {
  SYSTEM_PROMPT,
  VERIFICATION_JSON_SCHEMA,
  buildUserPrompt,
  type ModelResponse,
} from "./prompt";
import type { LabelVerifier, VerificationResult, VerifyInput } from "./types";
import { finalizeResult } from "./postprocess";

const DEFAULT_MODEL = "claude-sonnet-4-6";

export function createAnthropicVerifier(): LabelVerifier {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const client = new Anthropic({ apiKey });

  return {
    provider: "anthropic",
    model,
    async verify({ imageBase64, mimeType, claim }: VerifyInput): Promise<VerificationResult> {
      const started = Date.now();
      const response = await client.messages.create({
        model,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools: [
          {
            name: "submit_verification",
            description: "Submit the final label-versus-application verification result.",
            // The Anthropic SDK accepts a JSON Schema-shaped object here.
            input_schema: VERIFICATION_JSON_SCHEMA as unknown as Anthropic.Tool.InputSchema,
          },
        ],
        tool_choice: { type: "tool", name: "submit_verification" },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
                  data: imageBase64,
                },
              },
              { type: "text", text: buildUserPrompt(claim) },
            ],
          },
        ],
      });

      const toolUse = response.content.find((b) => b.type === "tool_use");
      if (!toolUse || toolUse.type !== "tool_use") {
        throw new Error("Anthropic response did not include the expected tool_use block");
      }
      const data = toolUse.input as ModelResponse;
      return finalizeResult(data, {
        latencyMs: Date.now() - started,
        provider: "anthropic",
        model,
        claim,
      });
    },
  };
}
