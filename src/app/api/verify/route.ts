import { NextRequest, NextResponse } from "next/server";
import { getVerifier } from "@/lib/verifier";
import type { LabelClaim } from "@/lib/verifier";
import { MAX_IMAGE_BYTES, NETWORK_UNREACHABLE_MESSAGE, VERIFY_TIMEOUT_MS, formatBytes } from "@/lib/verifier/limits";

export const runtime = "nodejs";
// Kept a few seconds above VERIFY_TIMEOUT_MS so our own timeout (which
// returns a clear, actionable message) fires before the platform kills the
// function outright.
export const maxDuration = 30;

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

class VerifyTimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new VerifyTimeoutError(NETWORK_UNREACHABLE_MESSAGE)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("image");
    const claimRaw = formData.get("claim");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing 'image' file in form data." }, { status: 400 });
    }
    if (typeof claimRaw !== "string") {
      return NextResponse.json(
        { error: "Missing 'claim' JSON field in form data." },
        { status: 400 },
      );
    }
    const mimeType = file.type || "image/png";
    if (!ALLOWED_MIME.has(mimeType)) {
      return NextResponse.json(
        { error: `Unsupported image type "${mimeType}". Use PNG, JPEG, WEBP, or GIF.` },
        { status: 400 },
      );
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        {
          error: `Image is ${formatBytes(file.size)}, which is over the ${formatBytes(MAX_IMAGE_BYTES)} limit. Use a smaller photo or a more compressed format.`,
        },
        { status: 400 },
      );
    }

    let claim: LabelClaim;
    try {
      claim = JSON.parse(claimRaw) as LabelClaim;
    } catch {
      return NextResponse.json({ error: "Invalid claim JSON." }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const imageBase64 = buf.toString("base64");

    const verifier = getVerifier();
    const result = await withTimeout(
      verifier.verify({ imageBase64, mimeType, claim }),
      VERIFY_TIMEOUT_MS,
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = err instanceof VerifyTimeoutError ? 504 : 500;
    console.error("[/api/verify] failed:", err);
    return NextResponse.json({ error: message }, { status });
  }
}
