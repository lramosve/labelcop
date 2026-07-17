// Shared client/server constants for request limits. Values reflect the
// stakeholder-cited 5-second review budget (Sarah Chen) with headroom for
// normal network variance, plus a defensive upload-size cap — both matter
// on a government network that may rate-limit or silently drop large/slow
// outbound calls to third-party ML endpoints (Marcus Williams' firewall
// story from the discovery interviews).

export const TARGET_LATENCY_MS = 5_000;
export const VERIFY_TIMEOUT_MS = 20_000;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB per image

// A single physical product can legally split its required disclosures
// across more than one label (front/brand label, back/strip label, neck
// label) — the government warning in particular is very often on the back
// label, not the front. 4 covers front/back/neck/closure with headroom.
export const MAX_IMAGES_PER_LABEL = 4;

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const NETWORK_UNREACHABLE_MESSAGE =
  "Could not reach the AI provider in time. On restricted government networks, this " +
  "usually means the outbound endpoint isn't allow-listed by the firewall — contact IT " +
  "if this keeps happening.";
