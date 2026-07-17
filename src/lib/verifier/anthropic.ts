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
  // maxRetries (default 2) covers 429 / 5xx / connection errors with
  // exponential backoff inside the SDK. Bumping to 3 for the batch flow,
  // where a transient blip across a 200-row run is otherwise quite painful.
  const client = new Anthropic({ apiKey, maxRetries: 3 });

  return {
    provider: "anthropic",
    model,
    async verify({ images, claim }: VerifyInput): Promise<VerificationResult> {
      const started = Date.now();
      const imageContent = images.flatMap((img, i) => [
        { type: "text" as const, text: `Image ${i + 1}:` },
        {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: img.mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
            data: img.imageBase64,
          },
        },
      ]);
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
            content: [...imageContent, { type: "text", text: buildUserPrompt(claim, images.length) }],
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
