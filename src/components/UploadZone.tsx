"use client";

import { useRef, useState } from "react";
import { validateImageFile } from "@/lib/verifier/client";
import { MAX_IMAGES_PER_LABEL } from "@/lib/verifier/limits";

interface Props {
  files: File[];
  previewUrls: string[];
  onChange: (files: File[]) => void;
}

export function UploadZone({ files, previewUrls, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rejection, setRejection] = useState<string | null>(null);

  const acceptFiles = (incoming: File[]) => {
    if (incoming.length === 0) return;

    const nonImages = incoming.filter((f) => !f.type.startsWith("image/"));
    const images = incoming.filter((f) => f.type.startsWith("image/"));

    const room = MAX_IMAGES_PER_LABEL - files.length;
    if (room <= 0) {
      setRejection(
        `You've already attached ${MAX_IMAGES_PER_LABEL} images (the max per label). Remove one before adding another.`,
      );
      return;
    }

    for (const image of images.slice(0, room)) {
      const sizeError = validateImageFile(image);
      if (sizeError) {
        setRejection(sizeError);
        return;
      }
    }

    const toAdd = images.slice(0, room);
    if (nonImages.length > 0) {
      setRejection("Some files weren't images and were skipped. Please choose PNG, JPEG, WEBP, or GIF.");
    } else if (images.length > toAdd.length) {
      setRejection(`Only added ${toAdd.length} — up to ${MAX_IMAGES_PER_LABEL} images per label.`);
    } else {
      setRejection(null);
    }
    if (toAdd.length > 0) onChange([...files, ...toAdd]);
  };

  function removeAt(idx: number) {
    setRejection(null);
    onChange(files.filter((_, i) => i !== idx));
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    acceptFiles(Array.from(e.dataTransfer.files ?? []));
  }

  const atCapacity = files.length >= MAX_IMAGES_PER_LABEL;

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">Label Image(s)</label>
      <p className="text-xs text-slate-500 mb-2">
        Attach every image needed to see all required disclosures — a product's front (brand)
        label and back (strip) label often split the information, and the government warning is
        frequently on the back. Up to {MAX_IMAGES_PER_LABEL} images.
      </p>
      {/* A real <button>, not a div dressed up with role="button" — native
          Enter/Space activation for free, and it can't create a
          nested-interactive violation the way a div-wrapping-an-input can. */}
      <button
        type="button"
        disabled={atCapacity}
        aria-label={
          files.length
            ? `Add another label image (${files.length} of ${MAX_IMAGES_PER_LABEL} attached)`
            : "Upload label images"
        }
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!atCapacity) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={
          "w-full text-left rounded-lg border-2 border-dashed transition-colors p-4 grid place-items-center text-center focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 " +
          (atCapacity
            ? "border-slate-200 bg-slate-100 cursor-not-allowed"
            : "cursor-pointer " +
              (dragging
                ? "border-brand-500 bg-brand-50"
                : "border-slate-300 bg-slate-50 hover:bg-slate-100"))
        }
        style={{ minHeight: 200 }}
      >
        {files.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full">
            {previewUrls.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={url}
                alt={`Label image ${i + 1}${files[i] ? `: ${files[i].name}` : ""}`}
                className="h-28 w-full object-contain rounded-md shadow-sm bg-white"
              />
            ))}
            {!atCapacity && (
              <div className="h-28 grid place-items-center text-slate-500 text-sm border border-dashed border-slate-300 rounded-md">
                + Add another
              </div>
            )}
          </div>
        ) : (
          <div className="text-slate-500">
            <div className="text-3xl mb-2">📤</div>
            <div className="font-medium text-slate-700">Drop label image(s) here</div>
            <div className="text-sm">or click to browse — PNG, JPEG, WEBP, or GIF</div>
          </div>
        )}
      </button>
      {/* Kept as a sibling, not a child, of the button above — nesting a real
          <input> inside another interactive control is an accessibility
          violation (axe: nested-interactive) regardless of aria-hidden/tabIndex. */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          acceptFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      {rejection && (
        <div role="alert" className="mt-2 text-sm text-red-700">
          {rejection}
        </div>
      )}
      {files.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between gap-2">
              <span className="truncate">
                {i === 0 ? "Image 1 (e.g. front): " : `Image ${i + 1}: `}
                {f.name}
              </span>
              <button
                type="button"
                className="text-brand-700 hover:underline shrink-0"
                onClick={() => removeAt(i)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
