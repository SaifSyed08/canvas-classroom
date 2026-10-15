# Canvas Classroom

A Chrome extension that gives Canvas a Google Classroom-style layout. It runs on top of
[BetterCampus](https://chromewebstore.google.com/detail/cndibmoanboadcifjkjbdpjgfedanolh), so keep that installed:
BetterCampus still supplies the grade badges, the to-do sidebar and its theme colors.

## What it changes

- **Left rail**: Classes (dashboard), To-do, then one entry per course, with Calendar, Inbox and Account
  at the bottom. It replaces Canvas's nav and the BetterCampus sidebar. Hover to expand it; click the
  menu button to keep it open (remembered per browser). Hover a class and click ⋮ to give it an icon and
  a color in the rail.
- **Course pages**: the course menu becomes a top bar with **Home**, **Classwork** and **People**.
  Every other tool (Syllabus, Zoom, Course Evaluations, NameCoach, Lectures Online, ...) is in the
  **More** panel: click it or press `/`, type to search, Enter to open.
  - **Home** (`/courses/:id`): banner with the course name, instructor and grade; an Upcoming panel
    (missing + next two weeks); a **Pinned** panel under it where **+ Add** pins any course tool
    (Instapoll, the original home page, ...) or any link, saved per course; the announcements stream.
  - **Classwork** (`/courses/:id/modules`): modules as topics, each item showing its grade, "Turned in",
    "Missing" or due date. A module's text headers become collapsible subgroups. Assignments that aren't
    in any module are listed by assignment group, and the course's files are at the bottom, grouped
    by folder. Includes a grade chip and a filter box. Open/closed state is remembered per course.
  - The original Canvas pages are still reachable from the More panel (or add `?gcx-original=1`).
- **To-do** (`/?gcx=todo`): all courses' work in Assigned / Missing / Done tabs with a class filter.
- **Dashboard**: a "Welcome back"-style greeting that changes with the time of day, weekday, season,
  holidays, how long you've been away and what's due soon, plus a one-line summary of the week.
  Next to it, the ✦ button asks questions about your classes (see below).
  Cards show the course name and instructor over the image; below that, work for the next two weeks is
  grouped under labels like "Missing", "Due Today" and "Due Friday", three at a time. Each card has an
  email-the-instructor button. The card "+" and action icons, the "Dashboard" header menu, the streak,
  the progress ring, the Day/Week/Month picker, the premium Sync button, the Announcements and Completed
  tabs and the footer links are gone. The BetterCampus to-do list is cut off at two weeks and shows six
  items before "Show more"; Add Task, Recent Feedback and View Grades stay below it.
- **Ask anything** (✦ next to the greeting): hover it and it opens into a pill; click and type. It answers
  from your Canvas: courses, assignments, grades, feedback, modules, files (it can read PDFs, slides and
  docs), announcements, quizzes, discussions, pages, the syllabus, people and the inbox. It's read-only.
  The chat stays open while the pointer is near it and tucks away when you move off.
- **Files**: clicking a course file opens it over the page (PDFs with zoom and page count; slides and
  documents in Canvas's viewer) instead of leaving the page. Back, download, share and zoom are in the
  top bar; Esc or browser Back closes it. Ctrl/Cmd-click still opens the normal page.
- **Motion**: pages slide left/right between course tabs, opening a class zooms in, lists stagger in,
  sections expand and collapse smoothly, loaded content fades in over shimmer placeholders, and switching
  BetterCampus between dark and light mode crossfades. All of it turns off with the OS "reduce motion"
  setting.

## Install

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this folder.
3. Reload any open Canvas tab.

After editing the code, hit the reload icon on the extension's card in `chrome://extensions`, then refresh Canvas.

### OpenAI key for Ask anything

The background worker reads `config.local.json` (git-ignored) from this folder:

```json
{ "openaiKey": "sk-..." }
```

Without it, the pill shows an **Add key** button that opens the extension's settings page (also under
Details → Extension options), where the key is saved in the extension's storage. Either way the key is
only read by the extension's background worker; it is never typed into or handed to the Canvas page.

## Notes

- Everything else runs as content scripts on `*.instructure.com` and uses Canvas's own API with your
  session. Questions you ask (and the Canvas data the assistant looks up to answer them) go to OpenAI.
- Assignments, Classwork, files and announcements are cached in the extension's storage, per Canvas site
  and per user, and dropped after 30 days without a refresh. Pages draw the cached copy at once, refresh
  in the background (Classwork and To-do show "Updating" while they do), and redraw only if something
  changed. Opening any page of a class warms its Classwork cache. Smaller things (course names, colors, rail icons, pinned
  links) live in `localStorage` under `gcx:`.
- BetterCampus's two-week range ("Custom") is a premium feature. If BetterCampus is set to Day or Week,
  the extension switches it to Month once (that setting sticks), then hides anything due more than 14 days out.
- "Missing" (red) means Canvas flagged it missing. "Past due" means the date passed with nothing handed in,
  which also covers in-class and on-paper work that hasn't been graded yet.
- Courses that hide Modules still get Classwork, served from `/courses/:id?gcx=classwork`.
- To turn it off, disable the extension in `chrome://extensions`. The rest of BetterCampus goes back to
  normal; only the Month setting stays.
