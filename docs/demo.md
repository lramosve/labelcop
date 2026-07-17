# LabelCop demo walkthrough

End-to-end materials for recording a ~3.5-minute screen capture of LabelCop. The deployed app lives at https://labelcop.vercel.app.

## Demo fixtures

Seven synthetic alcohol-beverage label images served as static assets at `/demo/<file>.png` (or `.jpg`). The Batch tab's **Try sample batch** button fetches the first three in-app, and you can drag any of them from disk during a recorded walkthrough. The actual binary files live in [`../public/demo/`](../public/demo/).

| File | Use for | What it shows |
| --- | --- | --- |
| `01-perfect-label.png` | **Approve** demo (and the brand-case-difference demo) | Nothing — fully compliant |
| `02-lowercase-warning-header.png` | **Needs Review** demo | Warning body is correct, but the header reads "Government Warning:" instead of "GOVERNMENT WARNING:" (Jenny Park's exact rejection case) |
| `03-missing-warning.png` | **Reject** demo | The mandatory federal health warning is missing from the label |
| `04-wine-table-wine.png` | **Beverage-type rules** demo | Wine label stating "Table Wine" instead of a numeric ABV — pair with claimed Beverage Type = Wine and Alcohol Content = "Table Wine" to show it's *not* auto-rejected the way a spirits label with no ABV would be |
| `05-glare-and-low-light.jpg` | **Imperfect-image handling** demo | Same compliant label as `01`, degraded with simulated glare + low light (`scripts/eval/degrade.ts`) — the model still reads it correctly but the UI flags the capture quality with a dedicated banner |
| `06-multi-image-front.png` | **Multiple label images** demo (attach with `06-multi-image-back.png`) | Front label with no government warning at all |
| `06-multi-image-back.png` | **Multiple label images** demo (attach with `06-multi-image-front.png`) | Back label containing only the government warning — attaching both together shows the warning found on image 2 instead of falsely flagged missing |

Regenerate any time with:

```bash
npm run demo:fixtures
```

The generator lives in [`../scripts/generate-demo-fixtures.ts`](../scripts/generate-demo-fixtures.ts) and reuses the same SVG→PNG renderer (`scripts/eval/labels.ts`) plus the eval's degrade transforms (`scripts/eval/degrade.ts`). No API calls.

---

## Recording tool

**Loom** (free, browser-based) is the recommended pick: https://www.loom.com — install the Chrome extension or use the desktop app. The 5-minute free limit fits this demo with room to spare, and the output is a shareable URL you can paste straight into a submission.

If you'd rather skip the signup: **Windows 11 has a built-in screen recorder** via the Snipping Tool (`Win+Shift+R`). Output is an MP4 you'd need to upload (Google Drive, YouTube unlisted, etc.) since there's no automatic share link.

## Pre-flight checklist

Do these *before* you hit Record:

1. **Pre-warm the deployed app** — open https://labelcop.vercel.app once so the Vercel function is warm (eliminates a cold-start ~1 s on the first verify).
2. **Open `public/demo/` in Explorer** at `C:\Users\lramo\Documents\USTreasury\labelcop\public\demo\` and move it to a second monitor or off-screen window so all seven fixtures are visible and ready to drag. Note that `06-multi-image-front.png` and `06-multi-image-back.png` need to be dragged in **together** (select both, one drag) for the multi-image segment.
3. **Close unrelated browser tabs**, hide the bookmarks bar (`Ctrl+Shift+B`), and zoom the LabelCop page to 110–125% (`Ctrl++`) so text reads well in the recording.
4. **Quiet notifications**: Windows → Focus Assist → Alarms only.

## ~3.5-minute script

Read this as you record. Bracketed cues are stage directions, not spoken.

> **[0:00–0:10 — Intro, on the homepage]**
> "Hi — this is LabelCop, a prototype I built for the TTB's COLA label-review workflow. The pitch is simple: instead of an agent reading every label by eye, they paste in the application data, drop in the label image, and get a verdict in about three seconds."

> **[0:10–0:35 — Approve demo]**
> *Click "Load example"* (fields auto-fill). "Here's a typical distilled-spirits application — brand name, class/type, ABV, net contents, producer." *Drag in `01-perfect-label.png`*. "And here's the label artwork." *Click Verify Label*. **[~3 second pause as it runs]** "Green Approve — every field is an exact match, and all three warning checks pass: present, exact text, header all caps. Latency's in the corner — under three seconds, well inside the five-second budget my stakeholder interviews called out."

> **[0:35–1:00 — Needs Review demo]**
> "Now Dave Morrison's case. He told me 'STONE'S THROW' on a label vs 'Stone's Throw' in the application shouldn't auto-reject — that's a judgment call." *Edit Brand Name field to `Old Tom Distillery` (title case)*. *Click Verify Label*. **[~3 second pause]** "Amber Needs Review. The brand row now reads Semantic match — same value, different case. Worth a glance, not a rejection."

> **[1:00–1:25 — Reject demo]**
> "Now Jenny Park's case — what happens if the federal health warning is missing entirely." *Click Reset, then Load example*. *Drag in `03-missing-warning.png`*. *Click Verify Label*. **[~3 second pause]** "Red Reject. Every field matches the claim, but the warning panel is red — 'Government warning is missing from the label.' The deterministic server-side check fires regardless of what the model says."

> **[1:25–1:55 — Beverage-type rules demo]**
> "TTB's rules aren't one-size-fits-all — wine and beer don't always have to state a numeric ABV the way spirits do. So there's now a beverage-type selector." *Click Reset*. *Fill in Brand Name `Sonoma Ridge Cellars`, Class/Type `Cabernet Sauvignon`*. *Set Beverage Type to `Wine`*. *Set Alcohol Content to `Table Wine`, Net Contents `750 mL`, Producer `Sonoma Ridge Cellars, Sonoma, CA`*. *Drag in `04-wine-table-wine.png`*. *Click Verify Label*. **[~3 second pause]** "Approve — the label states 'Table Wine' instead of a percentage, and because I told it this is a wine claim, that's treated as satisfying the requirement instead of a mismatch. Look at the note on the alcohol-content row: it explains exactly why."

> **[1:55–2:20 — Imperfect-image handling demo]**
> "One of my compliance agents specifically asked about photos that aren't perfectly shot — glare, bad lighting, an angle." *Click Reset, then Load example*. *Drag in `05-glare-and-low-light.jpg`*. *Click Verify Label*. **[~3 second pause]** "Still an Approve — the model read through the glare fine — but see this banner? It flags the image quality separately from the field verdicts, so a reviewer knows to consider a rescan rather than treating a shaky photo as a compliance failure."

> **[2:20–2:50 — Multiple label images demo (new)]**
> "One thing that came up after I shipped this: a lot of real products split their required info across more than one label — a front brand label and a back strip label — and the government warning is often only on the back. The original version only took one photo, so a compliant product could get falsely rejected just because the warning wasn't on the one image you sent." *Click Reset, then Load example*. *Select both `06-multi-image-front.png` and `06-multi-image-back.png` together and drag them in* (or click the upload zone and multi-select both files). "Front label first, no warning at all. Back label second — nothing on it but the warning." *Click Verify Label*. **[~3 second pause]** "Approve — the model checked both images, found the warning on the second one, and didn't punish the label for the front photo alone not showing it. Up to four images per label are supported, and it's the same story in the batch CSV — just list multiple filenames separated by a semicolon."

> **[2:50–3:15 — Batch tab]**
> *Click "Batch Verify" tab.* "For bulk imports — 200, 300 labels dumped on the team at once." *Click "Try sample batch"*. "One click loads three labels with matching application data." *Click "Verify 3 labels"*. **[~5 second pause as the three calls run in parallel]** "Three labels in parallel — one approve, one needs review, one reject. CSV export ready for the team."

> **[3:15–3:30 — Wrap]**
> "Source is on GitHub — link in the description. OpenAI by default, Anthropic wired in via one env var. Full write-up of the approach, trade-offs, and how the test suite covers all this is in the README. Thanks for watching."

## Tips during recording

- **Don't move the mouse while talking.** Pause the cursor over what you're saying, then click. Reviewers' eyes follow your cursor.
- **Don't narrate clicks** ("Now I'm going to click..."). Just click and the audience sees it.
- **One take is fine.** If you stumble, pause for 2 seconds and pick up the sentence — Loom's edit tool can trim out gaps but not mid-sentence flubs.
- **Multi-select for the multi-image segment:** in the OS file picker or Explorer, Ctrl+click both `06-multi-image-*.png` files before dragging so they land in one drop — dragging them one at a time also works (the upload zone appends), it's just an extra beat.
- **Length sanity:** if you're past 4:00 you're probably over-explaining — Loom's free tier caps at 5 minutes, so there's still room, but reviewers know what label verification is.

## After recording

- **Loom:** copy the share URL from the top-right "Share" button. Make sure the privacy setting is "Anyone with the link can view" before pasting it into your submission.
- **Snipping Tool:** upload the MP4 to YouTube as Unlisted, or to Google Drive with link sharing on.
- **Update the README:** the demo link lives at the top of [`../README.md`](../README.md) (`**Demo video:** ...`) — swap in the new Loom/YouTube/Drive URL once you have it.
