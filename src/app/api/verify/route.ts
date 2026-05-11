import { NextRequest, NextResponse } from "next/server";
import { getVerifier } from "@/lib/verifier";
import type { LabelClaim } from "@/lib/verifier";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

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

    let claim: LabelClaim;
    try {
      claim = JSON.parse(claimRaw) as LabelClaim;
    } catch {
      return NextResponse.json({ error: "Invalid claim JSON." }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const imageBase64 = buf.toString("base64");

    const verifier = getVerifier();
    const result = await verifier.verify({ imageBase64, mimeType, claim });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/verify] failed:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
