import OpenAI from "openai";
import {
  SYSTEM_PROMPT,
  VERIFICATION_JSON_SCHEMA,
  buildUserPrompt,
  type ModelResponse,
} from "./prompt";
import type { LabelVerifier, VerificationResult, VerifyInput } from "./types";
import { finalizeResult } from "./postprocess";

const DEFAULT_MODEL = "gpt-5.4-mini";

export function createOpenAIVerifier(): LabelVerifier {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  // maxRetries (default 2) covers 429 / 5xx / connection errors with
  // exponential backoff inside the SDK. Bumping to 3 for the batch flow,
  // where a transient blip across a 200-row run is otherwise quite painful.
  const client = new OpenAI({ apiKey, maxRetries: 3 });

  return {
    provider: "openai",
    model,
    async verify({ images, claim }: VerifyInput): Promise<VerificationResult> {
      const started = Date.now();
      const imageContent = images.flatMap((img, i) => [
        { type: "text" as const, text: `Image ${i + 1}:` },
        {
          type: "image_url" as const,
          image_url: { url: `data:${img.mimeType};base64,${img.imageBase64}` },
        },
      ]);
      const response = await client.chat.completions.create({
        model,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "label_verification",
            strict: true,
            // The OpenAI SDK accepts a JSON Schema-shaped object here.
            schema: VERIFICATION_JSON_SCHEMA as unknown as Record<string, unknown>,
          },
        },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: buildUserPrompt(claim, images.length) },
              ...imageContent,
            ],
          },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("OpenAI response was empty");
      }
      const data = JSON.parse(content) as ModelResponse;
      return finalizeResult(data, {
        latencyMs: Date.now() - started,
        provider: "openai",
        model,
        claim,
      });
    },
  };
}
