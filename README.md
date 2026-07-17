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
- **Beverage-type-aware rules** — a Beverage Type selector (Distilled Spirits / Wine / Beer) drives class-specific alcohol-content rules (e.g. wine stating "Table Wine" instead of a numeric ABV, or a malt beverage omitting an ABV statement, isn't auto-rejected) per 27 CFR Parts 4/5/7. See `BEVERAGE_RULES` in `src/lib/verifier/ttb.ts`.
- **Imperfect-image handling** — the model reports an `imageQuality` signal (angle, glare, low light, blur) independent of the field verdicts, and the UI surfaces a distinct "may be hard to read — consider a rescan" banner rather than silently downgrading fields to "missing."
- **Provider-agnostic** — the LLM backend lives behind a `LabelVerifier` interface. OpenAI (GPT-5.4 / GPT-5.4-mini / GPT-5.5) and Anthropic Claude implementations are both included. Switch with one env var.
- **Deterministic warning check** — the warning text and header-case verdicts are re-derived on the server against the regulatory text rather than trusting the model's self-report, so the most regulatorily-load-bearing check doesn't drift.
- **Performance guarantee, enforced not just measured** — a 20-second client + server timeout (`src/lib/verifier/limits.ts`) fails fast with an actionable message instead of hanging, and `npm run eval` prints a p50/max latency summary against the stakeholder's 5-second budget on every run.
- **Government-network-aware error handling** — a hung or blocked outbound call (e.g. an un-allow-listed firewall) surfaces as "Could not reach the AI provider..." rather than a generic fetch error, plus a client + server upload-size cap and baseline security headers.
- **Designed for non-technical agents** — large click targets, plain language, three-state badge (Approve / Needs Review / Reject) that mirrors how an agent actually triages, `aria-live` status announcements, and semantic table markup for screen-reader users.

## Tech stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| LLM (default) | **OpenAI GPT-5.4-mini** (`gpt-5.4-mini`) — chosen for speed and cost on a task that's mostly OCR + structured comparison rather than deep reasoning |
| LLM (alternate) | Anthropic Claude Sonnet 4.6 (`claude-sonnet-4-6`) |
| Tests & evals | Vitest unit + component + integration tests (54 tests: post-processor, batch logic, `UploadZone`/`ResultPanel`/`SingleLabelView` with React Testing Library + axe, and an `/api/verify` route integration test) + a live-LLM end-to-end eval (`npm run eval`, 13 cases) |
| CSV | Papa Parse |
| Deployment | Vercel |

The single vision request does OCR + field extraction + comparison in one structured-output call. There is no separate OCR step. This is the simplest way to hit the 5-second latency budget the stakeholder cited. Latest live eval: p50 2.7s, max 3.9s across 13 cases on `gpt-5.4-mini` (regenerate with `npm run eval`).

## Approach

- **Single-call vision.** OCR + field extraction + claim comparison happen in one structured-output call to the LLM. The prompt (`src/lib/verifier/prompt.ts`) carries the canonical regulatory text, defines the verdict vocabulary (`exact_match` / `semantic_match` / `mismatch` / `missing`), and pins the response to a JSON Schema enforced via OpenAI strict mode or Anthropic tool-use. Minimising round trips is what makes the 5-second budget reachable.
- **Provider abstraction.** A `LabelVerifier` interface (`src/lib/verifier/types.ts`) backs the route handler; the OpenAI and Anthropic implementations only differ in how they invoke the SDK. Adding a third backend (Azure OpenAI, AWS Bedrock, etc.) is one file plus a `case` in the factory.
- **Server-side authority on the warning.** The federal health warning is the most regulatorily load-bearing field. `postprocess.ts` re-derives the warning verdict deterministically: it counts canonical key phrases in the model's observed text — five or more accepts (tolerates the truncation the model sometimes does mid-transcription), two or fewer rejects (catches paraphrase), and the ambiguous middle defers to the model. Header-casing is checked separately from body wording, so a "Government Warning:" header is `needs_review` rather than a flat `reject`.
- **Three-state triage verdict.** `approve` / `needs_review` / `reject` mirrors how an agent actually sorts a queue. Semantic-only differences (case, punctuation, spacing) flow to `needs_review` rather than auto-rejecting — directly addresses Dave Morrison's "STONE'S THROW vs Stone's Throw" judgment-call example.
- **Beverage-class-aware alcohol-content evaluation.** `BEVERAGE_RULES` in `ttb.ts` describes *whether and how* ABV must be disclosed per beverage class (spirits always mandatory; wine and beer/malt beverages often not) and is threaded into both the prompt (so the model applies the right leniency) and `postprocess.ts` (so a beverage-appropriate "missing" ABV doesn't drive a reject). It deliberately does not hard-code numeric tolerance bands — see the `REGULATORY_CAVEAT` constant.
- **Image-quality signal, separate from field verdicts.** The model reports `imageQuality: { readable, issues[] }` independently of per-field verdicts, addressing Jenny Park's ask that the tool handle (and flag, not silently punish) angled/glared/poorly-lit photos. `scripts/eval/degrade.ts` applies real rotate/blur/glare transforms to the synthetic fixtures so this is validated against non-pristine input, not just clean renders.
- **Fail fast, not silent, on a blocked network.** A 20-second timeout wraps the LLM call on both client and server (`src/lib/verifier/limits.ts`); on timeout or abort, the UI shows a message calling out that a restricted government firewall is a likely cause, rather than a generic error or an indefinite spinner.
- **Two test tiers.** Unit + component + integration tests (Tier 1, no LLM) cover the post-processor, batch logic, key UI components (React Testing Library, with automated axe accessibility checks), and the `/api/verify` route handler (mocked verifier). Live-LLM evals (Tier 2) drive thirteen cases — the original seven plus beverage-type and realistic-degraded-image cases — against the real model, with a latency-budget summary printed every run.

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

### Tier 1 — unit, component, and integration tests (free, fast, deterministic)

```bash
npm test          # one-shot run
npm run test:watch
```

Six suites, 54 tests total, all free and deterministic (no LLM calls):

- **`src/lib/verifier/postprocess.test.ts`** (18 tests) — the deterministic post-processor: overall verdict aggregation, government warning re-checks (paraphrased text rejection, OCR truncation tolerance via the canonical-key-phrase safety net, header case enforcement), country-of-origin optionality, beverage-type-specific ABV leniency (wine/beer vs. spirits), image-quality pass-through, and metadata pass-through.
- **`src/components/batch.test.ts`** (9 tests) — the pure logic behind the Batch tab: CSV record → `LabelClaim` mapping, case-insensitive image-filename matching, `missing_image` row marking, and results-CSV column shape.
- **`src/components/UploadZone.test.tsx`** (7 tests) — click/drag/keyboard file selection, non-image and oversized-file rejection messaging, and an automated axe accessibility check.
- **`src/components/ResultPanel.test.tsx`** (7 tests) — correct badge/copy per verdict, warning-issue rendering, the image-quality banner, and an automated axe accessibility check.
- **`src/components/SingleLabelView.test.tsx`** (5 tests) — Verify-button gating, `loadExample`, the beverage-type selector, and both the error and success paths against a mocked `fetch`.
- **`src/app/api/verify/route.test.ts`** (8 tests) — integration test against the actual `POST` handler (mocked `LabelVerifier`, no real LLM call): missing/invalid fields, disallowed mime type, oversized upload, the network-timeout path, and the happy path.

Component tests run under `jsdom` via `@testing-library/react`; pure-logic tests stay on the faster `node` environment (see `vitest.config.ts`'s `environmentMatchGlobs`).

### Tier 2 — end-to-end evals (live LLM)

```bash
npm run eval                 # ~15 seconds, costs cents
npm run eval -- --save       # also writes the generated label images to scripts/eval/out/
```

`scripts/eval/run.ts` deterministically renders synthetic alcohol labels via SVG→PNG (`scripts/eval/labels.ts`), optionally degrades a copy to simulate a real photo (`scripts/eval/degrade.ts` — rotation, blur, a glare overlay), and asserts the verifier's overall verdict on each. The cases mirror the stakeholder concerns from the discovery interviews:

| Case | What it tests | Expected verdict |
| --- | --- | --- |
| `happy_path` | Label matches claim exactly, warning fully compliant | `approve` |
| `brand_case_diff` | Brand case-only difference (Dave's STONE'S THROW vs Stone's Throw) | `needs_review` |
| `abv_mismatch` | Claim ABV materially differs from label | `reject` |
| `net_contents_format` | "750 mL" vs "750ML" — formatting only | `approve` or `needs_review` |
| `warning_paraphrased` | Warning body wording is not the canonical text | `reject` |
| `warning_header_lowercase` | Body correct, header rendered "Government Warning:" (Jenny's exact case) | `needs_review` |
| `warning_missing` | Label has no government warning at all | `reject` |
| `wine_class_statement_no_abv` | Wine states "Table Wine" instead of a numeric ABV — not mandatory (27 CFR Part 4) | `approve` or `needs_review` |
| `beer_no_abv_statement` | Malt beverage with no ABV statement at all — often exempt federally (27 CFR Part 7) | `approve` or `needs_review` |
| `spirits_missing_abv_still_rejects` | Spirits with no ABV statement — always mandatory, beverage exemption must not leak in | `reject` |
| `photographed_at_angle` | Rotated + recompressed label (Jenny's imperfect-image ask) | loose — must not crash |
| `glare_and_low_light` | Simulated glare + darkened image | loose — must not crash, must flag `imageQuality` |
| `blurry_shot` | Out-of-focus photo | loose — must not crash, must flag `imageQuality` |

Last clean run on `openai/gpt-5.4-mini`: **13/13 passing**, wall clock ~14s, **latency p50 2.7s / max 3.9s** against the 5-second target Sarah Chen cited.

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

`imageFilename` must match the name of one of the uploaded image files (case-insensitive). `beverageType` (`spirits` / `wine` / `beer`) drives class-specific alcohol-content rules — see [Beverage-type-specific rules](#beverage-type-specific-rules) below; it's optional per row and defaults to spirits-level strictness if omitted. The Batch tab also includes a **Try sample batch** button that loads a three-label demo (CSV + matching images bundled in `public/demo/` — see [docs/demo.md](docs/demo.md)) so reviewers can exercise the flow in one click, plus a **Download CSV template** button for users starting from scratch.

## Beverage-type-specific rules

TTB's mandatory-field and alcohol-content-disclosure rules differ materially by beverage class (27 CFR Parts 4, 5, 7), but the prototype originally collected `beverageType` without ever reading it. It's now wired through end-to-end:

- **UI** — the Single Label form has a Beverage Type selector; the batch CSV has the `beverageType` column.
- **Prompt** (`src/lib/verifier/prompt.ts`) — the claimed beverage type and its `BEVERAGE_RULES` guidance (`src/lib/verifier/ttb.ts`) are included in every request, so the model applies beverage-appropriate leniency when judging the alcohol-content field (e.g. a wine label stating "Table Wine" instead of a percentage, or a beer label with no ABV statement at all, isn't treated the same as a spirits label missing its mandatory ABV).
- **Postprocessing** (`src/lib/verifier/postprocess.ts`) — a "missing" alcohol-content verdict is excluded from the overall-verdict aggregation when the beverage class doesn't mandate a numeric ABV statement, the same way an unclaimed country-of-origin is already excluded.

This intentionally does **not** hard-code numeric ABV tolerance bands (e.g. exact ± percentages) — see `REGULATORY_CAVEAT` in `ttb.ts`. Getting a specific tolerance number wrong in a compliance tool is worse than deferring to reviewer judgment; those bands should be confirmed with TTB legal before any production use.

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

## Government network realities

Marcus Williams' interview flagged two concrete risks: outbound traffic to third-party ML endpoints can be silently blocked by TTB's firewall (the scanning-vendor pilot half-broke this way), and a production deployment has PII/document-retention obligations this prototype doesn't need. What's actually implemented vs. still a documented trade-off:

**Implemented:**
- **20-second client + server timeout** (`src/lib/verifier/limits.ts`) on every verify call. A hung or blocked call fails fast with "Could not reach the AI provider... on restricted government networks, this usually means the outbound endpoint isn't allow-listed" instead of an indefinite spinner or a generic error.
- **8 MB upload cap**, enforced client-side (before upload) and server-side (belt-and-suspenders against a malformed/malicious client), both with plain-language error messages.
- **Baseline security headers** (`next.config.ts`): `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, a minimal `Permissions-Policy`.
- **Stateless, no PII, no persistence.** Every verification is independent; nothing is logged or stored beyond a server-side `console.error` on failure (error message only, never the image).

**Still a documented trade-off, not implemented:**
- **Outbound traffic to `api.openai.com` / `api.anthropic.com` must be allow-listed.** A real deployment would need a private model endpoint (Azure OpenAI, AWS Bedrock) instead — the `LabelVerifier` provider abstraction makes that swap a localized change, but no such backend is wired up here.
- **No per-agent sign-in or audit log.** Production would need both, per federal records-management policy.
- **The 20-second timeout doesn't cancel the in-flight upstream request** — it stops waiting on it and returns an error to the user, but the underlying LLM SDK call (which has no cheap cancellation hook here) still runs to completion in the background. Acceptable for a prototype; a production version would want a real `AbortSignal` threaded into the SDK call.
- **No rate limiting.** Deliberately omitted rather than implemented naively — in-memory rate limiting doesn't hold up across serverless instances, and a real implementation needs a shared store (Redis, etc.) that's out of scope for a prototype.

## Accessibility

Built for the workforce described in the interviews — Dave (28 years, "still prints his emails") and Sarah's 73-year-old mother as the tech-comfort benchmark:

- Large click targets, plain language, a three-state badge instead of raw JSON.
- `aria-live="polite"` status regions announce state changes (reviewing → verdict, batch progress → completion summary) for screen-reader users, matching what sighted users already see.
- The upload control is keyboard-operable (Enter/Space, visible focus ring) and doesn't nest a real `<input>` inside its `role="button"` container (an axe-flagged anti-pattern even when the input is visually hidden).
- The batch results table has a `<caption>` and `scope="col"` headers.
- `prefers-reduced-motion` disables the loading-spinner animation.
- Automated regression coverage via `vitest-axe` in the component test suite (Tier 1) — see [Tests and evals](#tests-and-evals).

## Assumptions

- **One label image per submission.** Real COLA applications include front/back/neck label images; this prototype handles one. Multi-image support is a straightforward extension — send each image and have the model report which fields it sourced from which view.
- **English-language US-market labels.** The canonical warning text is hard-coded from 27 CFR § 16.21 (US TTB).
- **Model judgement is acceptable for unencoded numeric ABV tolerances.** TTB allows small ABV tolerances by beverage class. Beverage-class *disclosure* rules (whether/how ABV must appear) are now encoded — see [Beverage-type-specific rules](#beverage-type-specific-rules) — but exact numeric tolerance bands are deliberately left to model/reviewer judgment rather than hard-coded, pending TTB legal confirmation.
- **Bold formatting of the warning header is judged by the model, not by us.** 27 CFR § 16.21 requires "GOVERNMENT WARNING:" in **both** all-caps **and** bold. The post-processor verifies all-caps deterministically; bold detection is left to the model's `headerAllCaps` reasoning.

## Open trade-offs

- **No per-field model confidence is surfaced.** A production tool would want per-field confidence so low-confidence items can be auto-routed to human review.
- **Batch concurrency is capped at 4.** Polite-citizen default for the shared API key; trivial to lift for a real deployment.
- **No fine-tuning, no RAG.** The canonical warning text is in the system prompt and the model uses general OCR + reasoning. A retrieval-augmented variant could let the system stay current as 27 CFR text evolves.
- **Degraded-image eval fixtures are synthetic transforms (rotate/blur/glare-overlay via sharp), not real photographs.** They're a meaningfully closer proxy to real capture conditions than the original pristine-only renders, but not a substitute for testing against actual phone photos of real labels.

## Sources

- 27 CFR Part 16 — Alcoholic Beverage Health Warning Statement
- 27 CFR Part 5 — Labeling and Advertising of Distilled Spirits
- 27 CFR Part 7 — Labeling and Advertising of Malt Beverages
- 27 CFR Part 4 — Labeling and Advertising of Wine
- TTB Labeling Resources: https://www.ttb.gov/regulated-commodities/labeling/labeling-resources
