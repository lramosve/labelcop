import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const provider = (process.env.LLM_PROVIDER || "openai").toLowerCase();
  const model =
    provider === "openai"
      ? process.env.OPENAI_MODEL || "gpt-5.4-mini"
      : process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  const configured =
    provider === "openai" ? !!process.env.OPENAI_API_KEY : !!process.env.ANTHROPIC_API_KEY;
  return NextResponse.json({ provider, model, configured });
}
