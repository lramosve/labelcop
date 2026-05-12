# Demo fixtures

Three synthetic alcohol-beverage label PNGs served as static assets at `/demo/<file>.png`. The Batch tab's **Try sample batch** button fetches them in-app, and you can also drag them from disk during a recorded walkthrough. The actual binary files live in [`../public/demo/`](../public/demo/).

| File | Use for | What's "wrong" |
| --- | --- | --- |
| `01-perfect-label.png` | **Approve** demo (and the brand-case-difference demo) | Nothing — fully compliant |
| `02-lowercase-warning-header.png` | **Needs Review** demo | Warning body is correct, but the header reads "Government Warning:" instead of "GOVERNMENT WARNING:" (Jenny Park's exact rejection case) |
| `03-missing-warning.png` | **Reject** demo | The mandatory federal health warning is missing from the label |

Regenerate any time with:

```bash
npm run demo:fixtures
```

The generator lives in [`../scripts/generate-demo-fixtures.ts`](../scripts/generate-demo-fixtures.ts) and reuses the same SVG → PNG renderer (`scripts/eval/labels.ts`) that the end-to-end eval uses. No API calls.
