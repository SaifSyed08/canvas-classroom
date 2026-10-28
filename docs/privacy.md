# Privacy policy

Canvas Classroom is a browser extension that changes how Canvas looks and adds an AI assistant and a pet.
This page says what it reads, where that goes, and what it keeps. Last updated October 28, 2026.

## The short version

- There is no Canvas Classroom server. The developer never receives your data, and there is no analytics,
  tracking or advertising.
- The extension reads your Canvas through your own signed-in session, and keeps what it reads in your
  browser.
- The AI features send data to OpenAI using **your own** OpenAI key, and only when you use them.

## What it reads

On Canvas pages (`*.instructure.com`) it uses Canvas's own API, as you, to show your courses, assignments,
grades, announcements, modules, files, people and inbox in its own layout. The only changes it makes in
Canvas are ones you make yourself through its buttons: turning in an assignment or adding a private comment
from the Your work card, sent through Canvas's API just as Canvas's own page would. The AI assistant only
reads.

## What leaves your browser, and when

| Where | What | When |
| --- | --- | --- |
| Your school's Canvas | Ordinary Canvas API requests with your session | While you use Canvas |
| OpenAI (api.openai.com) | Your question and the Canvas data the assistant looks up to answer it (which can include course content, grades, feedback, files and messages) | When you ask the AI something |
| OpenAI | The Inbox conversation you're replying to and your draft | While you write a message in Canvas's Inbox, if "Suggestions in Inbox" is on |
| OpenAI | The class name and your description of the cover | When you generate an AI class cover |
| codex-pets.net | Library page and search requests, and the pet images you pick | When you browse or pick a pet |
| Google's favicon service and YouTube's image server | The address of a web link in a course | When you hover that link to preview it |

OpenAI's handling of these requests is covered by [OpenAI's policies](https://openai.com/policies) and your
own OpenAI account's settings. Without a key nothing is sent to OpenAI. With one, the assistant and covers
send only when you ask them something, and Inbox suggestions send while you write a message (turn off
"Suggestions in Inbox" in settings to stop that).

## What it keeps

All of it stays in your browser, in the extension's storage and in Canvas's `localStorage`:

- copies of Canvas data (courses, assignments, Classwork, files, announcements) so pages open instantly,
  kept per Canvas site and per user, and dropped after 30 days without a refresh
- your settings, class icons and colors, covers, pinned links and shortcuts
- your OpenAI key, if you added one; it is only ever sent to api.openai.com, by the extension's
  background worker, and never shown to the Canvas page
- pets you picked or imported

Removing the extension deletes its storage. Its `localStorage` entries on Canvas (named `gcx:...`) are
cleared with Canvas's site data.

## Sharing

The developer does not collect, sell or share your data. Data goes only to the services listed above, for
the features listed above.

## Contact

Questions: open an issue at https://github.com/SaifSyed08/canvas-classroom/issues.
