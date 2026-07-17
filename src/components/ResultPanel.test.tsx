import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { ResultPanel } from "./ResultPanel";
import type { VerificationResult } from "@/lib/verifier/types";
import { GOVERNMENT_WARNING_EXACT_TEXT } from "@/lib/verifier/ttb";

function baseResult(overrides: Partial<VerificationResult> = {}): VerificationResult {
  return {
    overall: "approve",
    fields: [
      { field: "brandName", expected: "OLD TOM", observed: "OLD TOM", verdict: "exact_match", note: "" },
    ],
    governmentWarning: {
      present: true,
      exactTextMatch: true,
      headerAllCaps: true,
      observedHeader: "GOVERNMENT WARNING:",
      observedText: GOVERNMENT_WARNING_EXACT_TEXT,
      issues: [],
    },
    imageQuality: { readable: true, issues: [] },
    notes: [],
    latencyMs: 2700,
    provider: "openai",
    model: "gpt-5.4-mini",
    ...overrides,
  };
}

describe("ResultPanel", () => {
  it("has no obvious accessibility violations on an approve result", async () => {
    const { container } = render(<ResultPanel result={baseResult()} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders the Approve badge for an approve verdict", () => {
    render(<ResultPanel result={baseResult({ overall: "approve" })} />);
    expect(screen.getByText("Approve")).toBeInTheDocument();
  });

  it("renders the Needs Review badge for a needs_review verdict", () => {
    render(<ResultPanel result={baseResult({ overall: "needs_review" })} />);
    expect(screen.getByText("Needs Review")).toBeInTheDocument();
  });

  it("renders the Reject badge and warning issues for a reject verdict", () => {
    render(
      <ResultPanel
        result={baseResult({
          overall: "reject",
          governmentWarning: {
            present: false,
            exactTextMatch: false,
            headerAllCaps: false,
            observedHeader: null,
            observedText: null,
            issues: ["Government warning is missing from the label."],
          },
        })}
      />,
    );
    expect(screen.getByText("Reject")).toBeInTheDocument();
    expect(screen.getByText(/missing from the label/i)).toBeInTheDocument();
  });

  it("does not render an image-quality banner when the image was clean", () => {
    render(<ResultPanel result={baseResult()} />);
    expect(screen.queryByText(/hard to read/i)).not.toBeInTheDocument();
  });

  it("renders an image-quality banner when issues are reported", () => {
    render(
      <ResultPanel
        result={baseResult({ imageQuality: { readable: true, issues: ["glare", "angle"] } })}
      />,
    );
    expect(screen.getByText(/hard to read/i)).toBeInTheDocument();
    expect(screen.getByText(/glare on the label/i)).toBeInTheDocument();
  });

  it("renders an unreadable-image banner distinctly when readable is false", () => {
    render(
      <ResultPanel
        result={baseResult({ imageQuality: { readable: false, issues: ["blurry"] } })}
      />,
    );
    expect(screen.getByText(/could not be reliably read/i)).toBeInTheDocument();
  });
});
