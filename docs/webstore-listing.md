# Chrome Web Store listing — Even Better Canvas

Everything the dashboard asks for, ready to paste. Package: `canvas-classroom.zip`
(239 entries, built 2026-10-29 right after the last source change; checked and it
carries no `config.local.json`, no keys).

---

## Store listing

**Name** (45 max)

```
Even Better Canvas
```

**Short description** (132 max)

```
A Google Classroom-inspired interface for Canvas: assignments, file viewer, AI help and more. Requires the BetterCanvas extension.
```

The current `manifest.description` is exactly 132, so it fits — the problem is not length.
It opens with "BETTER CANVAS MUST BE INSTALLED!", and store policy treats all-caps shouting
in a listing as grounds for rejection; the dependency also reads better as a plain sentence.
The replacement above is 130 characters. `manifest.json` needs the same text, since the
store takes the short description from the manifest.

**Category:** Productivity
**Language:** English

**Detailed description** — draft:

```
Even Better Canvas lays a Google Classroom-style interface over Canvas. It runs on top of
BetterCanvas, which must be installed first.

What it changes:
- A course home page that puts the stream, upcoming work and materials where you expect them
- Classwork grouped by module, with status on every item
- An assignment page you can submit from, with your grade and the grader's feedback in one place
- A file viewer that opens Canvas files inline instead of downloading them
- A to-do view across every course
- People, inbox and announcements in the same layout
- An optional AI assistant that answers questions about the course you are on
- A pet, if you want one

Your data stays in your browser. There is no Even Better Canvas server, no analytics and no
tracking. The AI features are off until you add your own OpenAI key, and when they run they
talk to OpenAI directly from your browser.
```

**Privacy policy URL** — the store requires a public URL, and `docs/privacy.md` is only in
the repo. Either of these works once pushed:

```
https://github.com/SaifSyed08/canvas-classroom/blob/main/docs/privacy.md
```

**Screenshots** — `docs/screenshots/webstore-1280x800/` now holds 9 PNGs at exactly
1280x800, downscaled from the 1440x900 originals (same 16:10, nothing cropped). The store
takes up to 5, so a reasonable order is:

1. `course-home.png` — the thing that makes the extension make sense at a glance
2. `classwork.png`
3. `assignment.png`
4. `ask.png` — the AI feature
5. `file-viewer.png`

`link-preview.jpg` is 860x500 and was not converted; it is the odd one out and is not
needed for the listing.

**Still missing:** a 440x280 promo tile. The store will take a listing without one, but it
cannot be featured without it.

---

## Privacy practices tab

This is the part that gets submissions rejected, because every host permission needs a
justification in the developer's own words.

**Single purpose**

```
Re-presents a student's own Canvas courses in a Google Classroom-style interface.
```

**Permission justifications**

| Item | Why |
| --- | --- |
| `storage`, `unlimitedStorage` | Keeps the user's own settings and a local cache of the Canvas data already fetched for their session, so pages do not re-fetch on every visit. Nothing leaves the browser. |
| `https://*.instructure.com/*` | The extension is a Canvas interface; it reads the user's Canvas through their existing signed-in session. |
| `https://*.inscloudgate.net/*`, `https://*.amazonaws.com/*` | Canvas serves uploaded course files from these hosts. Needed to display a file inline rather than downloading it. |
| `https://api.openai.com/*` | The optional AI assistant, called directly from the browser with a key the user supplies. No key, no request. |
| `https://codex-pets.net/*` | The optional pet's art, fetched from the public pet library. |

**Data use disclosures** — declare that *Personally identifiable information* and *Website
content* are handled, and tick all three certifications: not sold to third parties, not used
or transferred for any purpose unrelated to the single purpose above, and not used to
determine creditworthiness or for lending.

Be ready for a review question about `api.openai.com`: an extension that reads coursework
and can send it to a third party gets looked at. The answer is that it is the user's own key
and their own request, and `docs/privacy.md` says so.

---

## What only you can do

Creating the draft itself needs your Google account, so I stopped here:

1. The dashboard is open. If this is the first item on the account, Google charges a one-off
   **$5 developer registration fee** before anything can be created.
2. **New item → upload** `C:\Users\Saif Syed\canvas-classroom\canvas-classroom.zip`
3. Paste the fields above, add the 5 screenshots, set the privacy policy URL.
4. **Save draft.** Do not hit Submit for review until the two blockers below are done.

## Blockers before submitting

- [ ] Replace the all-caps opening in `manifest.description` with the version above and
      rebuild the zip (it fits the 132 limit either way — this is the policy issue, not length)
- [ ] Push `docs/privacy.md` so the policy URL resolves publicly
- [ ] Decide whether the pet and the AI assistant ship in v1 — each adds a host permission
      the reviewer will ask about, and dropping either shortens the review
