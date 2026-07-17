/**
 * Generates the three label PNGs used in the demo walkthrough. No API calls.
 *
 *   npm run demo:fixtures   →  writes demo/*.png
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderLabel, type LabelContent } from "./eval/labels";
import { glareAndLowLight } from "./eval/degrade";
import { GOVERNMENT_WARNING_EXACT_TEXT } from "../src/lib/verifier/ttb";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Demo fixtures live in /public so they're statically served by Next.js
// at /demo/<file>.png — that lets the "Try sample batch" button fetch them
// in-app, while the user can also drag them from disk during the recording.
const OUT = join(__dirname, "..", "public", "demo");

const CANONICAL_HEADER = "GOVERNMENT WARNING:";
const CANONICAL_BODY = GOVERNMENT_WARNING_EXACT_TEXT.replace(CANONICAL_HEADER, "").trim();

const PERFECT: LabelContent = {
  brandName: "OLD TOM DISTILLERY",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
  producer: "Old Tom Distillery, Bardstown, KY",
  warningHeader: CANONICAL_HEADER,
  warningBody: CANONICAL_BODY,
};

const FIXTURES: { name: string; label: LabelContent; note: string }[] = [
  {
    name: "01-perfect-label.png",
    label: PERFECT,
    note: "Perfect, fully-compliant label. Use this for the approve demo and the case-difference demo.",
  },
  {
    name: "02-lowercase-warning-header.png",
    label: { ...PERFECT, warningHeader: "Government Warning:" },
    note: "Warning text is correct, but the header is title-case (Jenny's exact case). Use for the needs-review demo.",
  },
  {
    name: "03-missing-warning.png",
    label: { ...PERFECT, warningHeader: null, warningBody: null },
    note: "No federal health warning anywhere on the label. Use for the reject demo.",
  },
  {
    name: "04-wine-table-wine.png",
    label: {
      ...PERFECT,
      brandName: "SONOMA RIDGE CELLARS",
      classType: "Cabernet Sauvignon",
      alcoholContent: "Table Wine",
      netContents: "750 mL",
      producer: "Sonoma Ridge Cellars, Sonoma, CA",
    },
    note: 'Wine label stating "Table Wine" instead of a numeric ABV — pair with Beverage Type = Wine and Alcohol Content claim = "Table Wine" to demo the beverage-type-aware rule (approve, not reject-on-missing-ABV).',
  },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  for (const f of FIXTURES) {
    const png = await renderLabel(f.label);
    const path = join(OUT, f.name);
    await writeFile(path, png);
    console.log(`✓ ${f.name}  (${(png.length / 1024).toFixed(1)} KB) — ${f.note}`);
  }

  // Imperfect-image demo fixture: same compliant label, degraded to simulate
  // a real phone photo (glare + low light) via scripts/eval/degrade.ts.
  const perfectPng = await renderLabel(PERFECT);
  const degraded = await glareAndLowLight(perfectPng);
  const degradedName = "05-glare-and-low-light.jpg";
  await writeFile(join(OUT, degradedName), degraded);
  console.log(
    `✓ ${degradedName}  (${(degraded.length / 1024).toFixed(1)} KB) — Same compliant label, with simulated glare/low-light. Use to demo the imageQuality banner — the model still reads it correctly but flags the capture quality.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
