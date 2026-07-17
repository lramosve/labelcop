"use client";

import { useEffect, useMemo, useState } from "react";
import type { LabelClaim } from "@/lib/verifier";
import type { VerificationResult } from "@/lib/verifier/types";
import { BEVERAGE_TYPE_LABELS, EXAMPLE_CLAIM } from "@/lib/verifier/ttb";
import type { BeverageType } from "@/lib/verifier/ttb";
import { verifyLabel } from "@/lib/verifier/client";
import { UploadZone } from "./UploadZone";
import { ResultPanel } from "./ResultPanel";

const EMPTY_CLAIM: LabelClaim = {
  brandName: "",
  classType: "",
  alcoholContent: "",
  netContents: "",
  producer: "",
  countryOfOrigin: "",
  beverageType: "spirits",
};

export function SingleLabelView() {
  const [claim, setClaim] = useState<LabelClaim>(EMPTY_CLAIM);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const canVerify = useMemo(
    () => !!file && !!claim.brandName.trim() && !pending,
    [file, claim.brandName, pending],
  );

  function update<K extends keyof LabelClaim>(key: K, value: LabelClaim[K]) {
    setClaim((c) => ({ ...c, [key]: value }));
  }

  function loadExample() {
    setClaim({ ...EXAMPLE_CLAIM });
  }

  function reset() {
    setClaim(EMPTY_CLAIM);
    setFile(null);
    setResult(null);
    setError(null);
  }

  async function onVerify() {
    if (!file) return;
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const data = await verifyLabel(file, claim);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Application Claim</h2>
          <button
            type="button"
            onClick={loadExample}
            className="text-sm text-brand-700 hover:underline"
          >
            Load example
          </button>
        </div>

        <Field
          label="Brand Name"
          value={claim.brandName}
          onChange={(v) => update("brandName", v)}
          placeholder="e.g., OLD TOM DISTILLERY"
          required
        />
        <Field
          label="Class / Type Designation"
          value={claim.classType}
          onChange={(v) => update("classType", v)}
          placeholder="e.g., Kentucky Straight Bourbon Whiskey"
        />
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 mb-1">Beverage Type</span>
          <select
            value={claim.beverageType ?? "spirits"}
            onChange={(e) => update("beverageType", e.target.value as BeverageType)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            {(Object.keys(BEVERAGE_TYPE_LABELS) as BeverageType[]).map((bt) => (
              <option key={bt} value={bt}>
                {BEVERAGE_TYPE_LABELS[bt]}
              </option>
            ))}
          </select>
          <span className="block text-xs text-slate-500 mt-1">
            Alcohol-content disclosure rules differ by class (e.g. wine and beer are not always
            required to state a numeric ABV) — this affects how the alcohol content field below is
            evaluated.
          </span>
        </label>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Alcohol Content"
            value={claim.alcoholContent}
            onChange={(v) => update("alcoholContent", v)}
            placeholder="45% Alc./Vol. (90 Proof)"
          />
          <Field
            label="Net Contents"
            value={claim.netContents}
            onChange={(v) => update("netContents", v)}
            placeholder="750 mL"
          />
        </div>
        <Field
          label="Name & Address of Producer / Bottler / Importer"
          value={claim.producer}
          onChange={(v) => update("producer", v)}
          placeholder="Old Tom Distillery, Bardstown, KY"
        />
        <Field
          label="Country of Origin (imports only)"
          value={claim.countryOfOrigin ?? ""}
          onChange={(v) => update("countryOfOrigin", v)}
          placeholder="Product of Scotland"
        />

        <UploadZone file={file} previewUrl={previewUrl} onChange={setFile} />

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onVerify}
            disabled={!canVerify}
            className="bg-brand-700 hover:bg-brand-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-5 py-3 rounded-md font-semibold text-base shadow-sm"
          >
            {pending ? "Reviewing label…" : "Verify Label"}
          </button>
          <button
            type="button"
            onClick={reset}
            className="text-slate-600 hover:text-slate-900 px-3 py-3 text-sm"
          >
            Reset
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-6">
        <div aria-live="polite" className="sr-only">
          {statusAnnouncement(pending, error, result)}
        </div>
        {error && (
          <div role="alert" className="rounded border border-red-200 bg-red-50 text-red-800 p-4 text-sm">
            {error}
          </div>
        )}
        {pending && <PendingState />}
        {!pending && !error && !result && <EmptyState />}
        {result && <ResultPanel result={result} />}
      </section>
    </div>
  );
}

function statusAnnouncement(
  pending: boolean,
  error: string | null,
  result: VerificationResult | null,
): string {
  if (pending) return "Reviewing the label…";
  if (error) return `Error: ${error}`;
  if (result) {
    const label = { approve: "Approve", needs_review: "Needs Review", reject: "Reject" }[
      result.overall
    ];
    return `Review complete: ${label}.`;
  }
  return "";
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
      />
    </label>
  );
}

function EmptyState() {
  return (
    <div className="h-full grid place-items-center text-center text-slate-500 py-16">
      <div>
        <div className="text-4xl mb-2">🔍</div>
        <div className="font-medium text-slate-700">Ready to verify</div>
        <div className="text-sm mt-1 max-w-xs mx-auto">
          Enter the claim from the COLA application, drop in the label image, and click{" "}
          <span className="font-medium text-slate-700">Verify Label</span>.
        </div>
      </div>
    </div>
  );
}

function PendingState() {
  return (
    <div className="h-full grid place-items-center text-center text-slate-500 py-16">
      <div className="space-y-3">
        <div className="mx-auto h-10 w-10 rounded-full border-4 border-slate-200 border-t-brand-600 animate-spin" />
        <div className="font-medium text-slate-700">Reviewing the label…</div>
        <div className="text-sm">Usually under five seconds.</div>
      </div>
    </div>
  );
}
