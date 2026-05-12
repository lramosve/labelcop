/**
 * Tier 2 end-to-end eval. Generates synthetic label PNGs deterministically,
 * runs each through the configured LLM verifier, and asserts the expected
 * overall verdict.
 *
 * Run with:
 *   npm run eval               # uses .env.local
 *   npm run eval -- --save     # also writes generated PNGs to scripts/eval/out/
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderLabel, type LabelContent } from "./labels";
import { getVerifier } from "../../src/lib/verifier";
import type { LabelClaim } from "../../src/lib/verifier";
import type { OverallVerdict } from "../../src/lib/verifier/types";
import { GOVERNMENT_WARNING_EXACT_TEXT } from "../../src/lib/verifier/ttb";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 27 CFR 16.21 wording, split out so the test cases can reuse it.
const CANONICAL_WARNING_HEADER = "GOVERNMENT WARNING:";
const CANONICAL_WARNING_BODY = GOVERNMENT_WARNING_EXACT_TEXT.replace(
  CANONICAL_WARNING_HEADER,
  "",
).trim();

const PERFECT_LABEL: LabelContent = {
  brandName: "OLD TOM DISTILLERY",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
  producer: "Old Tom Distillery, Bardstown, KY",
  warningHeader: CANONICAL_WARNING_HEADER,
  warningBody: CANONICAL_WARNING_BODY,
};

const PERFECT_CLAIM: LabelClaim = {
  brandName: PERFECT_LABEL.brandName,
  classType: PERFECT_LABEL.classType,
  alcoholContent: PERFECT_LABEL.alcoholContent,
  netContents: PERFECT_LABEL.netContents,
  producer: PERFECT_LABEL.producer,
  countryOfOrigin: "",
  beverageType: "spirits",
};

interface EvalCase {
  name: string;
  description: string;
  label: LabelContent;
  claim: LabelClaim;
  expected: OverallVerdict;
  /** Accept a softer verdict as also passing. Used where reasonable agents could disagree. */
  also?: OverallVerdict[];
}

const CASES: EvalCase[] = [
  {
    name: "happy_path",
    description: "Label matches claim exactly; warning fully compliant.",
    label: PERFECT_LABEL,
    claim: PERFECT_CLAIM,
    expected: "approve",
  },
  {
    name: "brand_case_diff",
    description: "Brand differs only in case (Dave's STONE'S THROW judgment call).",
    label: PERFECT_LABEL,
    claim: { ...PERFECT_CLAIM, brandName: "Old Tom Distillery" },
    expected: "needs_review",
  },
  {
    name: "abv_mismatch",
    description: "Claim ABV materially differs from the label.",
    label: PERFECT_LABEL,
    claim: { ...PERFECT_CLAIM, alcoholContent: "50% Alc./Vol. (100 Proof)" },
    expected: "reject",
  },
  {
    name: "net_contents_format",
    description: 'Spacing/case-only difference: claim "750 mL" vs label "750ML".',
    label: { ...PERFECT_LABEL, netContents: "750ML" },
    claim: { ...PERFECT_CLAIM, netContents: "750 mL" },
    expected: "approve",
    also: ["needs_review"],
  },
  {
    name: "warning_paraphrased",
    description: "Warning text is paraphrased — fails the exact-wording rule.",
    label: {
      ...PERFECT_LABEL,
      warningBody:
        "(1) Pregnant women shouldn't drink alcohol due to birth defect risk. " +
        "(2) Alcohol impairs your ability to drive and may cause health issues.",
    },
    claim: PERFECT_CLAIM,
    expected: "reject",
  },
  {
    name: "warning_header_lowercase",
    description: "Warning text is correct but header is not all caps (Jenny's case).",
    label: { ...PERFECT_LABEL, warningHeader: "Government Warning:" },
    claim: PERFECT_CLAIM,
    expected: "needs_review",
  },
  {
    name: "warning_missing",
    description: "Label has no government warning at all.",
    label: { ...PERFECT_LABEL, warningHeader: null, warningBody: null },
    claim: PERFECT_CLAIM,
    expected: "reject",
  },
];

const CONCURRENCY = 3;
const saveImages = process.argv.includes("--save");

interface Outcome {
  name: string;
  expected: OverallVerdict;
  actual: OverallVerdict;
  passed: boolean;
  ms: number;
  fieldsObserved: string;
  notes: string;
  warning: {
    present: boolean;
    exactTextMatch: boolean;
    headerAllCaps: boolean;
    observedHeader: string | null;
    observedText: string | null;
  };
}

async function runCase(c: EvalCase): Promise<Outcome> {
  const png = await renderLabel(c.label);
  if (saveImages) {
    const outDir = join(__dirname, "out");
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, `${c.name}.png`), png);
  }
  const verifier = getVerifier();
  const t0 = Date.now();
  const result = await verifier.verify({
    imageBase64: png.toString("base64"),
    mimeType: "image/png",
    claim: c.claim,
  });
  const ms = Date.now() - t0;
  const acceptable = new Set<OverallVerdict>([c.expected, ...(c.also ?? [])]);
  const passed = acceptable.has(result.overall);
  return {
    name: c.name,
    expected: c.expected,
    actual: result.overall,
    passed,
    ms,
    fieldsObserved: result.fields.map((f) => `${f.field}=${f.verdict}`).join(" "),
    notes: result.notes.join("; "),
    warning: {
      present: result.governmentWarning.present,
      exactTextMatch: result.governmentWarning.exactTextMatch,
      headerAllCaps: result.governmentWarning.headerAllCaps,
      observedHeader: result.governmentWarning.observedHeader,
      observedText: result.governmentWarning.observedText,
    },
  };
}

async function main() {
  const v = getVerifier();
  console.log(`LabelCop end-to-end eval — ${v.provider}/${v.model}`);
  console.log("─".repeat(72));

  const queue = [...CASES];
  const results: Outcome[] = [];
  const start = Date.now();

  async function worker() {
    while (queue.length) {
      const c = queue.shift();
      if (!c) return;
      try {
        results.push(await runCase(c));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push({
          name: c.name,
          expected: c.expected,
          actual: "reject", // placeholder; the row will be marked failed
          passed: false,
          ms: 0,
          fieldsObserved: "",
          notes: `ERROR: ${msg}`,
        });
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  // Print in the original case order so output is deterministic.
  const byName = new Map(results.map((r) => [r.name, r]));
  let passed = 0;
  for (const c of CASES) {
    const r = byName.get(c.name)!;
    const mark = r.passed ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
    if (r.passed) passed++;
    const exp = c.also?.length
      ? `${c.expected} (or ${c.also.join("/")})`
      : c.expected;
    console.log(
      `${mark} ${c.name.padEnd(28)} expected ${exp.padEnd(28)} got ${r.actual.padEnd(13)} ${(r.ms / 1000).toFixed(1)}s`,
    );
    if (!r.passed) {
      console.log(`    ${c.description}`);
      console.log(`    observed fields: ${r.fieldsObserved}`);
      console.log(
        `    warning: present=${r.warning.present} exactText=${r.warning.exactTextMatch} headerCaps=${r.warning.headerAllCaps}`,
      );
      console.log(`    observed header: ${JSON.stringify(r.warning.observedHeader)}`);
      console.log(
        `    observed text:   ${JSON.stringify(r.warning.observedText?.slice(0, 240) ?? null)}`,
      );
      if (r.notes) console.log(`    notes: ${r.notes}`);
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log("─".repeat(72));
  const pct = ((passed / CASES.length) * 100).toFixed(1);
  console.log(`Total: ${passed}/${CASES.length} passed (${pct}%), wall clock ${elapsed}s`);

  process.exit(passed === CASES.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
