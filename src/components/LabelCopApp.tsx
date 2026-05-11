"use client";

import { useEffect, useState } from "react";
import { SingleLabelView } from "./SingleLabelView";
import { BatchLabelView } from "./BatchLabelView";

type Config = { provider: string; model: string; configured: boolean };
type Tab = "single" | "batch";

export function LabelCopApp() {
  const [tab, setTab] = useState<Tab>("single");
  const [config, setConfig] = useState<Config | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((c: Config) => setConfig(c))
      .catch(() => setConfig(null));
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-brand-700 text-white grid place-items-center font-bold text-lg shadow-sm">
              LC
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900 leading-tight">LabelCop</h1>
              <p className="text-sm text-slate-500 leading-tight">
                TTB Label Compliance Verification — Prototype
              </p>
            </div>
          </div>
          {config && (
            <div
              className="text-xs text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-3 py-1"
              title="Configured LLM backend"
            >
              <span className="font-medium text-slate-700">{config.provider}</span>
              <span className="mx-1 text-slate-400">·</span>
              <span>{config.model}</span>
              {!config.configured && (
                <span className="ml-2 text-red-600 font-medium">API key missing</span>
              )}
            </div>
          )}
        </div>
        <nav className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            <TabButton active={tab === "single"} onClick={() => setTab("single")}>
              Verify a Label
            </TabButton>
            <TabButton active={tab === "batch"} onClick={() => setTab("batch")}>
              Batch Verify
            </TabButton>
          </div>
        </nav>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        {tab === "single" ? <SingleLabelView /> : <BatchLabelView />}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4 text-xs text-slate-500 flex justify-between">
          <span>
            Prototype only. Not for use in production COLA workflows. Source:{" "}
            <a
              href="https://github.com/"
              className="text-brand-700 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            .
          </span>
          <span>27 CFR Part 16 (warning) · 27 CFR Parts 4 / 5 / 7 (labeling)</span>
        </div>
      </footer>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors " +
        (active
          ? "border-brand-600 text-brand-700"
          : "border-transparent text-slate-500 hover:text-slate-800")
      }
    >
      {children}
    </button>
  );
}
