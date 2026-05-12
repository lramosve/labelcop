"use client";

import { useRef, useState } from "react";

interface Props {
  file: File | null;
  previewUrl: string | null;
  onChange: (file: File | null) => void;
}

export function UploadZone({ file, previewUrl, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const accept = (f: File | null) => {
    if (!f) {
      onChange(null);
      return;
    }
    if (!f.type.startsWith("image/")) return;
    onChange(f);
  };

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    accept(e.dataTransfer.files?.[0] ?? null);
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">Label Image</label>
      <div
        role="button"
        tabIndex={0}
        aria-label={file ? `Replace label image (current: ${file.name})` : "Upload a label image"}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={
          "rounded-lg border-2 border-dashed transition-colors cursor-pointer p-4 grid place-items-center text-center focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 " +
          (dragging
            ? "border-brand-500 bg-brand-50"
            : "border-slate-300 bg-slate-50 hover:bg-slate-100")
        }
        style={{ minHeight: 200 }}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={file?.name ?? "Label preview"}
            className="max-h-72 w-auto rounded-md shadow-sm"
          />
        ) : (
          <div className="text-slate-500">
            <div className="text-3xl mb-2">📤</div>
            <div className="font-medium text-slate-700">Drop a label image here</div>
            <div className="text-sm">or click to browse — PNG, JPEG, WEBP, or GIF</div>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => accept(e.target.files?.[0] ?? null)}
        />
      </div>
      {file && (
        <div className="mt-2 flex items-center justify-between text-sm text-slate-600">
          <span className="truncate">{file.name}</span>
          <button
            type="button"
            className="text-brand-700 hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              if (inputRef.current) inputRef.current.value = "";
              accept(null);
            }}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
