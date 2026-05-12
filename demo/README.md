# Demo fixtures

Three synthetic alcohol-beverage label PNGs used in the demo walkthrough. Drag and drop these into LabelCop's upload zone during the recording.

| File | Use for | What's "wrong" |
| --- | --- | --- |
| `01-perfect-label.png` | **Approve** demo (and case-difference demo) | Nothing — fully compliant |
| `02-lowercase-warning-header.png` | **Needs Review** demo | Warning text is correct, but the header reads "Government Warning:" instead of "GOVERNMENT WARNING:" (Jenny Park's exact rejection case) |
| `03-missing-warning.png` | **Reject** demo | The mandatory federal health warning is missing from the label |

Regenerate any time with:

```bash
npm run demo:fixtures
```

The generator lives in [`../scripts/generate-demo-fixtures.ts`](../scripts/generate-demo-fixtures.ts) and reuses the same SVG → PNG renderer that the end-to-end eval uses.
