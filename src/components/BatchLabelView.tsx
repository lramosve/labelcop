"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import type { OverallVerdict } from "@/lib/verifier/types";
import { verifyLabel } from "@/lib/verifier/client";
import { ResultPanel } from "./ResultPanel";
import {
  SAMPLE_BATCH_BASE_CLAIM,
  SAMPLE_BATCH_IMAGES,
  TEMPLATE_HEADERS,
  TEMPLATE_ROWS,
  buildResultsCsvRecords,
  csvRecordToBatchRow,
  imageKey,
  markMissingImages,
  rowsWithoutImage,
  type BatchRow,
} from "./batch";

export function BatchLabelView() {
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [imageFiles, setImageFiles] = useState<Record<string, File>>({});
  const [csvName, setCsvName] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const csvInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const rowsRef = useRef<BatchRow[]>([]);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const summary = useMemo(() => {
    const counts = { approve: 0, needs_review: 0, reject: 0 };
    for (const r of rows) {
      if (r.result) counts[r.result.overall as OverallVerdict]++;
    }
    return counts;
  }, [rows]);

  const matchedCount = rows.filter((r) => imageFiles[imageKey(r.imageFilename)]).length;
  const canRun = rows.length > 0 && matchedCount === rows.length && !running;

  function onCsvSelected(file: File) {
    setCsvName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (parsed) => {
        setRows(parsed.data.map((r, i) => csvRecordToBatchRow(r, i)));
      },
    });
  }

  function onImagesSelected(files: FileList | null) {
    if (!files) return;
    setImageFiles((prev) => {
      const next = { ...prev };
      for (const f of Array.from(files)) {
        next[f.name.toLowerCase()] = f;
      }
      return next;
    });
  }

  async function loadSampleBatch() {
    // Pulls the three demo PNGs that ship in /public/demo and hand-builds a
    // matching three-row batch so a reviewer can click "Verify 3 labels"
    // immediately, with no need to download the template, find matching
    // images, and upload them separately.
    try {
      const files = await Promise.all(
        SAMPLE_BATCH_IMAGES.map(async (name) => {
          const r = await fetch(`/demo/${name}`);
          if (!r.ok) throw new Error(`Failed to fetch /demo/${name} (HTTP ${r.status})`);
          const blob = await r.blob();
          return new File([blob], name, { type: "image/png" });
        }),
      );
      const nextImages: Record<string, File> = {};
      for (const f of files) nextImages[imageKey(f.name)] = f;
      const nextRows: BatchRow[] = SAMPLE_BATCH_IMAGES.map((name, i) => ({
        rowIndex: i,
        imageFilename: name,
        claim: { ...SAMPLE_BATCH_BASE_CLAIM },
        status: "queued",
      }));
      setImageFiles(nextImages);
      setRows(nextRows);
      setCsvName("Sample batch");
    } catch (e) {
      console.error("Failed to load sample batch:", e);
      alert(
        "Could not load the sample batch images. Check the browser console for details.",
      );
    }
  }

  function downloadTemplate() {
    const csv = Papa.unparse({ fields: [...TEMPLATE_HEADERS], data: TEMPLATE_ROWS });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "labelcop-batch-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function runBatch() {
    setRunning(true);
    setAnnouncement(`Reviewing ${rows.length} labels…`);
    const concurrency = 4;

    // Mark image-less rows up front.
    setRows((prev) => markMissingImages(prev, Object.keys(imageFiles)));

    const workQueue = rows
      .filter((r) => imageFiles[imageKey(r.imageFilename)])
      .map((r) => r.rowIndex);

    let cursor = 0;
    async function worker() {
      while (cursor < workQueue.length) {
        const idx = workQueue[cursor++];
        await processOne(idx);
      }
    }

    async function processOne(idx: number) {
      const row = rowsRef.current[idx];
      if (!row) return;
      const image = imageFiles[imageKey(row.imageFilename)];
      if (!image) return;
      updateRow(idx, { status: "running" });
      try {
        const data = await verifyLabel(image, row.claim);
        updateRow(idx, { status: "done", result: data });
      } catch (e) {
        updateRow(idx, {
          status: "error",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    setRunning(false);
    const counts = { approve: 0, needs_review: 0, reject: 0, other: 0 };
    for (const r of rowsRef.current) {
      if (r.result) counts[r.result.overall as OverallVerdict]++;
      else counts.other++;
    }
    setAnnouncement(
      `Batch complete: ${counts.approve} approved, ${counts.needs_review} need review, ` +
        `${counts.reject} rejected${counts.other ? `, ${counts.other} could not be processed` : ""}.`,
    );
  }

  function updateRow(idx: number, patch: Partial<BatchRow>) {
    setRows((prev) => prev.map((r) => (r.rowIndex === idx ? { ...r, ...patch } : r)));
  }

  function exportResults() {
    const csv = Papa.unparse(buildResultsCsvRecords(rows));
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "labelcop-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    setRows([]);
    setImageFiles({});
    setCsvName(null);
    setExpandedRow(null);
    if (csvInputRef.current) csvInputRef.current.value = "";
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  const progressDone = rows.filter((r) => r.status === "done" || r.status === "error").length;

  return (
    <div className="space-y-6">
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Batch Verification</h2>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={loadSampleBatch}
              disabled={running || rows.length > 0}
              className="text-sm text-brand-700 hover:underline disabled:text-slate-400 disabled:no-underline"
            >
              Try sample batch
            </button>
            <button
              type="button"
              onClick={downloadTemplate}
              className="text-sm text-brand-700 hover:underline"
            >
              Download CSV template
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <UploadBox
            title="1. Application CSV"
            description="One row per label. Headers: imageFilename, brandName, classType, alcoholContent, netContents, producer, countryOfOrigin, beverageType."
            value={csvName ? `${csvName} — ${rows.length} rows` : null}
            accept=".csv,text/csv"
            inputRef={csvInputRef}
            onSelect={(files) => files?.[0] && onCsvSelected(files[0])}
          />
          <UploadBox
            title="2. Label Images"
            description="Select all images at once. Filenames must match the imageFilename column in the CSV."
            value={
              Object.keys(imageFiles).length
                ? `${Object.keys(imageFiles).length} images loaded`
                : null
            }
            accept="image/*"
            multiple
            inputRef={imageInputRef}
            onSelect={onImagesSelected}
          />
        </div>

        {rows.length > 0 && (
          <div className="mt-4 flex items-center gap-3 text-sm text-slate-600">
            <span>
              {matchedCount} of {rows.length} rows matched to an image
            </span>
            {matchedCount < rows.length && (
              <span className="text-amber-700">
                — missing: {rowsWithoutImage(rows, Object.keys(imageFiles))
                  .map((r) => r.imageFilename)
                  .slice(0, 3)
                  .join(", ")}
                {rowsWithoutImage(rows, Object.keys(imageFiles)).length > 3 && "…"}
              </span>
            )}
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={runBatch}
            disabled={!canRun}
            className="bg-brand-700 hover:bg-brand-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-5 py-3 rounded-md font-semibold text-base shadow-sm"
          >
            {running ? `Reviewing… (${progressDone}/${rows.length})` : `Verify ${rows.length || ""} labels`}
          </button>
          <button
            type="button"
            onClick={exportResults}
            disabled={progressDone === 0}
            className="text-brand-700 hover:underline disabled:text-slate-400 disabled:no-underline text-sm"
          >
            Export results CSV
          </button>
          <button
            type="button"
            onClick={reset}
            className="text-slate-600 hover:text-slate-900 text-sm ml-auto"
          >
            Reset
          </button>
        </div>

        {rows.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <Stat label="Approve" value={summary.approve} cls="text-green-700" />
            <Stat label="Needs Review" value={summary.needs_review} cls="text-amber-700" />
            <Stat label="Reject" value={summary.reject} cls="text-red-700" />
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Batch verification results, {rows.length} label{rows.length === 1 ? "" : "s"}
            </caption>
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th scope="col" className="text-left px-4 py-2 font-medium">Image</th>
                <th scope="col" className="text-left px-4 py-2 font-medium">Brand</th>
                <th scope="col" className="text-left px-4 py-2 font-medium">Status</th>
                <th scope="col" className="text-left px-4 py-2 font-medium">Verdict</th>
                <th scope="col" className="px-4 py-2 font-medium">
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <FragmentRow
                  key={r.rowIndex}
                  row={r}
                  expanded={expandedRow === r.rowIndex}
                  onToggle={() => setExpandedRow(expandedRow === r.rowIndex ? null : r.rowIndex)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FragmentRow({
  row,
  expanded,
  onToggle,
}: {
  row: BatchRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr>
        <td className="px-4 py-2 font-mono text-xs text-slate-700">{row.imageFilename}</td>
        <td className="px-4 py-2">{row.claim.brandName}</td>
        <td className="px-4 py-2">
          <StatusBadge status={row.status} />
        </td>
        <td className="px-4 py-2">
          {row.result ? (
            <OverallPill verdict={row.result.overall} />
          ) : row.error ? (
            <span className="text-red-700 text-xs">{row.error}</span>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </td>
        <td className="px-4 py-2 text-right">
          {row.result && (
            <button
              type="button"
              onClick={onToggle}
              className="text-brand-700 hover:underline text-xs"
            >
              {expanded ? "Hide" : "Details"}
            </button>
          )}
        </td>
      </tr>
      {expanded && row.result && (
        <tr>
          <td colSpan={5} className="bg-slate-50 px-6 py-4">
            <ResultPanel result={row.result} />
          </td>
        </tr>
      )}
    </>
  );
}

function StatusBadge({ status }: { status: BatchRow["status"] }) {
  const map: Record<BatchRow["status"], { label: string; cls: string }> = {
    queued: { label: "Queued", cls: "bg-slate-100 text-slate-700" },
    running: { label: "Running", cls: "bg-blue-100 text-blue-700" },
    done: { label: "Done", cls: "bg-green-100 text-green-700" },
    error: { label: "Error", cls: "bg-red-100 text-red-700" },
    missing_image: { label: "No image", cls: "bg-amber-100 text-amber-800" },
  };
  const v = map[status];
  return <span className={"inline-flex rounded-full px-2 py-0.5 text-xs " + v.cls}>{v.label}</span>;
}

function OverallPill({ verdict }: { verdict: OverallVerdict }) {
  const map: Record<OverallVerdict, { label: string; cls: string }> = {
    approve: { label: "Approve", cls: "bg-green-600 text-white" },
    needs_review: { label: "Needs Review", cls: "bg-amber-500 text-white" },
    reject: { label: "Reject", cls: "bg-red-600 text-white" },
  };
  const v = map[verdict];
  return <span className={"inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium " + v.cls}>{v.label}</span>;
}

function Stat({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={"text-xl font-semibold " + cls}>{value}</div>
    </div>
  );
}

function UploadBox({
  title,
  description,
  value,
  accept,
  multiple,
  inputRef,
  onSelect,
}: {
  title: string;
  description: string;
  value: string | null;
  accept: string;
  multiple?: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSelect: (files: FileList | null) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="font-medium text-slate-800">{title}</div>
      <p className="text-sm text-slate-600 mt-1">{description}</p>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-sm px-3 py-2 rounded"
        >
          Choose file{multiple ? "s" : ""}
        </button>
        <span className="text-sm text-slate-600 truncate">{value ?? "Nothing selected"}</span>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => onSelect(e.target.files)}
        />
      </div>
    </div>
  );
}
