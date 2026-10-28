# Chrome Web Store submission

Everything the Developer Dashboard asks for, ready to paste. Images are in `store/images/` (rebuild them with
`python store/make-images.py --name "..."` if the name changes).

## Before submitting

- [ ] Developer account: https://chrome.google.com/webstore/devconsole ($5 one-time fee, 2-step verification on).
- [x] Final name in `manifest.json`, `store/make-images.py --name`, the README and `docs/privacy.md`
      (Even Better Canvas; if the store turns it down, change it in all four and rebuild the images).
- [ ] A new icon. The current one (green board with a person) is close to Google Classroom's, and the store
      rejects icons that look like another product's.
- [ ] `version` in `manifest.json` (1.0.0 for the first listing); every later upload needs a higher one.
- [ ] Build the zip: `git archive --format=zip -o canvas-classroom.zip HEAD` from the repo root. It packs only
      tracked files and skips what `.gitattributes` marks `export-ignore` (docs, store, README), so
      `config.local.json` (your key) and `pets.local/` never go in. Commit first: it packs HEAD.
- [ ] Privacy policy URL: https://github.com/SaifSyed08/canvas-classroom/blob/main/docs/privacy.md
- [ ] Visibility: start **Unlisted** (only people with the link can install it), go Public once it's been used
      for a while.

## Store listing tab

**Name** (from the manifest, max 75): Even Better Canvas

**Summary** (the store takes it from the manifest's `description`, which already has it; 132 characters, the maximum):

> BETTER CANVAS MUST BE INSTALLED! A Google Classroom-inspired interface for BetterCanvas: assignments, file viewer, AI help and more.

**Category:** Education

**Language:** English (United States)

**Description:**

```
BETTER CANVAS MUST BE INSTALLED! Get BetterCampus (previously BetterCanvas), free on the Chrome Web Store, first.

Canvas, but it feels like Google Classroom, and then some.

Even Better Canvas rebuilds Canvas around how you actually use it. Pages open instantly from your last visit and refresh quietly in the background.

FEELS LIKE CLASSROOM
• A slim rail with all your classes. Hover to expand, pin it open, give each class an icon and color.
• Class cards with the next two weeks of work: Missing, Due 3 PM, Due Friday.
• Home, Classwork and People on every course. Everything else (Syllabus, Zoom, evaluations…) is one search away: press / and type.
• Classwork by topic, with grades, "Turned in" and "Missing" at a glance, and the course's files grouped by folder.
• Assignment pages with a Your work card: status, what you turned in, private comments, and turning in text, links or files.
• One To-do list for every class: Assigned, Missing, Done.

AI ASSISTANCE (BRING YOUR OWN KEY)
Press Ctrl + Space on any Canvas page and ask: "what's due this week?", "what did I get on Exam 2?", "summarize the lecture 9 slides". It reads your Canvas to answer, links what it cites, and can take you to the page. It only reads; it never submits or posts.
In the Inbox, start a reply and gray text suggests the rest, in your voice. Tab takes it, Esc hides it.
The AI runs on your own OpenAI key, which you paste into the settings. It stays in your browser and goes only to OpenAI. We never see it, or anything you ask.

MAKE IT YOURS
• Themes, or your school's own colors and logo, and a font for everything
• Page backgrounds: drawn, your own picture, or one AI makes from your description
• Illustrated, moving or AI-made class covers
• Shortcuts on class cards, pinned links on a class's Home
• Smooth page transitions (cards grow into the class banner), or turn motion off
• Seasonal confetti when you turn something in
• An optional pixel companion that reminds you what's due

FILES OPEN IN PLACE
PDFs, slides and documents open over the page with zoom, download and details, instead of sending you somewhere else.

GOOD TO KNOW
• Works on Canvas sites at *.instructure.com.
• Requires BetterCampus (previously BetterCanvas, free on the Chrome Web Store), which supplies the to-do sidebar, dark mode and themes.
• Everything except the AI works without an OpenAI key.
• We don't collect your data. No account, no tracking, no analytics, no developer server: your Canvas data is cached in your own browser, and the AI features send what they need straight to OpenAI with your key. Privacy policy: https://github.com/SaifSyed08/canvas-classroom/blob/main/docs/privacy.md

Not affiliated with Instructure, Google or BetterCampus (BetterCanvas).
```

**Screenshots** (1280x800, at most 5, in the order `store/images/screenshot-*` is numbered). Slides 1, 2 and
5 are built from your own screenshots in `store/raw/` (git-ignored, since they're unblurred), then
`python store/make-images.py` (add `--pet-at X,Y`, the pet's pixel spot, for a zoomed circle):

| File in `store/raw/` | What to capture (full window, 16:10, e.g. 1920x1200) |
| --- | --- |
| `theme-blossom.png` | Dashboard, pink: Blossom theme + Blossom background, greeting via `/?gcx-hello=returns`, a few class icons set |
| `theme-classroom.png` | Plain light Canvas look, `/?gcx-hello=morning` |
| `theme-schooldark.png` | BetterCampus dark mode + School theme, `/?gcx-hello=due` |
| `theme-forest.png` | Forest theme + Trees background, `/?gcx-hello=spooky` |
| `ai-pill.png` | Ctrl + Space open over a page, nothing typed yet |
| `ai-chat.png` | The same after asking something, with the answer showing |
| `pet.png` | The pet with its speech bubble up |

Until they're there, the old dashboard, Ask and assignment screenshots stand in.

**Small promo tile** (440x280, required): `promo-small.png`

**Marquee** (1400x560, optional): `promo-marquee.png`

**Homepage URL:** https://github.com/SaifSyed08/canvas-classroom
**Support URL:** https://github.com/SaifSyed08/canvas-classroom/issues

## Privacy tab

**Single purpose:**

> Redesigns Canvas (the learning management system) into a Google Classroom-style layout, with tools for
> getting around and keeping up with your classes: search, a to-do list, an in-place file viewer, an
> assistant that answers questions about your courses, AI reply suggestions in the Canvas Inbox, class
> cover images (drawn or AI-made), and an optional animated companion on Canvas pages.

**Permission justifications:**

| Permission | Justification |
| --- | --- |
| `storage` | Saves the user's settings, their OpenAI key, and cached copies of their Canvas pages so pages open instantly. |
| `unlimitedStorage` | The cache of Canvas data (courses, assignments, files lists) and the user's chosen pet images and class cover images can exceed the default 10 MB quota. |
| `https://*.instructure.com/*` | The extension's whole job: it changes Canvas pages and reads the user's own Canvas data through Canvas's API with their session. |
| `https://*.inscloudgate.net/*`, `https://*.amazonaws.com/*` | Canvas serves course files from these hosts (Canvas redirects file downloads to Instructure's file proxy and to S3 buckets, whose names and regions vary by school). Used to show PDFs in the in-place viewer, to let the assistant read a course file the user asks about, and to upload files the user turns in. Requests go only to file URLs Canvas itself returns. |
| `https://api.openai.com/*` | The AI features (Ask anything, Inbox suggestions, AI class covers and AI-drawn pets) call OpenAI with the user's own API key. |
| `https://codex-pets.net/*` | Lists the pet library and downloads the pet the user picks. The site sends no CORS headers, so the requests are made from the service worker. |

**Remote code:** No, I am not using remote code. (pdf.js is bundled under `viewer/pdfjs/`; nothing is loaded
or evaluated from the network.)

**Data usage** (tick these):

- Personally identifiable information (the user's name, and names and emails of instructors and classmates
  from Canvas, which go to OpenAI when the assistant is asked about people)
- Authentication information (the user's own OpenAI API key, stored locally and sent only to OpenAI)
- Personal communications (Canvas Inbox messages: read by the assistant when asked, and sent for reply
  suggestions)
- Website content (Canvas course content, grades and files)
- User activity (Inbox drafts are sent as you type, only while Suggestions in Inbox is on)

And certify all three: not sold to third parties, not used for purposes unrelated to the single purpose, not
used to determine creditworthiness or for lending.

## Reviewer notes (Distribution tab → "Test instructions" if asked)

Canvas needs a school account, so reviewers can't sign in with one of their own. Say so, point to the
screenshots and the public source on GitHub, and offer a screen recording of it running.
