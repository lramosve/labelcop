// Shared browser-side fetch helper for /api/verify. Centralizes the request
// timeout and the network-realities-aware error message so both the single
// and batch flows degrade the same way when a call can't reach the provider
// (slow connection, or a government-network firewall silently dropping the
// outbound call — see Marcus Williams' interview notes).

import type { LabelClaim } from "./ttb";
import type { VerificationResult } from "./types";
import { MAX_IMAGE_BYTES, NETWORK_UNREACHABLE_MESSAGE, VERIFY_TIMEOUT_MS, formatBytes } from "./limits";

export function validateImageFile(file: File): string | null {
  if (file.size > MAX_IMAGE_BYTES) {
    return `Image is ${formatBytes(file.size)}, which is over the ${formatBytes(MAX_IMAGE_BYTES)} limit. Use a smaller photo or a more compressed format.`;
  }
  return null;
}

export async function verifyLabel(image: File, claim: LabelClaim): Promise<VerificationResult> {
  const sizeError = validateImageFile(image);
  if (sizeError) throw new Error(sizeError);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  try {
    const fd = new FormData();
    fd.append("image", image);
    fd.append("claim", JSON.stringify(claim));
    const r = await fetch("/api/verify", { method: "POST", body: fd, signal: controller.signal });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error ?? `Verification failed (HTTP ${r.status})`);
    return data as VerificationResult;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error(NETWORK_UNREACHABLE_MESSAGE);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
