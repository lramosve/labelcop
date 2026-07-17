import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const verifyMock = vi.fn();

vi.mock("@/lib/verifier", () => ({
  getVerifier: () => ({
    provider: "openai",
    model: "gpt-5.4-mini",
    verify: verifyMock,
  }),
}));

// Shrink the timeout to keep the test fast and avoid fighting fake timers
// against Next's real (I/O-backed) FormData parsing.
vi.mock("@/lib/verifier/limits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/verifier/limits")>();
  return { ...actual, VERIFY_TIMEOUT_MS: 50 };
});

// Imported after the mock so the route picks up the mocked getVerifier.
const { POST } = await import("./route");

const VALID_CLAIM = {
  brandName: "OLD TOM DISTILLERY",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
  producer: "Old Tom Distillery, Bardstown, KY",
  countryOfOrigin: "",
  beverageType: "spirits",
};

function makeImageFile(sizeBytes = 1024, type = "image/png") {
  return new File([new Uint8Array(sizeBytes)], "label.png", { type });
}

function makeRequest(fields: { image?: File; claim?: string }) {
  const formData = new FormData();
  if (fields.image !== undefined) formData.append("image", fields.image);
  if (fields.claim !== undefined) formData.append("claim", fields.claim);
  return new NextRequest("http://localhost/api/verify", { method: "POST", body: formData });
}

beforeEach(() => {
  verifyMock.mockReset();
});

describe("POST /api/verify", () => {
  it("400s when the image file is missing", async () => {
    const res = await POST(makeRequest({ claim: JSON.stringify(VALID_CLAIM) }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/missing 'image'/i);
  });

  it("400s when the claim field is missing", async () => {
    const res = await POST(makeRequest({ image: makeImageFile() }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/missing 'claim'/i);
  });

  it("400s when the claim field is not valid JSON", async () => {
    const res = await POST(makeRequest({ image: makeImageFile(), claim: "{not json" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid claim json/i);
  });

  it("400s on a disallowed mime type", async () => {
    const res = await POST(
      makeRequest({
        image: makeImageFile(1024, "application/pdf"),
        claim: JSON.stringify(VALID_CLAIM),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/unsupported image type/i);
  });

  it("400s on an oversized image", async () => {
    const res = await POST(
      makeRequest({
        image: makeImageFile(9 * 1024 * 1024),
        claim: JSON.stringify(VALID_CLAIM),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/over the .* limit/i);
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it("returns the verifier's result on the happy path", async () => {
    verifyMock.mockResolvedValue({
      overall: "approve",
      fields: [],
      governmentWarning: {
        present: true,
        exactTextMatch: true,
        headerAllCaps: true,
        observedHeader: "GOVERNMENT WARNING:",
        observedText: "...",
        issues: [],
      },
      imageQuality: { readable: true, issues: [] },
      notes: [],
      latencyMs: 2100,
      provider: "openai",
      model: "gpt-5.4-mini",
    });
    const res = await POST(
      makeRequest({ image: makeImageFile(), claim: JSON.stringify(VALID_CLAIM) }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.overall).toBe("approve");
    expect(verifyMock).toHaveBeenCalledTimes(1);
    const callArg = verifyMock.mock.calls[0][0];
    expect(callArg.claim).toEqual(VALID_CLAIM);
    expect(callArg.mimeType).toBe("image/png");
  });

  it("returns a 504 with a network-realities message when the verifier hangs past the timeout", async () => {
    verifyMock.mockImplementation(() => new Promise(() => {})); // never resolves
    const res = await POST(
      makeRequest({ image: makeImageFile(), claim: JSON.stringify(VALID_CLAIM) }),
    );
    expect(res.status).toBe(504);
    const body = await res.json();
    expect(body.error).toMatch(/could not reach the ai provider/i);
  });

  it("propagates a verifier error as a 500", async () => {
    verifyMock.mockRejectedValue(new Error("provider blew up"));
    const res = await POST(
      makeRequest({ image: makeImageFile(), claim: JSON.stringify(VALID_CLAIM) }),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/provider blew up/i);
  });
});
