# Canvas Classroom

A Chrome extension that gives Canvas a Google Classroom-style layout. It runs on top of
[BetterCampus](https://chromewebstore.google.com/detail/cndibmoanboadcifjkjbdpjgfedanolh), so keep that installed:
BetterCampus still supplies the grade badges, the to-do sidebar and its theme colors.

## What it changes

- **Left rail**: Classes (dashboard), To-do, then one entry per course, with Calendar, Inbox and Account
  at the bottom. It replaces Canvas's nav and the BetterCampus sidebar. Hover to expand it; click the
  menu button to keep it open (remembered per browser).
- **Course pages**: the course menu becomes a top bar with **Home**, **Classwork** and **People**.
  Every other tool (Syllabus, Zoom, Course Evaluations, NameCoach, Lectures Online, ...) is in the
  **More** panel: click it or press `/`, type to search, Enter to open.
  - **Home** (`/courses/:id`): banner with the course name, instructor and grade; an Upcoming panel
    (missing + next two weeks); the announcements stream.
  - **Classwork** (`/courses/:id/modules`): modules as topics, each item showing its grade, "Turned in",
    "Missing" or due date. Assignments that aren't in any module are listed by assignment group, and
    the course's files can be opened at the bottom. Includes a grade chip and a filter box.
  - The original Canvas pages are still reachable from the More panel (or add `?gcx-original=1`).
- **To-do** (`/?gcx=todo`): all courses' work in Assigned / Missing / Done tabs with a class filter.
- **Dashboard**: bigger cards with the course name, code and instructor over the image. Below that,
  work for the next two weeks is grouped under labels like "Missing", "Due Today" and "Due Friday".
  Each card has an email-the-instructor button. The card "+" and action icons, the "Dashboard" header
  menu, the streak, the progress ring, the Day/Week/Month picker and the footer links are gone.
  The BetterCampus to-do list is cut off at two weeks.

## Install

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this folder.
3. Reload any open Canvas tab.

After editing the code, hit the reload icon on the extension's card in `chrome://extensions`, then refresh Canvas.

## Notes

- Everything runs as content scripts on `*.instructure.com` and uses Canvas's own API with your session.
  Nothing is sent anywhere else. Course names, colors and teachers are cached in `localStorage` under `gcx:`.
- BetterCampus's two-week range ("Custom") is a premium feature, so the extension leaves BetterCampus on
  "Month" and hides anything due more than 14 days out.
- To turn it off, disable the extension in `chrome://extensions`. BetterCampus goes back to normal.
