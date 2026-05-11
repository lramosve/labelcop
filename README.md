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
- **Provider-agnostic** — the LLM backend lives behind a `LabelVerifier` interface. Anthropic Claude and OpenAI GPT-5.5 implementations are both included. Switch with one env var.
- **Deterministic warning check** — the warning text and header-case verdicts are re-derived on the server against the regulatory text rather than trusting the model's self-report, so the most regulatorily-load-bearing check doesn't drift.
- **Designed for non-technical agents** — large click targets, plain language, three-state badge (Approve / Needs Review / Reject) that mirrors how an agent actually triages.

## Tech stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| LLM (default) | Anthropic Claude Sonnet 4.6 (`claude-sonnet-4-6`) |
| LLM (alternate) | OpenAI GPT-5.5 (`gpt-5.5`) |
| CSV | Papa Parse |
| Deployment | Vercel |

The single Claude/OpenAI request does OCR + field extraction + comparison in one structured-output call. There is no separate OCR step. This is the simplest way to hit the 5-second latency budget the stakeholder cited.

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
| `LLM_PROVIDER` | yes | `anthropic` (default) or `openai` |
| `ANTHROPIC_API_KEY` | when `LLM_PROVIDER=anthropic` | your Anthropic API key |
| `ANTHROPIC_MODEL` | optional | overrides the default model `claude-sonnet-4-6` |
| `OPENAI_API_KEY` | when `LLM_PROVIDER=openai` | your OpenAI API key |
| `OPENAI_MODEL` | optional | overrides the default model `gpt-5.5` |

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

To swap providers: set `LLM_PROVIDER=openai` (and `OPENAI_API_KEY`) in your env and restart. The prompt, JSON schema, and post-processing are shared — only the SDK call changes.

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
- **Outbound network.** Verification calls hit `api.anthropic.com` (default) or `api.openai.com`. The stakeholder mentioned TTB's outbound firewall is restrictive — a production deployment would need those endpoints whitelisted, or alternatively a private model endpoint (Bedrock, Azure OpenAI, etc.). The provider abstraction makes that swap a localized change.
- **Latency.** With a single vision call the typical end-to-end is 2–5 seconds. Batch parallelism is capped at 4 concurrent requests to be a polite API citizen; that cap is trivial to lift for a real deployment.

## Sources

- 27 CFR Part 16 — Alcoholic Beverage Health Warning Statement
- 27 CFR Part 5 — Labeling and Advertising of Distilled Spirits
- 27 CFR Part 7 — Labeling and Advertising of Malt Beverages
- 27 CFR Part 4 — Labeling and Advertising of Wine
- TTB Labeling Resources: https://www.ttb.gov/regulated-commodities/labeling/labeling-resources
