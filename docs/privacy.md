# Privacy policy

Canvas Classroom is a browser extension that changes how Canvas looks and adds an AI assistant and a pet.
This page says what it reads, where that goes, and what it keeps. Last updated October 28, 2026.

## The short version

- There is no Canvas Classroom server. The developer never receives your data, and there is no analytics,
  tracking or advertising.
- The extension reads your Canvas through your own signed-in session, and keeps what it reads in your
  browser.
- The AI features send data to OpenAI using **your own** OpenAI key. Without a key, nothing goes to OpenAI.

## What it reads

On Canvas pages (`*.instructure.com`) it uses Canvas's own API, as you, to show your courses, assignments,
grades, announcements, modules, files, people and inbox in its own layout. The only changes it makes in
Canvas are ones you make yourself through its buttons: turning in an assignment or adding a private comment
from the Your work card, sent through Canvas's API just as Canvas's own page would. The AI assistant never
submits, posts or messages anything; when it reads a course file for you, Canvas records that you viewed it,
as it would if you opened it yourself.

## What leaves your browser, and when

| Where | What | When |
| --- | --- | --- |
| Your school's Canvas | Ordinary Canvas API requests with your session | While you use Canvas |
| Canvas's file storage (Instructure's file proxy, Amazon S3) | File downloads, and files you turn in | When you open a course file, the assistant reads one, or you upload a submission |
| OpenAI (api.openai.com) | Your question and the conversation so far; your name, your school's Canvas address, your time zone, and your current courses with their instructors and your current grade in each; and whatever the assistant looks up to answer (which can include course content, grades, feedback, files, Inbox messages, and course rosters with the names and emails of instructors and classmates) | When you ask the AI something |
| OpenAI | The Inbox conversation you're replying to, the compose window's text (course, recipients, subject), your name, and your draft | As soon as you open a reply (or after the first couple of words of a new message) in Canvas's Inbox, and again as you type, while "Suggestions in Inbox" is on (it's on by default once a key is set) |
| OpenAI | The class name and your description of the cover | When you generate an AI class cover |
| codex-pets.net | Library page and search requests, the small preview images of the pets shown, and the pet you pick | When you browse or pick a pet |
| Google's favicon service and YouTube's image server | The address of a web link in a course | When you hover that link to preview it |

Images from codex-pets.net, Google and YouTube load directly in the Canvas page, so those sites can also see
your school's Canvas address (as the page they were loaded from).

OpenAI's handling of these requests is covered by [OpenAI's policies](https://openai.com/policies) and your
own OpenAI account's settings. Assistant conversations are kept by OpenAI so follow-up questions can
continue them; Inbox suggestions are sent with storage turned off. Without a key nothing is sent to OpenAI.
With one, the assistant and covers send only when you ask them something; turn off "Suggestions in Inbox" in
settings to stop the Inbox ones.

## What it keeps

All of it stays in your browser:

- in the extension's storage, copies of Canvas data (assignments, Classwork, files, announcements) so pages
  open instantly, kept per Canvas site and per user, and dropped after 30 days without a refresh
- in Canvas's `localStorage`, smaller copies for the first paint (your course list with current grades, your
  profile, the dashboard cards); these don't expire, and are replaced when a different user signs in
- in the tab's `sessionStorage`, that tab's open chat and copies of recently seen pages, gone when the tab
  closes
- your settings, class icons and colors, covers, pinned links and shortcuts
- your recent AI chat (the latest 40 messages, per Canvas site and user) so Ctrl + Shift + Space can bring it
  back
- your OpenAI key, if you added one; it is only ever sent to api.openai.com, by the extension's
  background worker, and never given to Canvas's own page scripts
- pets you picked or imported

It also changes two of BetterCampus's settings in your browser: its to-do range is switched to Month once (so
the two-week list works), and its saved theme colors are kept in step with dark and light mode.

Removing the extension deletes its storage. Its `localStorage` entries on Canvas (named `gcx:...`) are
cleared with Canvas's site data.

## Sharing

The developer does not collect, sell or share your data. Data goes only to the services listed above, for
the features listed above.

## Contact

Questions: open an issue at https://github.com/SaifSyed08/canvas-classroom/issues.
