# LabelCop

> AI-powered prototype for the **U.S. Alcohol and Tobacco Tax and Trade Bureau (TTB)** label-compliance review workflow.

LabelCop takes (a) the values an applicant entered on their COLA application and (b) the actual label artwork, and tells a compliance agent in a few seconds whether the label matches the application and whether the mandatory federal health warning is correctly worded and formatted.

It is a take-home / proof-of-concept implementation. It does **not** integrate with the production COLA system.

---

## Demo

After deployment, the application is available at the URL listed in the project's GitHub repo (look for the **Deployments** section on the right side of the repo home).

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
| Tests | Vitest (Tier 1 unit tests on the deterministic post-processor) |
| CSV | Papa Parse |
| Deployment | Vercel |

The single vision request does OCR + field extraction + comparison in one structured-output call. There is no separate OCR step. This is the simplest way to hit the 5-second latency budget the stakeholder cited. (First measured end-to-end: ~3.3 s with `gpt-5.4-mini`.)

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

## Tests

```bash
npm test          # one-shot run
npm run test:watch
```

The Tier 1 suite (in `src/lib/verifier/postprocess.test.ts`) covers the deterministic post-processor — overall verdict aggregation, government warning re-checks against 27 CFR § 16 wording, header case enforcement, country-of-origin optionality, and metadata pass-through. These run in milliseconds and do not call the LLM, so they are safe to run in CI without burning credits.

A Tier 2 end-to-end eval script that exercises the live LLM against a battery of synthetic label cases is planned (`npm run eval`).

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

`imageFilename` must match the name of one of the uploaded image files (case-insensitive). The Batch tab includes a **Download CSV template** button.

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

## Trade-offs and limitations

- **Prototype only.** No persistence, no auth, no audit trail. A production deployment would need at minimum: per-agent sign-in, an audit log of every verification, and document retention rules per federal records-management policy.
- **Single-image labels.** Real applications include front/back/neck label images. Adding multi-image support is a straightforward extension: send each image and have the model report which fields it sourced from which view.
- **No structured ABV tolerance.** TTB allows tolerances on labelled ABV depending on beverage class (e.g. ±1.5% for some malt beverages, ±0.3% absolute for spirits). The current implementation defers to the model's judgment; encoding regulatory tolerances explicitly is a clean follow-up.
- **Model confidence is implicit.** We surface the verdict but not a numeric confidence. For a production tool, exposing per-field confidence (and routing low-confidence items to human review) would improve trust.
- **Outbound network.** Verification calls hit `api.openai.com` (default) or `api.anthropic.com`. The stakeholder mentioned TTB's outbound firewall is restrictive — a production deployment would need those endpoints whitelisted, or alternatively a private model endpoint (Azure OpenAI, AWS Bedrock, etc.). The provider abstraction makes that swap a localized change.
- **Latency.** With a single vision call the typical end-to-end is 2–5 seconds. Batch parallelism is capped at 4 concurrent requests to be a polite API citizen; that cap is trivial to lift for a real deployment.

## Sources

- 27 CFR Part 16 — Alcoholic Beverage Health Warning Statement
- 27 CFR Part 5 — Labeling and Advertising of Distilled Spirits
- 27 CFR Part 7 — Labeling and Advertising of Malt Beverages
- 27 CFR Part 4 — Labeling and Advertising of Wine
- TTB Labeling Resources: https://www.ttb.gov/regulated-commodities/labeling/labeling-resources
