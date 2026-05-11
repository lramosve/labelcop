"use client";

import type { VerificationResult, FieldResult, MatchVerdict } from "@/lib/verifier/types";
import { GOVERNMENT_WARNING_EXACT_TEXT } from "@/lib/verifier/ttb";

const VERDICT_STYLES: Record<MatchVerdict, string> = {
  exact_match: "bg-green-100 text-green-800 border-green-200",
  semantic_match: "bg-amber-100 text-amber-800 border-amber-200",
  mismatch: "bg-red-100 text-red-800 border-red-200",
  missing: "bg-slate-200 text-slate-700 border-slate-300",
};

const VERDICT_LABELS: Record<MatchVerdict, string> = {
  exact_match: "Exact match",
  semantic_match: "Semantic match",
  mismatch: "Mismatch",
  missing: "Missing",
};

export function ResultPanel({ result }: { result: VerificationResult }) {
  return (
    <div className="space-y-5">
      <OverallBadge result={result} />
      <WarningPanel result={result} />
      <FieldsTable fields={result.fields} />
      {result.notes.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="font-medium text-slate-800 mb-1">Reviewer notes</div>
          <ul className="text-sm text-slate-700 list-disc pl-5 space-y-1">
            {result.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function OverallBadge({ result }: { result: VerificationResult }) {
  const cfg = {
    approve: {
      label: "Approve",
      sub: "All fields match and warning is compliant.",
      cls: "bg-green-600",
    },
    needs_review: {
      label: "Needs Review",
      sub: "Worth a human glance before approving.",
      cls: "bg-amber-500",
    },
    reject: {
      label: "Reject",
      sub: "One or more compliance issues found.",
      cls: "bg-red-600",
    },
  }[result.overall];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div
          className={
            "h-12 w-12 rounded-full grid place-items-center text-white text-lg font-bold " + cfg.cls
          }
        >
          {result.overall === "approve" ? "✓" : result.overall === "reject" ? "✕" : "!"}
        </div>
        <div>
          <div className="text-xl font-semibold text-slate-900">{cfg.label}</div>
          <div className="text-sm text-slate-600">{cfg.sub}</div>
        </div>
      </div>
      <div className="text-right text-xs text-slate-500">
        <div>
          Reviewed in <span className="font-medium text-slate-700">{(result.latencyMs / 1000).toFixed(1)}s</span>
        </div>
        <div>
          {result.provider} · {result.model}
        </div>
      </div>
    </div>
  );
}

function WarningPanel({ result }: { result: VerificationResult }) {
  const w = result.governmentWarning;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="font-semibold text-slate-900 mb-3">Government Health Warning</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
        <Check label="Present" ok={w.present} />
        <Check label="Exact text" ok={w.exactTextMatch} />
        <Check label="Header all caps" ok={w.headerAllCaps} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Required text</div>
          <div className="text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded p-3 leading-relaxed">
            {GOVERNMENT_WARNING_EXACT_TEXT}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Observed on label</div>
          <div
            className={
              "text-sm rounded p-3 leading-relaxed border " +
              (w.exactTextMatch
                ? "bg-green-50 border-green-200 text-green-900"
                : "bg-amber-50 border-amber-200 text-amber-900")
            }
          >
            {w.observedText ? w.observedText : <em className="text-slate-500">Not detected</em>}
          </div>
        </div>
      </div>
      {w.issues.length > 0 && (
        <ul className="mt-3 text-sm text-red-700 list-disc pl-5 space-y-1">
          {w.issues.map((i, k) => (
            <li key={k}>{i}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Check({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div
      className={
        "rounded border px-3 py-2 flex items-center gap-2 text-sm font-medium " +
        (ok
          ? "bg-green-50 border-green-200 text-green-800"
          : "bg-red-50 border-red-200 text-red-800")
      }
    >
      <span className="font-bold">{ok ? "✓" : "✕"}</span>
      <span>{label}</span>
    </div>
  );
}

function FieldsTable({ fields }: { fields: FieldResult[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">
        Fields
      </div>
      <div className="divide-y divide-slate-100">
        {fields.map((f, i) => (
          <div key={i} className="px-4 py-3 grid grid-cols-12 gap-3 items-start">
            <div className="col-span-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">{f.field}</div>
              <div className="mt-1 text-sm text-slate-800">{f.expected || <em>(empty)</em>}</div>
            </div>
            <div className="col-span-6">
              <div className="text-xs uppercase tracking-wide text-slate-500">Observed</div>
              <div className="mt-1 text-sm text-slate-800 break-words">
                {f.observed ? f.observed : <em className="text-slate-500">Not detected</em>}
              </div>
              {f.note && <div className="mt-1 text-xs text-slate-500">{f.note}</div>}
            </div>
            <div className="col-span-3 flex md:justify-end">
              <span
                className={
                  "inline-flex items-center text-xs font-medium border rounded-full px-2.5 py-1 " +
                  VERDICT_STYLES[f.verdict]
                }
              >
                {VERDICT_LABELS[f.verdict]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
