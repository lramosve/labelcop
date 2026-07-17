import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { UploadZone } from "./UploadZone";

function makeFile(name: string, type = "image/png", sizeBytes = 1024): File {
  const file = new File([new Uint8Array(sizeBytes)], name, { type });
  return file;
}

describe("UploadZone", () => {
  it("has no obvious accessibility violations in the empty state", async () => {
    const { container } = render(
      <UploadZone file={null} previewUrl={null} onChange={vi.fn()} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("exposes a clear aria-label describing the current state", () => {
    render(<UploadZone file={null} previewUrl={null} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /upload a label image/i })).toBeInTheDocument();
  });

  it("opens the file picker on Enter and Space keypresses", async () => {
    // userEvent realistically simulates the ARIA authoring-practices
    // expectation that a role="button" element responds to Enter/Space —
    // real browsers don't do this natively for a plain <div>, which is why
    // the component also wires an explicit onKeyDown handler. Between the
    // two, click() may fire more than once per keypress in this simulated
    // environment; what matters is that it fires at least once.
    const user = userEvent.setup();
    render(<UploadZone file={null} previewUrl={null} onChange={vi.fn()} />);
    const zone = screen.getByRole("button");
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");
    zone.focus();
    await user.keyboard("{Enter}");
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockClear();
    await user.keyboard(" ");
    expect(clickSpy).toHaveBeenCalled();
  });

  it("accepts a dropped image file", () => {
    const onChange = vi.fn();
    render(<UploadZone file={null} previewUrl={null} onChange={onChange} />);
    const zone = screen.getByRole("button");
    const file = makeFile("label.png");
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    expect(onChange).toHaveBeenCalledWith(file);
  });

  it("rejects a non-image file with a visible message and does not call onChange", () => {
    const onChange = vi.fn();
    render(<UploadZone file={null} previewUrl={null} onChange={onChange} />);
    const zone = screen.getByRole("button");
    const file = makeFile("not-an-image.txt", "text/plain");
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/doesn't look like an image/i);
  });

  it("rejects an oversized image with a plain-language size message", () => {
    const onChange = vi.fn();
    render(<UploadZone file={null} previewUrl={null} onChange={onChange} />);
    const zone = screen.getByRole("button");
    const file = makeFile("huge.png", "image/png", 9 * 1024 * 1024);
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/over the .* limit/i);
  });

  it("shows a Remove button once a file is selected and clears it on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const file = makeFile("label.png");
    render(<UploadZone file={file} previewUrl="blob:preview" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /remove/i }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
