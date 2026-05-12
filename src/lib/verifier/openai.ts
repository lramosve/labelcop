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
  const client = new OpenAI({ apiKey });

  return {
    provider: "openai",
    model,
    async verify({ imageBase64, mimeType, claim }: VerifyInput): Promise<VerificationResult> {
      const started = Date.now();
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
              { type: "text", text: buildUserPrompt(claim) },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${imageBase64}` },
              },
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
