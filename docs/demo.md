# LabelCop demo walkthrough

End-to-end materials for recording a ~2-minute screen capture of LabelCop. The deployed app lives at https://labelcop.vercel.app.

## Demo fixtures

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

---

## Recording tool

**Loom** (free, browser-based) is the recommended pick: https://www.loom.com — install the Chrome extension or use the desktop app. The 5-minute free limit fits this demo with room to spare, and the output is a shareable URL you can paste straight into a submission.

If you'd rather skip the signup: **Windows 11 has a built-in screen recorder** via the Snipping Tool (`Win+Shift+R`). Output is an MP4 you'd need to upload (Google Drive, YouTube unlisted, etc.) since there's no automatic share link.

## Pre-flight checklist

Do these *before* you hit Record:

1. **Pre-warm the deployed app** — open https://labelcop.vercel.app once so the Vercel function is warm (eliminates a cold-start ~1 s on the first verify).
2. **Open `public/demo/` in Explorer** at `C:\Users\lramo\Documents\USTreasury\labelcop\public\demo\` and move it to a second monitor or off-screen window so the three PNGs are visible and ready to drag.
3. **Close unrelated browser tabs**, hide the bookmarks bar (`Ctrl+Shift+B`), and zoom the LabelCop page to 110–125% (`Ctrl++`) so text reads well in the recording.
4. **Quiet notifications**: Windows → Focus Assist → Alarms only.

## 2-minute script

Read this as you record. Bracketed cues are stage directions, not spoken.

> **[0:00–0:10 — Intro, on the homepage]**
> "Hi — this is LabelCop, a prototype I built for the TTB's COLA label-review workflow. The pitch is simple: instead of an agent reading every label by eye, they paste in the application data, drop in the label image, and get a verdict in about three seconds."

> **[0:10–0:40 — Approve demo]**
> *Click "Load example"* (fields auto-fill). "Here's a typical distilled-spirits application — brand name, class/type, ABV, net contents, producer." *Drag in `01-perfect-label.png`*. "And here's the label artwork." *Click Verify Label*. **[~3 second pause as it runs]** "Green Approve — every field is an exact match, and all three warning checks pass: present, exact text, header all caps. Notice the latency in the corner — three-point-something seconds, well under Sarah Chen's five-second budget."

> **[0:40–1:10 — Needs Review demo]**
> "Now Dave Morrison's case. He told me 'STONE'S THROW' on a label vs 'Stone's Throw' in the application shouldn't auto-reject — that's a judgment call." *Edit Brand Name field to `Old Tom Distillery` (title case)*. *Click Verify Label*. **[~3 second pause]** "Amber Needs Review. The brand row now reads Semantic match — same value, different case. Human eyeball worth a glance, but not a rejection."

> **[1:10–1:35 — Reject demo]**
> "Now Jenny Park's case — what happens if the federal health warning is missing entirely." *Click Reset, then Load example*. *Drag in `03-missing-warning.png`*. *Click Verify Label*. **[~3 second pause]** "Red Reject. Every field matches the claim, but the warning panel is red — 'Government warning is missing from the label.' The deterministic server-side check fires regardless of what the model says."

> **[1:35–1:55 — Batch tab]**
> *Click "Batch Verify" tab.* "For Janet's Seattle office that gets 300-label dumps from importers." *Click "Try sample batch"*. "One click loads three labels with matching application data." *Click "Verify 3 labels"*. **[~5 second pause as the three calls run in parallel]** "Three labels in parallel — one approve, one needs review, one reject. CSV export ready for the team." *Click "Export results CSV"*.

> **[1:55–2:05 — Wrap]**
> "Source is on GitHub — link in the description. OpenAI by default, Anthropic wired in via one env var, twenty-one unit tests and a seven-case live eval that runs on real model calls. Thanks for watching."

## Tips during recording

- **Don't move the mouse while talking.** Pause the cursor over what you're saying, then click. Reviewers' eyes follow your cursor.
- **Don't narrate clicks** ("Now I'm going to click..."). Just click and the audience sees it.
- **One take is fine.** If you stumble, pause for 2 seconds and pick up the sentence — Loom's edit tool can trim out gaps but not mid-sentence flubs.
- **Length sanity:** if you're past 2:30 you're probably over-explaining. Reviewers know what label verification is.

## After recording

- **Loom:** copy the share URL from the top-right "Share" button. Make sure the privacy setting is "Anyone with the link can view" before pasting it into your submission.
- **Snipping Tool:** upload the MP4 to YouTube as Unlisted, or to Google Drive with link sharing on.
