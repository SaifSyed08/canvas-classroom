# Canvas Classroom

A Chrome extension that gives Canvas a Google Classroom-style layout: a slim rail of your classes, a
Home / Classwork / People bar on every course, one To-do list for everything, files that open in place,
and an AI that answers questions from your own classes. It runs on top of
[BetterCampus](https://chromewebstore.google.com/detail/cndibmoanboadcifjkjbdpjgfedanolh), so keep that
installed: BetterCampus still supplies its to-do sidebar, themes and dark mode.

![Dashboard](docs/screenshots/dashboard.jpg)

> Screenshots are from a real UT Austin account; grades and announcement text are blurred.

## Dashboard

- **A greeting that knows what's going on**: "Boo! Greetings, Saif!", "Happy Friday, Saif!",
  "Exam 2 is due today, Saif." It's picked from the time of day, weekday, season, holidays, how long you've
  been away and what's due soon, and it stays the same for the session. Pick its tone (Calm, Normal, or
  Extra with emoji) and font in settings.
- **Class cards** with the course name and instructor over the image, then the next two weeks of work
  grouped under "Missing", "Due 3 PM" (anything due within 12 hours shows its time), "Due Friday", three at a
  time, plus an email-the-instructor button. Hover an item to tick it done.
  The "+" and action icons, the streak, the progress ring, the Day/Week/Month picker, BetterCampus's
  premium Sync button and its Announcements/Completed tabs are gone.
- **To-do sidebar** restyled like Google Classroom's (overdue work keeps its red pill), cut off at two
  weeks, six items before "Show more", with Add Task, Recent Feedback and View Grades below.
- **Left rail**: Classes, To-do, then each class, with Calendar, Inbox and Account at the bottom. Hover to
  expand it, or pin it open with the menu button. Hover a class and click ⋮ to give it an icon and color.

## Course pages

The course menu becomes a top bar with **Home**, **Classwork** and **People**. Every other tool (Syllabus,
Zoom, Course Evaluations, NameCoach, Lectures Online, ...) is in **More**: click it or press `/`, type,
Enter. It also finds assignments, quizzes, pages and files across your classes: type "hw 7" and pick
"HW 7 · BIO 315H", or a file name to open it in place.

![Course home](docs/screenshots/course-home.jpg)

**Home** has the banner (name, instructor, grade), an Upcoming panel (missing work from the last two weeks
plus the next two weeks; hover an item and tick it to mark it done, with Undo), a **Pinned** panel where **+ Add** pins any course tool (Instapoll, the original
home page, ...) or any link, and the stream: announcements, plus Classroom-style posts like "Su Chen posted
a new assignment: HW 5" and "posted 3 new materials" (file chips open in place) from the last three weeks.
Past the first two, items fade and slide up as you scroll to them.

![Classwork](docs/screenshots/classwork.jpg)

**Classwork** shows modules as topics, each item with its grade, "Turned in", "Missing" or due date.
A module's text headers become collapsible subgroups, assignments outside any module are listed by group,
and the course's files sit at the bottom, grouped by folder. There's a grade chip and a filter box, and
what you open or close is remembered per class. Web links open in a new tab, and hovering one shows a
preview by the cursor (title, site and favicon, with the thumbnail for YouTube):

![Link preview](docs/screenshots/link-preview.jpg)

The original Canvas pages are still reachable from More (or add `?gcx-original=1` to a URL).

**Assignment pages** look like Classroom's: the title with a course-colored icon, instructor and date,
points and due date, the instructions and attached files on the left; on the right a **Your work** card with
the status (Assigned, Turned in, Missing, a score, Excused...), what you turned in, one button into Canvas's own
submission flow, and private comments. Canvas's submission area, rubric and Submit bar still do the actual
work; "View in Canvas" shows the stock page.

![Assignment](docs/screenshots/assignment.jpg)

## To-do

Every class's work in **Assigned / Missing / Done**, with a class filter. It opens instantly from cache and
refreshes in the background.

![To-do](docs/screenshots/todo.jpg)

## Files open in place

Clicking a course file opens it over the page instead of leaving it: PDFs render with zoom and a page
counter, slides and documents use Canvas's own viewer. Back, download, share and zoom are in the top bar;
Esc or browser Back closes it. Ctrl/Cmd-click still opens the normal page.

![File viewer](docs/screenshots/file-viewer.jpg)

## Ask anything

The **AI** button next to the greeting rolls open into a pill on hover; click and type, and it grows into a
chat. Or press **Ctrl + Space** on any regular Canvas page: the page blurs and a wide "Ask anything" pill
opens in the middle (or wherever you last left it). Drag it anywhere; once you ask, the blur clears and it
becomes the chat right where you left it. Esc or Ctrl + Space closes it, so does moving the pointer well away
from it before you've asked anything, and so does the red X once it's a chat.

On the Ctrl + Space pill, **+** attaches files (or drop / paste them in). Ask about them, or ask it to hand one
in ("turn in my-hw8.pdf for HW 8 in Genetics"): it checks the assignment takes that file type and still has
attempts left, then shows a confirm card with the assignment, due date and any late / resubmission warning.
**Nothing is turned in until you press Submit on that card.**

It answers from your Canvas (courses, assignments, grades, feedback, modules, files including PDFs, slides
and docs, announcements, quizzes, discussions, pages, the syllabus, people and the inbox) and links what it
cites. Ask it to "take me to my Genetics grades" and it opens the page. Apart from a hand-in you confirm, it
only reads and navigates; it never posts or changes anything. Quick lookups go to a smaller, cheaper model and anything that needs reading,
explaining or planning goes to the full one (settings can turn that off).

![Ask anything](docs/screenshots/ask.jpg)

## Themes and school colors

Pick a theme in settings and the rail and accents take its color: Deep blue, Forest, Plum, Crimson, Teal or
Slate. **School** uses your school's own Canvas branding instead: its color and logo on the rail, with its
wordmark above the to-do list.

![School colors](docs/screenshots/school.jpg)

## Settings

Settings are a **Classroom** tab inside BetterCampus's settings (its gear, top right of the to-do list):

- greeting on or off, tone and font
- the AI button and the Ctrl + Space shortcut, separately, and the quick model for simple questions
- the theme (Default, School, Deep blue, Forest, Plum, Crimson, Teal, Slate), and how dark class images get
  behind their white titles
- page animations, the click ripple on class cards, and announcements easing in as you scroll
- confetti when you submit something, which goes seasonal around Halloween, Thanksgiving, Christmas,
  New Year, Valentine's, St. Patrick's and the Fourth

![Settings](docs/screenshots/settings.jpg)

## Motion

Pages slide between a course's tabs (the tab underline slides with them), opening a class eases its pieces
in one by one while the course name crossfades in the top bar, sections expand and collapse smoothly, loaded
content fades in over shimmer placeholders, and switching BetterCampus between dark and light mode
crossfades. Background refreshes update in place without replaying any of it. It all turns off with
"Page animations" in settings or the OS "reduce motion" setting.

## Install

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this folder.
3. Reload any open Canvas tab.

After editing the code, hit the reload icon on the extension's card in `chrome://extensions`, then refresh
Canvas.

### OpenAI key for Ask anything

Click **Add key** in the chat (or Details → Extension options on the extension's card) and paste your key.
It's kept in the extension's storage and only the extension's background worker sends it, to
api.openai.com; it's never typed into or handed to the Canvas page. For development you can instead put it
in a git-ignored `config.local.json` next to `manifest.json`, which is used when no key is saved:

```json
{ "openaiKey": "sk-..." }
```

## Notes

- Everything runs as content scripts on `*.instructure.com` and uses Canvas's own API with your session.
  Questions you ask (and the Canvas data the assistant looks up to answer them) go to OpenAI.
- Assignments, Classwork, files and announcements are cached in the extension's storage, per Canvas site
  and per user, and dropped after 30 days without a refresh. Pages draw the cached copy at once, refresh in
  the background (Classwork and To-do show "Updating" while they do), and redraw only if something changed.
  Opening any page of a class warms its Classwork cache. Smaller things (course names, colors, rail icons,
  pinned links) live in `localStorage` under `gcx:`.
- BetterCampus's two-week range ("Custom") is a premium feature. If BetterCampus is set to Day or Week, the
  extension switches it to Month once (that setting sticks), then hides anything due more than 14 days out.
- "Missing" (red) means Canvas flagged it missing. "Past due" means the date passed with nothing handed in,
  which also covers in-class and on-paper work that hasn't been graded yet.
- Courses that hide Modules still get Classwork, served from `/courses/:id?gcx=classwork`.
- Without BetterCampus, a Settings item appears at the bottom of the rail instead of the Classroom tab.
- To turn it off, disable the extension in `chrome://extensions`. BetterCampus goes back to normal; only the
  Month setting stays.
- Fonts (Fredoka, Poppins, Playfair Display, Caveat, Space Grotesk) are bundled under the SIL Open Font
  License; see `fonts/`. PDF rendering uses Mozilla's pdf.js (Apache 2.0), bundled under `viewer/pdfjs/`.
