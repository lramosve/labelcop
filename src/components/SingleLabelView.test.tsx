import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SingleLabelView } from "./SingleLabelView";
import { GOVERNMENT_WARNING_EXACT_TEXT } from "@/lib/verifier/ttb";

function makeImageFile(name = "label.png") {
  return new File([new Uint8Array(1024)], name, { type: "image/png" });
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SingleLabelView", () => {
  it("disables Verify Label until both a brand name and an image are present", async () => {
    const user = userEvent.setup();
    render(<SingleLabelView />);
    const verifyButton = screen.getByRole("button", { name: /verify label/i });
    expect(verifyButton).toBeDisabled();

    await user.type(screen.getByLabelText(/brand name/i), "OLD TOM DISTILLERY");
    expect(verifyButton).toBeDisabled(); // still no image

    const dropzone = screen.getByRole("button", { name: /upload label images/i });
    fireEvent.drop(dropzone, { dataTransfer: { files: [makeImageFile()] } });

    await waitFor(() => expect(verifyButton).toBeEnabled());
  });

  it("submits every attached image (front + back label) in the verify request", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
      jsonResponse({
        overall: "approve",
        fields: [],
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
        latencyMs: 2100,
        provider: "openai",
        model: "gpt-5.4-mini",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<SingleLabelView />);
    await user.type(screen.getByLabelText(/brand name/i), "OLD TOM DISTILLERY");
    const dropzone = screen.getByRole("button", { name: /upload label images/i });
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [makeImageFile("front.png"), makeImageFile("back.png")] },
    });
    expect(screen.getByText(/front\.png/)).toBeInTheDocument();
    expect(screen.getByText(/back\.png/)).toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole("button", { name: /verify label/i })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: /verify label/i }));
    await screen.findByText("Approve");

    const [, requestInit] = fetchMock.mock.calls[0];
    const submittedImages = (requestInit!.body as FormData).getAll("image") as File[];
    expect(submittedImages.map((f) => f.name)).toEqual(["front.png", "back.png"]);
  });

  it("includes a beverage-type selector defaulting to Distilled Spirits", () => {
    render(<SingleLabelView />);
    const select = screen.getByLabelText(/beverage type/i) as HTMLSelectElement;
    expect(select.value).toBe("spirits");
    expect(screen.getByRole("option", { name: /wine/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /beer/i })).toBeInTheDocument();
  });

  it("loadExample fills the form with the sample claim", async () => {
    const user = userEvent.setup();
    render(<SingleLabelView />);
    await user.click(screen.getByRole("button", { name: /load example/i }));
    expect(screen.getByLabelText(/brand name/i)).toHaveValue("OLD TOM DISTILLERY");
  });

  it("shows the error banner when verification fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse({ error: "Verification timed out" }, false, 504)),
    );
    render(<SingleLabelView />);
    await user.type(screen.getByLabelText(/brand name/i), "OLD TOM DISTILLERY");
    fireEvent.drop(screen.getByRole("button", { name: /upload label images/i }), {
      dataTransfer: { files: [makeImageFile()] },
    });
    await waitFor(() => expect(screen.getByRole("button", { name: /verify label/i })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: /verify label/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/timed out/i);
  });

  it("renders the ResultPanel on a successful verification", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        jsonResponse({
          overall: "approve",
          fields: [],
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
          latencyMs: 2100,
          provider: "openai",
          model: "gpt-5.4-mini",
        }),
      ),
    );
    render(<SingleLabelView />);
    await user.type(screen.getByLabelText(/brand name/i), "OLD TOM DISTILLERY");
    fireEvent.drop(screen.getByRole("button", { name: /upload label images/i }), {
      dataTransfer: { files: [makeImageFile()] },
    });
    await waitFor(() => expect(screen.getByRole("button", { name: /verify label/i })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: /verify label/i }));

    expect(await screen.findByText("Approve")).toBeInTheDocument();
  });
});
