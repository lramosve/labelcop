import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { UploadZone } from "./UploadZone";
import { MAX_IMAGES_PER_LABEL } from "@/lib/verifier/limits";

function makeFile(name: string, type = "image/png", sizeBytes = 1024): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

describe("UploadZone", () => {
  it("has no obvious accessibility violations in the empty state", async () => {
    const { container } = render(<UploadZone files={[]} previewUrls={[]} onChange={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no obvious accessibility violations with images attached", async () => {
    const files = [makeFile("front.png"), makeFile("back.png")];
    const { container } = render(
      <UploadZone files={files} previewUrls={["blob:1", "blob:2"]} onChange={vi.fn()} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("exposes a clear aria-label describing the current state", () => {
    render(<UploadZone files={[]} previewUrls={[]} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /upload label images/i })).toBeInTheDocument();
  });

  it("is a real <button> that opens the file picker on Enter and Space", async () => {
    const user = userEvent.setup();
    render(<UploadZone files={[]} previewUrls={[]} onChange={vi.fn()} />);
    const zone = screen.getByRole("button");
    expect(zone.tagName).toBe("BUTTON");
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");
    zone.focus();
    await user.keyboard("{Enter}");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    await user.keyboard(" ");
    expect(clickSpy).toHaveBeenCalledTimes(2);
  });

  it("accepts multiple dropped image files at once", () => {
    const onChange = vi.fn();
    render(<UploadZone files={[]} previewUrls={[]} onChange={onChange} />);
    const zone = screen.getByRole("button");
    const front = makeFile("front.png");
    const back = makeFile("back.png");
    fireEvent.drop(zone, { dataTransfer: { files: [front, back] } });
    expect(onChange).toHaveBeenCalledWith([front, back]);
  });

  it("appends newly dropped files to the existing selection", () => {
    const onChange = vi.fn();
    const existing = [makeFile("front.png")];
    render(<UploadZone files={existing} previewUrls={["blob:1"]} onChange={onChange} />);
    const zone = screen.getByRole("button", { name: /add another label image/i });
    const back = makeFile("back.png");
    fireEvent.drop(zone, { dataTransfer: { files: [back] } });
    expect(onChange).toHaveBeenCalledWith([existing[0], back]);
  });

  it("rejects a non-image file with a visible message and does not call onChange", () => {
    const onChange = vi.fn();
    render(<UploadZone files={[]} previewUrls={[]} onChange={onChange} />);
    const zone = screen.getByRole("button");
    const file = makeFile("not-an-image.txt", "text/plain");
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/weren't images/i);
  });

  it("rejects an oversized image with a plain-language size message", () => {
    const onChange = vi.fn();
    render(<UploadZone files={[]} previewUrls={[]} onChange={onChange} />);
    const zone = screen.getByRole("button");
    const file = makeFile("huge.png", "image/png", 9 * 1024 * 1024);
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/over the .* limit/i);
  });

  it(`caps attachments at ${MAX_IMAGES_PER_LABEL} images per label`, () => {
    const onChange = vi.fn();
    const existing = Array.from({ length: MAX_IMAGES_PER_LABEL }, (_, i) => makeFile(`img${i}.png`));
    render(
      <UploadZone
        files={existing}
        previewUrls={existing.map((_, i) => `blob:${i}`)}
        onChange={onChange}
      />,
    );
    const zone = screen.getByRole("button", { name: /add another label image/i });
    expect(zone).toBeDisabled();
    fireEvent.drop(zone, { dataTransfer: { files: [makeFile("one-too-many.png")] } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("lists each attached file with its own Remove control, and removing one keeps the others", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const files = [makeFile("front.png"), makeFile("back.png")];
    render(
      <UploadZone files={files} previewUrls={["blob:1", "blob:2"]} onChange={onChange} />,
    );
    expect(screen.getByText(/front\.png/)).toBeInTheDocument();
    expect(screen.getByText(/back\.png/)).toBeInTheDocument();

    const removeButtons = screen.getAllByRole("button", { name: /remove/i });
    expect(removeButtons).toHaveLength(2);
    await user.click(removeButtons[0]);
    expect(onChange).toHaveBeenCalledWith([files[1]]);
  });
});
