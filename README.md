# LabelCop

> AI-powered prototype for the **U.S. Alcohol and Tobacco Tax and Trade Bureau (TTB)** label-compliance review workflow.

**Live app:** **https://labelcop.vercel.app**
**Demo video:** https://www.loom.com/share/335208ebbd804a6c8fab113e449521f2
**Source:** https://github.com/lramosve/labelcop
[![CI](https://github.com/lramosve/labelcop/actions/workflows/ci.yml/badge.svg)](https://github.com/lramosve/labelcop/actions/workflows/ci.yml)

LabelCop takes (a) the values an applicant entered on their COLA application and (b) the actual label artwork, and tells a compliance agent in a few seconds whether the label matches the application and whether the mandatory federal health warning is correctly worded and formatted.

It is a take-home / proof-of-concept implementation. It does **not** integrate with the production COLA system.

---

## Features

- **Single-label verify** — drop in an image, fill the claimed values, get a per-field verdict (`exact_match` / `semantic_match` / `mismatch` / `missing`) plus a dedicated government warning panel that independently checks (1) the warning is present, (2) the text is word-for-word the regulatory text from 27 CFR Part 16, and (3) the `GOVERNMENT WARNING:` header is in all caps.
- **Batch verify** — drop a CSV (one row per label) plus the set of label images. LabelCop runs the verifier in parallel (configurable concurrency), shows a live progress table, and lets you export results as CSV.
- **Provider-agnostic** — the LLM backend lives behind a `LabelVerifier` interface. OpenAI (GPT-5.4 / GPT-5.4-mini / GPT-5.5) and Anthropic Claude implementations are both included. Switch with one env var.
- **Deterministic warning check** — the warning text and header-case verdicts are re-derived on the server against the regulatory text rather than trusting the model's self-report, so the most regulatorily-load-bearing check doesn't drift.
- **Designed for non-technical agents** — large click targets, plain language, three-state badge (Approve / Needs Review / Reject) that mirrors how an agent actually triages.

## Tech stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| LLM (default) | **OpenAI GPT-5.4-mini** (`gpt-5.4-mini`) — chosen for speed and cost on a task that's mostly OCR + structured comparison rather than deep reasoning |
| LLM (alternate) | Anthropic Claude Sonnet 4.6 (`claude-sonnet-4-6`) |
| Tests & evals | Vitest unit tests (21 tests over the post-processor and the batch logic) + a live-LLM end-to-end eval (`npm run eval`, 7 cases) |
| CSV | Papa Parse |
| Deployment | Vercel |

The single vision request does OCR + field extraction + comparison in one structured-output call. There is no separate OCR step. This is the simplest way to hit the 5-second latency budget the stakeholder cited. (First measured end-to-end: ~3.3 s with `gpt-5.4-mini`.)

## Approach

- **Single-call vision.** OCR + field extraction + claim comparison happen in one structured-output call to the LLM. The prompt (`src/lib/verifier/prompt.ts`) carries the canonical regulatory text, defines the verdict vocabulary (`exact_match` / `semantic_match` / `mismatch` / `missing`), and pins the response to a JSON Schema enforced via OpenAI strict mode or Anthropic tool-use. Minimising round trips is what makes the 5-second budget reachable.
- **Provider abstraction.** A `LabelVerifier` interface (`src/lib/verifier/types.ts`) backs the route handler; the OpenAI and Anthropic implementations only differ in how they invoke the SDK. Adding a third backend (Azure OpenAI, AWS Bedrock, etc.) is one file plus a `case` in the factory.
- **Server-side authority on the warning.** The federal health warning is the most regulatorily load-bearing field. `postprocess.ts` re-derives the warning verdict deterministically: it counts canonical key phrases in the model's observed text — five or more accepts (tolerates the truncation the model sometimes does mid-transcription), two or fewer rejects (catches paraphrase), and the ambiguous middle defers to the model. Header-casing is checked separately from body wording, so a "Government Warning:" header is `needs_review` rather than a flat `reject`.
- **Three-state triage verdict.** `approve` / `needs_review` / `reject` mirrors how an agent actually sorts a queue. Semantic-only differences (case, punctuation, spacing) flow to `needs_review` rather than auto-rejecting — directly addresses Dave Morrison's "STONE'S THROW vs Stone's Throw" judgment-call example.
- **Two test tiers.** Unit tests (Tier 1, ~15 ms, no LLM) cover the post-processor and the batch logic so the regulatorily-critical paths are deterministic and free to run. Live-LLM evals (Tier 2) drive seven synthetic-label cases drawn from the stakeholder interviews against the real model so prompt regressions surface end-to-end.

## Running locally

Requires Node.js 20+ and an API key for whichever provider you choose.

```bash
# 1. install dependencies
npm install

# 2. configure your provider
cp .env.example .env.local
# then edit .env.local — at minimum set LLM_PROVIDER and the matching API key

# 3. start the dev server
npm run dev
# open http://localhost:3000
```

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `LLM_PROVIDER` | yes | `openai` (default) or `anthropic` |
| `OPENAI_API_KEY` | when `LLM_PROVIDER=openai` | your OpenAI API key |
| `OPENAI_MODEL` | optional | overrides the default model `gpt-5.4-mini` |
| `ANTHROPIC_API_KEY` | when `LLM_PROVIDER=anthropic` | your Anthropic API key |
| `ANTHROPIC_MODEL` | optional | overrides the default model `claude-sonnet-4-6` |

## Tests and evals

The project has two tiers of automated checks.

### Tier 1 — unit tests (free, fast, deterministic)

```bash
npm test          # one-shot run
npm run test:watch
```

Two suites, both free and deterministic:

- **`src/lib/verifier/postprocess.test.ts`** (12 tests) — the deterministic post-processor: overall verdict aggregation, government warning re-checks (paraphrased text rejection, OCR truncation tolerance via the canonical-key-phrase safety net, header case enforcement), country-of-origin optionality, and metadata pass-through.
- **`src/components/batch.test.ts`** (9 tests) — the pure logic behind the Batch tab: CSV record → `LabelClaim` mapping (whitespace trimming, optional countryOfOrigin, beverage-type normalization, tolerant column handling), case-insensitive image-filename matching, `missing_image` row marking, and results-CSV column shape.

Run in milliseconds, never call the LLM, safe for CI.

### Tier 2 — end-to-end evals (live LLM)

```bash
npm run eval                 # ~8 seconds, costs cents
npm run eval -- --save       # also writes the generated label PNGs to scripts/eval/out/
```

`scripts/eval/run.ts` deterministically renders seven synthetic alcohol labels via SVG→PNG (`scripts/eval/labels.ts`) and asserts the verifier's overall verdict on each. The cases mirror the stakeholder concerns from the discovery interviews:

| Case | What it tests | Expected verdict |
| --- | --- | --- |
| `happy_path` | Label matches claim exactly, warning fully compliant | `approve` |
| `brand_case_diff` | Brand case-only difference (Dave's STONE'S THROW vs Stone's Throw) | `needs_review` |
| `abv_mismatch` | Claim ABV materially differs from label | `reject` |
| `net_contents_format` | "750 mL" vs "750ML" — formatting only | `approve` or `needs_review` |
| `warning_paraphrased` | Warning body wording is not the canonical text | `reject` |
| `warning_header_lowercase` | Body correct, header rendered "Government Warning:" (Jenny's exact case) | `needs_review` |
| `warning_missing` | Label has no government warning at all | `reject` |

Last clean run on `openai/gpt-5.4-mini`: **7/7 passing in ~8 s wall clock**.

## Swapping LLM providers

The verifier is split into:

```
src/lib/verifier/
  types.ts          ← LabelVerifier interface + result types
  ttb.ts            ← Regulatory constants (warning text, mandatory fields)
  prompt.ts         ← System prompt + JSON schema (shared across providers)
  postprocess.ts    ← Server-side deterministic checks for the warning
  anthropic.ts      ← Anthropic Claude implementation
  openai.ts         ← OpenAI implementation
  index.ts          ← Factory: reads LLM_PROVIDER and returns a verifier
```

To swap providers: set `LLM_PROVIDER=anthropic` (and `ANTHROPIC_API_KEY`) in your env and restart. The prompt, JSON schema, and post-processing are shared — only the SDK call changes.

To add a third provider (e.g., Azure, AWS Bedrock):

1. Implement `LabelVerifier` against the new SDK in `src/lib/verifier/<provider>.ts`.
2. Reuse `SYSTEM_PROMPT`, `buildUserPrompt`, and `VERIFICATION_JSON_SCHEMA` from `prompt.ts`.
3. Reuse `finalizeResult` from `postprocess.ts` so the warning check stays consistent.
4. Add a `case` to the switch in `index.ts`.

## Batch input format

CSV with the following header row (case-sensitive):

```
imageFilename,brandName,classType,alcoholContent,netContents,producer,countryOfOrigin,beverageType
```

`imageFilename` must match the name of one of the uploaded image files (case-insensitive). The Batch tab also includes a **Try sample batch** button that loads a three-label demo (CSV + matching images bundled in `public/demo/` — see [docs/demo.md](docs/demo.md)) so reviewers can exercise the flow in one click, plus a **Download CSV template** button for users starting from scratch.

## Verdict semantics

- **`exact_match`** — character-equivalent to the expected value, ignoring leading/trailing whitespace.
- **`semantic_match`** — same meaning but differs in case, punctuation, spacing, or trivial typography (e.g. `STONE'S THROW` vs `Stone's Throw`, `750 mL` vs `750ML`). Agents told us these should *not* auto-reject.
- **`mismatch`** — a substantive disagreement (e.g. wrong brand, wrong ABV number).
- **`missing`** — not detectable on the label.

The overall verdict aggregates these:

- **Approve** — every field is `exact_match` and the warning passes all three checks.
- **Needs Review** — at least one `semantic_match`, or the warning text is correct but the header is not all caps.
- **Reject** — any `mismatch`, any required `missing`, or any warning failure.

The country-of-origin field is skipped from aggregation when the applicant left it blank, since it is only required for imports.

## Assumptions

- **One label image per submission.** Real COLA applications include front/back/neck label images; this prototype handles one. Multi-image support is a straightforward extension — send each image and have the model report which fields it sourced from which view.
- **English-language US-market labels.** The canonical warning text is hard-coded from 27 CFR § 16.21 (US TTB).
- **Stateless, no PII, no persistence.** Every verification is independent; nothing is logged or stored. Production would need at minimum: per-agent sign-in, an audit log of every verification, and document retention rules per federal records-management policy. Marcus called this out explicitly in his interview.
- **Outbound traffic to `api.openai.com` / `api.anthropic.com` is permitted.** TTB's firewall reportedly blocks many endpoints (Marcus, again); a real deployment would need those whitelisted or a private model endpoint (Azure OpenAI, AWS Bedrock). The provider abstraction makes that swap a localized change.
- **Model judgement is acceptable for unencoded regulatory tolerances.** TTB allows ABV tolerances by beverage class (e.g. ±1.5% on some malt beverages, ±0.3% absolute on spirits). The prototype defers to the model rather than encoding the rules explicitly; making them deterministic is a clean follow-up.
- **Bold formatting of the warning header is judged by the model, not by us.** 27 CFR § 16.21 requires "GOVERNMENT WARNING:" in **both** all-caps **and** bold. The post-processor verifies all-caps deterministically; bold detection is left to the model's `headerAllCaps` reasoning.

## Open trade-offs

- **No per-field model confidence is surfaced.** A production tool would want per-field confidence so low-confidence items can be auto-routed to human review.
- **Batch concurrency is capped at 4.** Polite-citizen default for the shared API key; trivial to lift for a real deployment.
- **No fine-tuning, no RAG.** The canonical warning text is in the system prompt and the model uses general OCR + reasoning. A retrieval-augmented variant could let the system stay current as 27 CFR text evolves.

## Sources

- 27 CFR Part 16 — Alcoholic Beverage Health Warning Statement
- 27 CFR Part 5 — Labeling and Advertising of Distilled Spirits
- 27 CFR Part 7 — Labeling and Advertising of Malt Beverages
- 27 CFR Part 4 — Labeling and Advertising of Wine
- TTB Labeling Resources: https://www.ttb.gov/regulated-commodities/labeling/labeling-resources
