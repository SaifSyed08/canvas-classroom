// Even Better Canvas: Google Classroom-style layout on top of Canvas + BetterCampus.
//   - left rail (Classes, To-do, each course) that expands on hover and can be pinned
//   - course pages get a top tab bar (Home, Classwork, People) plus a searchable panel of every other tool
//   - Home / Classwork / To-do are rebuilt from the Canvas API (see early.js for which URLs)
//   - dashboard cards and the BetterCampus to-do sidebar are trimmed down
(() => {
  'use strict';
  if (window.top !== window) return;
  const html = document.documentElement;
  if (!html.classList.contains('gcx')) return;

  // Login pages and borderless LTI tools have no global nav; leave them alone.
  if (!document.getElementById('header') || !document.getElementById('wrapper')) {
    html.classList.remove('gcx', 'gcx-pinned', 'gcx-course', 'gcx-dash', 'gcx-takeover', 'gcx-dash-wait', 'gcx-topic');
    document.querySelectorAll('#gcx-theme-early, [data-early]').forEach((n) => n.remove());
    return;
  }

  const VIEW = html.dataset.gcxView || '';
  // Content that's ready this soon (from the saved copy) just appears; only what had to wait on
  // Canvas fades in. Animating cached content made pages look like they were loading twice.
  const T0 = performance.now();
  const waited = () => performance.now() - T0 > 400;
  const COURSE_ID = html.dataset.gcxCourse ? Number(html.dataset.gcxCourse) : null;
  const DAY = 864e5;
  const HORIZON_DAYS = 14;

  // ---------------------------------------------------------------- helpers
  const ICONS = {
    image: 'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z',
    upload: 'M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z',
    menu: 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',
    home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
    todo: 'M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-2 14l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z',
    calendar: 'M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z',
    inbox: 'M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z',
    mail: 'M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8l8 5 8-5v10zm-8-7L4 6h16l-8 5z',
    search: 'M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
    assignment: 'M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z',
    quiz: 'M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z',
    discussion: 'M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z',
    file: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
    page: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z',
    link: 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z',
    tool: 'M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z',
    bell: 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
    check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
    chat: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z',
    grade: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z',
    announce: 'M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61zM20.4 5.6c-.4-.53-.8-1.07-1.2-1.6-.99.74-2.24 1.68-3.2 2.4.4.53.8 1.07 1.2 1.6.96-.72 2.21-1.65 3.2-2.4zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1v4h2v-4h1l5 3V6L8 9H4zm11.5 3c0-1.33-.58-2.53-1.5-3.35v6.69c.92-.81 1.5-2.01 1.5-3.34z',
    people: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
    lock: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
    chevron: 'M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z',
    list: 'M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z',
    gear: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
    sync: 'M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z',
    hide: 'M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.8 11.8 0 0 0 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78 3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z',
    show: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
    more: 'M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
    add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
    close: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
    folder: 'M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z',
    open: 'M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z',
    play: 'M8 5v14l11-7z',
    // course icons for the rail picker
    science: 'M19.8 18.4L14 10.67V6.5l1.35-1.69c.26-.33.03-.81-.39-.81H9.04c-.42 0-.65.48-.39.81L10 6.5v4.17L4.2 18.4c-.49.66-.02 1.6.8 1.6h14c.82 0 1.29-.94.8-1.6z',
    biotech: 'M7 19c-1.1 0-2 .9-2 2h14c0-1.1-.9-2-2-2h-4v-2h3c1.1 0 2-.9 2-2h-8c-1.66 0-3-1.34-3-3 0-1.09.59-2.04 1.46-2.56C8.17 9.03 8 8.54 8 8c0-.21.04-.42.09-.62A5.01 5.01 0 0 0 5 12c0 2.76 2.24 5 5 5v2H7zm3.56-12.18C11.15 6.55 11 6.15 11 5.7V4.7c0-.39-.31-.7-.7-.7h-.6c-.39 0-.7.31-.7.7v1c0 .45-.15.85-.44 1.12C8.23 7.13 8 7.55 8 8c0 .86.7 1.56 1.56 1.56.43 0 .82-.17 1.1-.45.28-.28.44-.67.44-1.11 0-.45-.23-.87-.54-1.18zM14.3 4.7l1.4-1.4 2.1 2.1-1.4 1.4zm-1.4 1.4l2.1 2.1-3.9 3.9-2.1-2.1z',
    code: 'M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z',
    calc: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5.97 4.06L14.09 6l1.41 1.41L16.91 6l1.06 1.06-1.41 1.41 1.41 1.41-1.06 1.06-1.41-1.4-1.41 1.41-1.06-1.06 1.41-1.41-1.41-1.42zM6.25 7.72h5v1.5h-5v-1.5zM11.5 16h-2v2H8v-2H6v-1.5h2v-2h1.5v2h2V16zm6.5 1.25h-5v-1.5h5v1.5zm0-2.5h-5v-1.5h5v1.5z',
    book: 'M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z',
    pen: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
    palette: 'M12 3a9 9 0 0 0 0 18c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
    music: 'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z',
    globe: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z',
    chart: 'M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z',
    psych: 'M13 8.57a1.43 1.43 0 1 0 0 2.86 1.43 1.43 0 0 0 0-2.86zM13 3C9.25 3 6.2 5.94 6.02 9.64L4.1 12.2a.5.5 0 0 0 .4.8H6v3c0 1.1.9 2 2 2h1v3h7v-4.68A6.999 6.999 0 0 0 13 3zm3 7c0 .13-.01.26-.02.39l.83.66c.08.06.1.16.05.25l-.8 1.39c-.05.09-.16.12-.24.09l-.99-.4c-.21.16-.43.29-.67.39L14 13.83c-.01.1-.1.17-.2.17h-1.6c-.1 0-.18-.07-.2-.17l-.15-1.06c-.25-.1-.47-.23-.68-.39l-.99.4c-.09.03-.2 0-.25-.09l-.8-1.39a.192.192 0 0 1 .05-.25l.84-.66c-.01-.13-.02-.26-.02-.39s.02-.27.04-.39l-.85-.66a.192.192 0 0 1-.05-.25l.8-1.38c.05-.09.15-.12.24-.09l1 .4c.2-.15.43-.29.67-.39L12 6.17c.02-.1.1-.17.2-.17h1.6c.1 0 .18.07.2.17l.15 1.06c.24.1.46.23.67.39l1-.4c.09-.03.2 0 .24.09l.8 1.38c.05.09.03.2-.05.25l-.85.66c.03.12.04.25.04.39z',
    star: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
    heart: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
    sport: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 3.3l1.35-.95a8.01 8.01 0 0 1 4.38 3.34l-.39 1.34-1.35.46L13 6.7V5.3zm-3.35-.95L11 5.3v1.4L7.01 9.49l-1.35-.46-.39-1.34a8.103 8.103 0 0 1 4.38-3.34zM7.08 17.11l-1.14.1A7.938 7.938 0 0 1 4 12c0-.12.01-.23.02-.35l1-.73 1.38.48 1.46 4.34-.78 1.37zm7.42 2.48c-.79.26-1.63.41-2.5.41s-1.71-.15-2.5-.41l-.69-1.49.64-1.1h5.11l.64 1.11-.7 1.48zM14.27 15H9.73l-1.35-4.02L12 8.44l3.63 2.54L14.27 15zm3.79 2.21l-1.14-.1-.79-1.37 1.46-4.34 1.39-.47 1 .73c.01.11.02.22.02.34 0 1.99-.73 3.81-1.94 5.21z',
    bolt: 'M11 21h-1l1-7H7.5c-.88 0-.33-.75-.31-.78C8.48 10.94 10.42 7.54 13.01 3h1l-1 7h3.51c.4 0 .62.19.4.66C12.97 17.55 11 21 11 21z',
    leaf: 'M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z',
    school: 'M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z',
  };
  const svg = (name, size = 24) =>
    `<svg class="gcx-svg" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const el = (markup) => {
    const t = document.createElement('template');
    t.innerHTML = markup.trim();
    return t.content.firstElementChild;
  };
  const debounce = (fn, ms) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };
  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem('gcx:' + k);
        return v == null ? d : JSON.parse(v);
      } catch {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem('gcx:' + k, JSON.stringify(v));
      } catch {}
    },
  };
  // Files show their type as a small colored tile (PDF in white on red, like Drive) instead of a
  // plain page icon. Anything unrecognized keeps the page icon.
  const FILE_TYPES = [
    [/^pdf$/, 'pdf', 'PDF'],
    [/^(docx?|odt|rtf|pages)$/, 'doc', 'DOC'],
    [/^(pptx?|key|odp)$/, 'ppt', 'PPT'],
    [/^(xlsx?|csv|ods|numbers)$/, 'xls', 'XLS'],
    [/^(png|jpe?g|gif|webp|heic|svg|bmp)$/, 'img', 'IMG'],
    [/^(zip|rar|7z|tar|gz)$/, 'zip', 'ZIP'],
    [/^(mp4|mov|webm|m4v|avi|mkv)$/, 'vid', 'VID'],
    [/^(mp3|wav|m4a|aac|flac)$/, 'aud', 'AUD'],
    [/^(txt|md|py|java|c|cpp|h|js|ts|r|rmd|qmd|ipynb|html|json|tex|sql|m)$/, 'txt', ''],
  ];
  const fileTile = (name, size = 20) => {
    const ext = ((String(name || '').match(/\.([a-z0-9]{1,8})\s*$/i) || [])[1] || '').toLowerCase();
    const t = ext && FILE_TYPES.find(([re]) => re.test(ext));
    if (!t) return svg('file', size);
    return `<span class="gcx-ftype gcx-ft-${t[1]}" style="--s:${size}px" aria-hidden="true">${t[2] || ext.toUpperCase().slice(0, 4)}</span>`;
  };

  // Canvas REST call with the page's own session. all=true follows Link: rel="next".
  async function api(path, all = false) {
    let url = path.startsWith('http') ? path : location.origin + '/api/v1' + path;
    const out = [];
    for (let page = 0; url; page++) {
      if (page === 30) {
        console.warn('[canvas-classroom] stopped after 30 pages of', path);
        break;
      }
      const r = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      if (!r.ok) throw Object.assign(new Error(`${r.status} ${path}`), { status: r.status });
      const data = JSON.parse((await r.text()).replace(/^while\(1\);/, ''));
      if (!all) return data;
      out.push(...data);
      const next = (r.headers.get('Link') || '').split(',').find((l) => l.includes('rel="next"'));
      url = next ? next.slice(next.indexOf('<') + 1, next.indexOf('>')) : null;
    }
    return out;
  }

  // Bigger caches (assignments, classwork) go in extension storage: it isn't shared with
  // Canvas's own localStorage and has no 5 MB cap. Falls back to localStorage.
  // Extension storage is shared by every Canvas site, so keys carry the site and the user.
  const CACHE_VERSION = 1;
  const CACHE_DAYS = 30;
  // Canvas writes the signed-in user's id into an inline ENV script, so the key always matches
  // whoever is logged in now (not whoever was last seen in localStorage).
  const PAGE_USER = (() => {
    for (const sc of document.scripts) {
      const m = !sc.src && sc.textContent.match(/"current_user_id":"(\d+)"/);
      if (m) return m[1];
    }
    return null;
  })();
  // Same script has his display name, so the greeting knows it on the very first load.
  const PAGE_NAME = (() => {
    for (const sc of document.scripts) {
      if (sc.src) continue;
      const i = sc.textContent.indexOf('"current_user":{');
      if (i < 0) continue;
      const m = sc.textContent.slice(i, i + 800).match(/"display_name":"([^"\\]*)"/);
      if (m) return m[1];
    }
    return '';
  })();
  const cacheKey = (k) => `c:${location.origin}|${PAGE_USER || 'anon'}|${k}`;
  const cache = {
    // { d: data, t: saved at } or null
    async entry(k) {
      try {
        const r = await chrome.storage.local.get(cacheKey(k));
        const v = r[cacheKey(k)];
        return v && v.v === CACHE_VERSION && Date.now() - v.t < CACHE_DAYS * 864e5 ? v : null;
      } catch {
        return null; // extension reloaded underneath this page; just fetch fresh
      }
    },
    async get(k) {
      const e = await cache.entry(k);
      return e ? e.d : null;
    },
    set(k, d) {
      try {
        chrome.storage.local.set({ [cacheKey(k)]: { v: CACHE_VERSION, t: Date.now(), d } }).catch(() => {});
      } catch {}
    },
    // Drop entries nobody has refreshed in a month (old classes, other accounts).
    async sweep() {
      if (Date.now() - store.get('cacheSwept', 0) < 864e5) return;
      store.set('cacheSwept', Date.now());
      try {
        const all = await chrome.storage.local.get(null);
        const old = Object.keys(all).filter((k) => k.startsWith('c:') && (!all[k] || all[k].v !== CACHE_VERSION || Date.now() - all[k].t > CACHE_DAYS * 864e5));
        if (old.length) await chrome.storage.local.remove(old);
      } catch {}
    },
  };
  // When each key was last fetched fresh (cache entries only get rewritten when the data changes).
  const FETCHED = 'fetched:' + (PAGE_USER || 'anon');
  const fetchedAt = (key) => store.get(FETCHED, {})[key] || 0;
  const markFetched = (key, t = Date.now()) => {
    const all = store.get(FETCHED, {});
    all[key] = t;
    for (const k in all) if (Date.now() - all[k] > 864e5) delete all[k];
    store.set(FETCHED, all);
  };
  // For background refreshes: a failed request should fail the refresh (keeping the saved copy),
  // not quietly save an empty list over it. "Not allowed" / "not found" are real answers, though.
  // On a page, a failed request falls back to an empty part so the rest still draws; `tally`
  // counts those, and swr then keeps the saved copy instead of saving the gap over it.
  const softFail = (strict, fallback, tally) => (e) => {
    // Background refreshes keep only 404 as an answer: 401 is also what a signed-out session gets.
    if (strict && !(e && e.status === 404)) throw e;
    if (tally && !(e && (e.status === 401 || e.status === 404))) tally.fails++;
    return fallback;
  };
  // Signed file and image links get new tokens on every fetch. Compare without them, so data
  // that only differs there isn't re-saved every time.
  const sansTokens = (s) => s.replace(/([?&](?:verifier|sf_verifier|Expires|Signature|Key-Pair-Id|X-Amz-[A-Za-z]+|token)=)[^&"\\]*/g, '$1');
  // Keys a background fetch has claimed and not finished. If the page goes away first, the claims
  // are dropped so the next page fetches them.
  const claimed = new Set();
  const claim = (key) => {
    claimed.add(key);
    markFetched(key);
  };
  const release = (key, ok) => {
    claimed.delete(key);
    if (!ok) markFetched(key, 0);
  };
  let warmStamp = 0; // set while this page's warm pass runs
  addEventListener('pagehide', () => {
    for (const k of claimed) markFetched(k, 0);
    if (warmStamp && store.get('warmedAt', 0) === warmStamp) store.set('warmedAt', 0);
  });
  addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    for (const k of claimed) markFetched(k);
    if (warmStamp) store.set('warmedAt', (warmStamp = Date.now()));
  });
  // Stale-while-revalidate: draw the cached copy at once, fetch, redraw only if it changed.
  // onData(data, fromCache). Throws only when there was no cached copy to fall back on.
  async function swr(key, fetcher, onData, revive = (x) => x) {
    const ent = await cache.entry(key);
    const cached = ent ? ent.d : null;
    let shown = null;
    if (cached != null) {
      shown = JSON.stringify(cached);
      onData(revive(cached), true);
    }
    let fresh;
    const tally = { fails: 0 };
    try {
      fresh = JSON.parse(JSON.stringify(await fetcher(tally)));
    } catch (e) {
      if (shown == null) throw e;
      console.warn('[canvas-classroom] refresh failed, showing saved copy', key, e);
      return null;
    }
    // Part of it failed: keep the saved copy. With none saved, show what came back but don't keep it.
    if (tally.fails) {
      if (shown != null) {
        console.warn('[canvas-classroom] refresh partly failed, showing saved copy', key);
        return null;
      }
      onData(revive(fresh), false);
      return fresh;
    }
    markFetched(key);
    const now = JSON.stringify(fresh);
    // Write only when something changed (or the copy is a day old, so the sweep keeps it).
    if (shown == null || sansTokens(now) !== sansTokens(shown) || Date.now() - ent.t > 864e5) cache.set(key, fresh);
    if (now !== shown) onData(revive(fresh), false);
    return fresh;
  }
  const reviveItems = (list) => list.map((i) => ({ ...i, due: i.due ? new Date(i.due) : null }));

  // ---------------------------------------------------------------- dates
  const startOfDay = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const dayDiff = (d) => Math.round((startOfDay(d) - startOfDay(new Date())) / DAY);
  const shortDate = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const timeOf = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  // "Today", "Tomorrow", "Wednesday", "Nov 13"
  function dayName(d) {
    const n = dayDiff(d);
    if (n === 0) return 'Today';
    if (n === 1) return 'Tomorrow';
    if (n === -1) return 'Yesterday';
    if (n > 1 && n < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
    return shortDate(d);
  }
  // "3 PM" rather than "3:00 PM"
  const shortTime = (d) => timeOf(d).replace(/:00(?=\s|$)/, '');
  // Due later today and within 12 hours: say the time. Otherwise the day.
  const soonToday = (d) => dayDiff(d) === 0 && d - Date.now() > 0 && d - Date.now() < 12 * 36e5;
  const dueWhen = (d) => (soonToday(d) ? shortTime(d) : dayName(d));
  const dueText = (d) => {
    const n = dayDiff(d);
    if (soonToday(d)) return `Due ${shortTime(d)}`;
    return `Due ${dayName(d)}${n >= 0 && n <= 1 ? ', ' + timeOf(d) : ''}`;
  };
  // "Today, 3:30 PM" / "Yesterday, 9 AM" / "Oct 23, 4 PM"
  const postedWhen = (d, withTime = true) => {
    const n = dayDiff(d);
    const day = n === 0 ? 'Today' : n === -1 ? 'Yesterday' : shortDate(d);
    return withTime || n >= -1 ? `${day}, ${shortTime(d)}` : day;
  };
  // Sunday-start weeks, like Canvas's calendar in the US.
  const weekStart = (offsetWeeks = 0) => {
    const d = startOfDay(new Date());
    d.setDate(d.getDate() - d.getDay() + 7 * offsetWeeks);
    return d;
  };

  // ---------------------------------------------------------------- courses
  const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with', 'vs']);
  const KEEP_UPPER = /^(?:[IVX]+|AP|UT|US|AI|STEM|SDS|FRI|NSC|UGS|CS|ECE|IB)$/;
  // "Fa26 - ADV INTRO TO GENETICS: HONORS (51880-51935)" -> "Adv Intro to Genetics: Honors"
  function prettyName(c) {
    if (!c) return '';
    let n = String(c.name || c.code || '').trim();
    if (c.nick) return n;
    n = n.replace(/^(?:Fa|Sp|Su|Fall|Spring|Summer)\s?\d{2,4}\s*[-–:]\s*/i, '').replace(/\s*\([\d\s,–-]+\)\s*$/, '').trim();
    if (n && n === n.toUpperCase() && /\p{Lu}{3}/u.test(n)) {
      n = n
        .split(' ')
        .map((word, wi) =>
          word.replace(/\p{L}+/gu, (seg, at) => {
            if (KEEP_UPPER.test(seg)) return seg;
            const lower = seg.toLowerCase();
            if (wi > 0 && at === 0 && SMALL_WORDS.has(lower)) return lower;
            // The "s" in WOMEN'S stays lowercase.
            if (at > 0 && /['’]/.test(word[at - 1])) return lower;
            return lower[0].toUpperCase() + lower.slice(1);
          }),
        )
        .join(' ');
    }
    return n || c.code || '';
  }
  const firstChar = (str) => [...String(str || '').trim()][0] || '?';
  const initial = (c) => firstChar(c.code || c.name).toUpperCase();
  const teacherLine = (c) => {
    const t = (c && c.teachers) || [];
    if (!t.length) return '';
    return t.length === 1 ? t[0].name : t.length === 2 ? `${t[0].name} & ${t[1].name}` : `${t[0].name} + ${t.length - 1} more`;
  };
  // One teacher: compose to them. Several (TAs listed as teachers): compose in the course and let him pick.
  const emailHref = (c) => {
    const t = c.teachers || [];
    if (t.length > 0 && t.length <= 2) return `/conversations?user_id=${t[0].id}&user_name=${encodeURIComponent(t[0].name)}&context_id=course_${c.id}`;
    return `/conversations?context_id=course_${c.id}`;
  };

  // The course shape everything else uses; `f` is Canvas's course object (teachers, scores).
  function toCourse(f, base) {
    const enr = (f.enrollments || []).find((e) => e.type === 'student') || {};
    return {
      name: '',
      nick: false,
      code: '',
      term: '',
      ...base,
      image: base.image || '',
      color: base.color || '#1a73e8',
      teachers: (f.teachers || []).map((t) => ({ id: t.id, name: t.display_name })),
      score: enr.computed_current_score ?? null,
      letter: enr.computed_current_grade ?? null,
    };
  }
  async function fetchCourses() {
    const [cards, colors, full] = await Promise.all([
      api('/dashboard/dashboard_cards'),
      api('/users/self/colors').catch(() => ({})),
      api('/courses?enrollment_state=active&include[]=teachers&include[]=total_scores&per_page=100', true).catch(() => []),
    ]);
    const custom = colors.custom_colors || {};
    const byId = new Map(full.map((c) => [c.id, c]));
    return cards.map((d) =>
      toCourse(byId.get(d.id) || {}, {
        id: d.id,
        name: d.shortName,
        nick: !!d.originalName && d.shortName !== d.originalName,
        code: d.courseCode,
        term: d.term,
        image: d.image,
        color: custom[d.assetString] || d.color,
      }),
    );
  }

  // localStorage is per site, not per person; forget the last account's courses and name.
  if (PAGE_USER && (store.get('me', null) || {}).id && String(store.get('me', null).id) !== PAGE_USER) {
    store.set('courses', null);
    store.set('me', null);
    store.set('coursesAt', 0);
    store.set('unread', 0);
    store.set('unreadAt', 0);
  }
  let COURSES = store.get('courses', null);
  const COURSES_TTL = 10 * 6e4;
  const coursesFresh = COURSES && Date.now() - store.get('coursesAt', 0) < COURSES_TTL && !html.classList.contains('gcx-dash');
  const coursesReady = (coursesFresh ? Promise.resolve(COURSES) : fetchCourses())
    .then((c) => {
      if (c !== COURSES) {
        COURSES = c;
        store.set('courses', c);
        store.set('coursesAt', Date.now());
      }
      return c;
    })
    .catch((e) => {
      console.warn('[canvas-classroom] courses', e);
      return COURSES || [];
    });

  // Courses that aren't on the dashboard (unfavorited, past terms) still need a name and color.
  async function courseById(id) {
    const list = await coursesReady;
    const hit = list.find((c) => c.id === id);
    if (hit) return hit;
    // Use the saved copy right away and refresh it for next time.
    const key = `course:${PAGE_USER || 'anon'}:${id}`;
    const saved = store.get(key, null);
    const fresh = fetchCourseById(id).then((c) => {
      if (c.name) store.set(key, c);
      return c;
    });
    return saved || fresh;
  }
  async function fetchCourseById(id) {
    try {
      const [f, colors] = await Promise.all([
        api(`/courses/${id}?include[]=teachers&include[]=total_scores&include[]=term&include[]=course_image`),
        api('/users/self/colors').catch(() => ({})),
      ]);
      return toCourse(f, {
        id,
        name: f.name,
        code: f.course_code,
        term: f.term ? f.term.name : '',
        image: f.image_download_url,
        color: (colors.custom_colors || {})['course_' + id],
      });
    } catch {
      return toCourse({}, { id });
    }
  }

  // ---------------------------------------------------------------- planner (assignments across courses)
  const WORK_TYPES = new Set(['assignment', 'quiz', 'discussion_topic', 'sub_assignment', 'wiki_page', 'planner_note']);
  const TYPE_ICON = { assignment: 'assignment', sub_assignment: 'assignment', quiz: 'quiz', discussion_topic: 'discussion', wiki_page: 'page', planner_note: 'todo' };

  function normPlanner(it) {
    const due = it.plannable_date ? new Date(it.plannable_date) : null;
    const s = it.submissions;
    const past = due && due < new Date();
    const done = !!(
      (it.planner_override && it.planner_override.marked_complete) ||
      (s && (s.submitted || s.excused || s.graded)) ||
      (s === false && past)
    );
    return {
      key: `${it.plannable_type}:${it.plannable_id}`,
      type: it.plannable_type,
      title: (it.plannable && (it.plannable.title || it.plannable.name)) || 'Untitled',
      due,
      // Planner notes point at the JSON API; send them to the calendar instead.
      url: it.plannable_type === 'planner_note' ? '/calendar' : it.html_url || '#',
      courseId: it.course_id || null,
      courseName: it.context_name || '',
      done,
      // missing = past due with nothing handed in; flagged = Canvas itself calls it missing.
      // In-class and on-paper work is past due without being flagged until it's graded.
      missing: !done && (!!past || !!(s && s.missing)),
      flagged: !done && !!(s && s.missing),
      graded: !!(s && s.graded),
      late: !!(s && s.late),
      submitted: !!(s && s.submitted),
    };
  }
  function normAssignment(a, c) {
    const s = a.submission || {};
    const due = a.due_at ? new Date(a.due_at) : null;
    const done = !!(s.submitted_at || s.excused || s.workflow_state === 'graded');
    return {
      key: `assignment:${a.id}`,
      type: a.quiz_id ? 'quiz' : a.discussion_topic ? 'discussion_topic' : 'assignment',
      title: a.name,
      due,
      url: a.html_url,
      courseId: c.id,
      courseName: c.name,
      done,
      missing: !done && (!!(due && due < new Date()) || !!s.missing),
      flagged: !done && !!s.missing,
      graded: s.workflow_state === 'graded',
      late: !!s.late,
      submitted: !!s.submitted_at,
    };
  }
  async function planner(fromDays, toDays, courseId) {
    const now = Date.now();
    const end = toDays === HORIZON_DAYS ? horizonEnd() : new Date(now + toDays * DAY);
    let q = `/planner/items?start_date=${new Date(now + fromDays * DAY).toISOString()}&end_date=${end.toISOString()}&per_page=100`;
    if (courseId) q += `&context_codes[]=course_${courseId}`;
    const items = await api(q, true);
    return items.filter((it) => WORK_TYPES.has(it.plannable_type)).map(normPlanner);
  }

  // End of the two-week window: midnight after day 14. setDate keeps it right across DST.
  function horizonEnd() {
    const d = startOfDay(new Date());
    d.setDate(d.getDate() + HORIZON_DAYS + 1);
    return d;
  }
  // Missing first (newest first), then upcoming work inside the horizon, soonest first.
  function dueSoon(items) {
    const horizon = horizonEnd();
    const missing = items.filter((i) => i.missing).sort((a, b) => b.flagged - a.flagged || (b.due || 0) - (a.due || 0));
    const upcoming = items.filter((i) => !i.done && !i.missing && i.due && i.due < horizon).sort((a, b) => a.due - b.due);
    return [...missing, ...upcoming];
  }
  // Groups items under "Missing" / "Due Today" / "Due Tomorrow" / "Due Friday" / "Due Nov 4" labels.
  function dueGroupsHtml(items, limit, colorOf) {
    const groups = [];
    for (const it of items.slice(0, limit)) {
      const label = it.flagged ? 'Missing' : it.missing ? 'Past due' : `Due ${dueWhen(it.due)}`;
      const cls = it.flagged ? 'missing' : it.missing ? '' : dayDiff(it.due) <= 1 ? 'soon' : '';
      let g = groups[groups.length - 1];
      if (!g || g.label !== label) groups.push((g = { label, cls, items: [] }));
      g.items.push(it);
    }
    return groups
      .map(
        (g) => `<div class="gcx-due-grp"><div class="gcx-due-h ${g.cls}">${esc(g.label)}</div>${g.items
          .map(
            (it) =>
              `<a class="gcx-due-item" href="${esc(it.url)}" style="--c:${esc(colorOf(it))}" title="${esc(
                it.title + (it.due ? ' · ' + shortDate(it.due) + ', ' + timeOf(it.due) : ''),
              )}">${esc(it.title)}</a>`,
          )
          .join('')}</div>`,
      )
      .join('');
  }

  // ---------------------------------------------------------------- rail
  // early.js may have put last page's rail in already (for the page transition); take it over.
  const rail = document.getElementById('gcx-rail') || document.body.appendChild(el('<nav id="gcx-rail" aria-label="Main"></nav>'));
  delete rail.dataset.early;
  let me = store.get('me', null);

  function railActive() {
    const p = location.pathname;
    if (VIEW === 'todo') return 'todo';
    if (p === '/') return 'classes';
    if (p.startsWith('/calendar')) return 'calendar';
    if (p.startsWith('/conversations')) return 'inbox';
    if (p === '/courses') return 'all';
    return '';
  }
  function renderRail(courses) {
    const on = railActive();
    const pinned = html.classList.contains('gcx-pinned');
    const item = (key, href, icon, label, extra = '') =>
      `<a class="gcx-ri${on === key ? ' on' : ''}" href="${href}" title="${label}"><span class="gcx-ri-ic">${svg(icon)}</span><span class="gcx-ri-tx"><span class="gcx-ri-name">${label}</span></span>${extra}</a>`;
    const looks = store.get('looks', {});
    const courseItems = (courses || [])
      .map((c) => {
        const look = looks[c.id] || {};
        return `<a class="gcx-ri gcx-ri-course${COURSE_ID === c.id ? ' on' : ''}" href="/courses/${c.id}" title="${esc(prettyName(c))}" data-id="${c.id}" style="--c:${esc(c.color)};--av:${esc(look.color || c.color)}">
          <span class="gcx-av">${avatarInner(c, look)}</span>
          <span class="gcx-ri-tx"><span class="gcx-ri-name">${esc(prettyName(c))}</span><span class="gcx-ri-sub">${esc(c.code)}</span></span>
          <button type="button" class="gcx-ri-dots" title="Customize icon" aria-label="Customize icon for ${esc(prettyName(c))}" aria-haspopup="dialog">${svg('more', 20)}</button></a>`;
      })
      .join('');
    const avatarUrl = me && me.avatar_url && !/avatar-50\.png/.test(me.avatar_url) ? me.avatar_url : '';
    rail.innerHTML = `
      <div class="gcx-rail-top">
        <button class="gcx-burger" type="button" aria-pressed="${pinned}" title="${pinned ? 'Collapse menu' : 'Keep menu open'}">${svg('menu')}</button>
        <a class="gcx-brand" href="/">Canvas</a>
      </div>
      <div class="gcx-rail-scroll">
        ${item('classes', '/', 'home', 'Classes')}
        ${item('todo', '/?gcx=todo', 'todo', 'To-do')}
        <div class="gcx-rail-sep"></div>
        <div class="gcx-rail-label">Enrolled</div>
        ${courseItems}
        ${item('all', '/courses', 'list', 'All courses')}
      </div>
      <div class="gcx-rail-bottom">
        ${item('calendar', '/calendar', 'calendar', 'Calendar')}
        ${item('inbox', '/conversations', 'inbox', 'Inbox', `<span class="gcx-badge" ${unread ? '' : 'hidden'}>${unread}</span>`)}
        <button class="gcx-ri gcx-account" type="button" title="Account">
          <span class="gcx-me">${avatarUrl ? '' : esc(firstChar(me && me.name).toUpperCase())}</span>
          <span class="gcx-ri-tx"><span class="gcx-ri-name">${esc((me && me.name) || 'Account')}</span><span class="gcx-ri-sub">Account &amp; settings</span></span>
        </button>
      </div>`;
    if (avatarUrl) rail.querySelector('.gcx-me').style.backgroundImage = `url(${JSON.stringify(avatarUrl)})`;
    if (html.classList.contains('gcx-school') && typeof applySchoolPref === 'function') applySchoolPref();
    if (fallbackSettings) addFallbackSettings();
  }
  const avatarInner = (c, look) => (look.icon && ICONS[look.icon] ? svg(look.icon, 18) : `<span class="gcx-av-l">${esc(initial(c))}</span>`);
  let unread = store.get('unread', 0);
  let fallbackSettings = false; // set when BetterCampus's settings panel never shows up
  let railQueued = false;
  const queueRail = () => {
    if (railQueued) return;
    railQueued = true;
    requestAnimationFrame(() => {
      railQueued = false;
      renderRail(COURSES);
    });
  };
  renderRail(COURSES);
  coursesReady.then((c) => c !== undefined && queueRail());
  // Last visit's copy of a view (Home, Classwork, People, To-do), for early.js to show during the
  // next page transition to the same URL. A few per tab, size-capped.
  function saveSnap() {
    const v = document.getElementById('gcx-view');
    // Not a filtered-down Classwork either (the rows hidden by the filter would stay hidden).
    if (!v || v.classList.contains('gcx-behind') || v.classList.contains('gcx-filtering') || !v.childElementCount || v.querySelector('.gcx-skel')) return;
    const copy = v.cloneNode(true);
    copy.querySelectorAll('.gcx-ripple, .gcx-pv, .gcx-pop-panel, script, iframe').forEach((n) => n.remove());
    copy.querySelectorAll('.gcx-pv-on').forEach((n) => n.classList.remove('gcx-pv-on'));
    copy.querySelectorAll('.gcx-reveal').forEach((n) => n.classList.add('gcx-shown'));
    const markup = copy.innerHTML;
    if (markup.length > 400000) return;
    const key = 'gcx:snap:' + location.pathname + location.search;
    try {
      const keys = (JSON.parse(sessionStorage.getItem('gcx:snaps') || '[]') || []).filter((k) => k !== key);
      keys.push(key);
      while (keys.length > 6) sessionStorage.removeItem(keys.shift());
      sessionStorage.setItem(key, JSON.stringify({ user: PAGE_USER, cls: v.className.replace(/\bgcx-\w*(stagger|in|filtering)\b/g, '').trim(), style: v.getAttribute('style') || '', html: markup }));
      sessionStorage.setItem('gcx:snaps', JSON.stringify(keys));
    } catch {
      try {
        sessionStorage.removeItem(key);
      } catch {}
    }
  }
  // What the next page's stand-ins are made from (see early.js standIns).
  addEventListener('pagehide', () => {
    try {
      sessionStorage.setItem('gcx:rail', JSON.stringify({ html: rail.innerHTML }));
      saveSnap();
      const cb = document.getElementById('gcx-cbar');
      if (cb && COURSE_ID) {
        const copy = cb.cloneNode(true);
        copy.querySelector('.gcx-more')?.remove();
        copy.querySelectorAll('.gcx-ripple').forEach((n) => n.remove());
        copy.querySelectorAll('.gcx-in').forEach((n) => n.classList.remove('gcx-in'));
        sessionStorage.setItem('gcx:cbar', JSON.stringify({ course: COURSE_ID, c: cb.style.getPropertyValue('--c'), html: copy.innerHTML }));
      }
    } catch {}
  });
  // Name/avatar change rarely (refresh daily); the unread count is kept for two minutes.
  if (!me || Date.now() - store.get('meAt', 0) > 864e5)
    api('/users/self')
      .then((u) => {
        me = { id: u.id, name: u.short_name || u.name, avatar_url: u.avatar_url };
        store.set('me', me);
        store.set('meAt', Date.now());
        queueRail();
      })
      .catch(() => {});
  if (Date.now() - store.get('unreadAt', 0) > 2 * 6e4)
    api('/conversations/unread_count')
      .then((r) => {
        const n = Number(r.unread_count) || 0;
        store.set('unread', n);
        store.set('unreadAt', Date.now());
        if (n !== unread) {
          unread = n;
          queueRail();
        }
      })
      .catch(() => {});

  rail.addEventListener('click', (e) => {
    const dots = e.target.closest('.gcx-ri-dots');
    if (dots) {
      e.preventDefault();
      e.stopPropagation();
      openLookPicker(dots.closest('.gcx-ri-course'), e);
      return;
    }
    if (e.target.closest('.gcx-burger')) {
      const on = !html.classList.contains('gcx-pinned');
      html.classList.toggle('gcx-pinned', on);
      store.set('pinned', on);
      renderRail(COURSES);
      toast(on ? 'Menu pinned open' : 'Menu collapses again');
    } else if (e.target.closest('.gcx-account')) {
      // Canvas's own account tray (profile, settings, log out) still works with its nav hidden.
      const link = document.getElementById('global_nav_profile_link');
      if (link) link.click();
      else location.href = '/profile/settings';
    }
  });

  // ----- class images he picks himself (an illustrated or plain cover, his own upload, or one
  // generated from a prompt). Canvas only lets teachers change a class's image, so these live in
  // extension storage and are drawn over Canvas's own on the class banner and the dashboard card.
  const svgLayer = (s) => `url("data:image/svg+xml,${encodeURIComponent(s)}") center / cover no-repeat`;
  // Small seeded random, so the drawn covers come out the same every time.
  const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const SVG_HEAD = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 300' preserveAspectRatio='xMidYMid slice'>";
  function libraryArt() {
    const rnd = seeded(7);
    const colors = ['#8c2f39', '#2f5d62', '#c9a227', '#3d405b', '#7a4419', '#5b8e7d', '#a44a3f', '#264653', '#b08968', '#6d597a'];
    let books = '';
    for (const base of [92, 192, 292]) {
      for (let x = 4; x < 800; ) {
        const w = 12 + Math.round(rnd() * 16);
        const h = 58 + Math.round(rnd() * 26);
        const c = colors[Math.floor(rnd() * colors.length)];
        const lean = rnd() < 0.06 ? ` transform='rotate(-8 ${x} ${base})'` : '';
        books += `<g${lean}><rect x='${x}' y='${base - h}' width='${w}' height='${h}' rx='2' fill='${c}'/><rect x='${x}' y='${base - h + 10}' width='${w}' height='3' fill='#e9c46a' opacity='.55'/><rect x='${x}' y='${base - 16}' width='${w}' height='2' fill='#e9c46a' opacity='.4'/></g>`;
        x += w + (rnd() < 0.08 ? 10 : 2);
      }
    }
    return `${SVG_HEAD}<defs><linearGradient id='w' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#3b2314'/><stop offset='1' stop-color='#1e110a'/></linearGradient><radialGradient id='l' cx='.75' cy='.05' r='.9'><stop offset='0' stop-color='#ffcf87' stop-opacity='.38'/><stop offset='1' stop-color='#ffcf87' stop-opacity='0'/></radialGradient></defs><rect width='800' height='300' fill='url(#w)'/>${books}<rect y='92' width='800' height='9' fill='#5a341c'/><rect y='192' width='800' height='9' fill='#5a341c'/><rect y='292' width='800' height='9' fill='#5a341c'/><rect width='800' height='300' fill='url(#l)'/></svg>`;
  }
  function mathArt() {
    const chalk = "fill='#f1f5f0' font-family='Georgia,serif' font-style='italic'";
    let grid = '';
    for (let x = 0; x <= 800; x += 40) grid += `<path d='M${x} 0V300' stroke='#ffffff' stroke-opacity='.05'/>`;
    for (let y = 0; y <= 300; y += 40) grid += `<path d='M0 ${y}H800' stroke='#ffffff' stroke-opacity='.05'/>`;
    let wave = 'M430 230';
    for (let x = 430; x <= 780; x += 10) wave += ` L${x} ${(230 - Math.sin((x - 430) / 28) * 26).toFixed(1)}`;
    return `${SVG_HEAD}<defs><radialGradient id='b' cx='.4' cy='.3' r='1'><stop offset='0' stop-color='#2f5e4e'/><stop offset='1' stop-color='#15302a'/></radialGradient></defs><rect width='800' height='300' fill='url(#b)'/>${grid}
      <g ${chalk} opacity='.85'><text x='60' y='105' font-size='34'>e<tspan dy='-14' font-size='20'>iπ</tspan><tspan dy='14'> + 1 = 0</tspan></text>
      <text x='70' y='175' font-size='28'>∑ 1/n<tspan dy='-12' font-size='17'>2</tspan><tspan dy='12'> = π</tspan><tspan dy='-12' font-size='17'>2</tspan><tspan dy='12'>/6</tspan></text>
      <text x='500' y='100' font-size='30'>∫ e<tspan dy='-13' font-size='18'>−x²</tspan><tspan dy='13'> dx = √π</tspan></text>
      <text x='120' y='230' font-size='26'>a² + b² = c²</text><text x='330' y='150' font-size='22' opacity='.7'>f′(x) = lim (f(x+h) − f(x)) / h</text></g>
      <path d='${wave}' fill='none' stroke='#f1f5f0' stroke-width='2.5' opacity='.7'/><path d='M300 270 L380 170 L420 270 Z' fill='none' stroke='#f1f5f0' stroke-width='2' opacity='.55'/><path d='M640 200 Q700 80 760 200' fill='none' stroke='#ffd166' stroke-width='2.5' opacity='.75'/><circle cx='700' cy='140' r='3' fill='#ffd166'/></svg>`;
  }
  function seminarArt() {
    const rnd = seeded(11);
    const tones = ['#f4a261', '#e76f51', '#2a9d8f', '#e9c46a', '#8ab17d', '#6d597a', '#457b9d', '#d4a373'];
    let seats = '';
    for (let i = 0; i < 14; i++) {
      const t = (i / 14) * Math.PI * 2;
      const x = 400 + Math.cos(t) * 300;
      const y = 150 + Math.sin(t) * 105;
      seats += `<circle cx='${x.toFixed(0)}' cy='${y.toFixed(0)}' r='${17 + Math.round(rnd() * 4)}' fill='${tones[i % tones.length]}'/><circle cx='${(400 + Math.cos(t) * 268).toFixed(0)}' cy='${(150 + Math.sin(t) * 88).toFixed(0)}' r='6' fill='#ffffff' opacity='.8'/>`;
    }
    let papers = '';
    for (let i = 0; i < 9; i++) {
      const x = 200 + rnd() * 380;
      const y = 105 + rnd() * 70;
      papers += `<rect x='${x.toFixed(0)}' y='${y.toFixed(0)}' width='34' height='24' rx='2' fill='#fffdf7' opacity='.9' transform='rotate(${(rnd() * 40 - 20).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})'/>`;
    }
    return `${SVG_HEAD}<defs><linearGradient id='f' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#3a2e2a'/><stop offset='1' stop-color='#1f1817'/></linearGradient></defs><rect width='800' height='300' fill='url(#f)'/><ellipse cx='400' cy='150' rx='250' ry='75' fill='#8b5e3c'/><ellipse cx='400' cy='146' rx='244' ry='70' fill='#a47148'/>${papers}${seats}</svg>`;
  }
  function geographyArt() {
    let lines = '';
    for (let x = 0; x <= 800; x += 100) lines += `<path d='M${x} 0V300' stroke='#e8f1ec' stroke-opacity='.08'/>`;
    for (let y = 0; y <= 300; y += 75) lines += `<path d='M0 ${y}H800' stroke='#e8f1ec' stroke-opacity='.08'/>`;
    const hill = (cx, cy, rings, seed) => {
      let out = '';
      for (let k = 1; k <= rings; k++) {
        const r = k * 16;
        let d = '';
        for (let a = 0; a <= 64; a++) {
          const t = (a / 64) * Math.PI * 2;
          const rr = r * (1 + 0.18 * Math.sin(3 * t + seed) + 0.1 * Math.sin(5 * t + seed * 2));
          d += `${a ? 'L' : 'M'}${(cx + Math.cos(t) * rr * 1.5).toFixed(1)} ${(cy + Math.sin(t) * rr).toFixed(1)}`;
        }
        out += `<path d='${d}Z' fill='none' stroke='#a8dcc9' stroke-width='${k % 4 === 0 ? 1.8 : 1}' stroke-opacity='${k % 4 === 0 ? 0.6 : 0.35}'/>`;
      }
      return out;
    };
    return `${SVG_HEAD}<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#123c3a'/><stop offset='1' stop-color='#1d5a4f'/></linearGradient></defs><rect width='800' height='300' fill='url(#g)'/>${lines}${hill(210, 140, 9, 1)}${hill(590, 190, 7, 4)}${hill(470, 40, 4, 2)}<circle cx='590' cy='190' r='4' fill='#ffd166'/><path d='M586 186 l8 8 M594 186 l-8 8' stroke='#ffd166' stroke-width='0'/><text x='600' y='182' font-family='system-ui,sans-serif' font-size='12' fill='#ffd166' opacity='.85'>N 30.28°</text></svg>`;
  }
  function econArt() {
    const rnd = seeded(23);
    let grid = '';
    for (let y = 40; y < 300; y += 50) grid += `<path d='M0 ${y}H800' stroke='#9fb3ff' stroke-opacity='.1'/>`;
    let bars = '';
    let line = '';
    let area = 'M0 300';
    let v = 210;
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      v = Math.max(50, Math.min(260, v - 3 + (rnd() - 0.42) * 22));
      pts.push([i * 20, v]);
    }
    pts.forEach(([x, y], i) => {
      line += `${i ? 'L' : 'M'}${x} ${y.toFixed(1)}`;
      area += ` L${x} ${y.toFixed(1)}`;
      if (i % 2 === 0) bars += `<rect x='${x - 6}' y='${(270 - rnd() * 40).toFixed(0)}' width='12' height='40' fill='#9fb3ff' opacity='.18'/>`;
    });
    area += ' L800 300 Z';
    let candles = '';
    for (let i = 0; i < 16; i++) {
      const x = 470 + i * 20;
      const o = 80 + rnd() * 60;
      const c = o + (rnd() - 0.55) * 40;
      const up = c < o;
      candles += `<path d='M${x} ${(Math.min(o, c) - 10).toFixed(0)}V${(Math.max(o, c) + 10).toFixed(0)}' stroke='${up ? '#52d1a2' : '#ff7a85'}'/><rect x='${x - 5}' y='${Math.min(o, c).toFixed(0)}' width='10' height='${Math.max(3, Math.abs(o - c)).toFixed(0)}' fill='${up ? '#52d1a2' : '#ff7a85'}'/>`;
    }
    return `${SVG_HEAD}<defs><linearGradient id='n' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#0b1d3a'/><stop offset='1' stop-color='#13284f'/></linearGradient><linearGradient id='a' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#4f7cff' stop-opacity='.45'/><stop offset='1' stop-color='#4f7cff' stop-opacity='0'/></linearGradient></defs><rect width='800' height='300' fill='url(#n)'/>${grid}${bars}<path d='${area}' fill='url(#a)'/><path d='${line}' fill='none' stroke='#8fb0ff' stroke-width='2.5'/><g opacity='.8'>${candles}</g><text x='40' y='84' font-family='system-ui,sans-serif' font-size='14' font-weight='700' fill='#8fb0ff' opacity='.7'>GDP · CPI · r*</text></svg>`;
  }
  // [id, label, layers, motion]. Motion (when on) is a keyframe name in classroom.css; drift ones
  // get room to move.
  const COVERS = [
    ['library', 'Library', svgLayer(libraryArt())],
    ['math', 'Math', svgLayer(mathArt())],
    ['seminar', 'Seminar', svgLayer(seminarArt())],
    ['geography', 'Geography', svgLayer(geographyArt())],
    ['econ', 'Econ', svgLayer(econArt())],
    ['aurora', 'Aurora', 'radial-gradient(at 20% 30%, #7f5af0 0, transparent 55%), radial-gradient(at 85% 15%, #2cb67d 0, transparent 50%), radial-gradient(at 60% 95%, #00b4d8 0, transparent 55%), linear-gradient(#16161a, #16161a)', 'drift'],
    ['ocean', 'Ocean', 'radial-gradient(at 70% 120%, #48cae4 0, transparent 60%), linear-gradient(180deg, #03045e, #0077b6)', 'drift'],
    ['blueprint', 'Blueprint', 'linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px) 0 0 / 28px 28px, linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px) 0 0 / 28px 28px, linear-gradient(135deg, #1e3a8a, #0ea5e9)', 'grid'],
    ['dots', 'Dots', 'radial-gradient(rgba(255,255,255,.28) 2px, transparent 2.5px) 0 0 / 22px 22px, linear-gradient(135deg, #9333ea, #ec4899)', 'dots'],
    ['sunset', 'Sunset', 'linear-gradient(160deg, #ff9a8b 0%, #ff6a88 45%, #6a3093 100%)'],
    ['forest', 'Forest', 'radial-gradient(at 30% 110%, #95d5b2 0, transparent 55%), linear-gradient(200deg, #081c15, #2d6a4f)'],
    ['peach', 'Peach', 'linear-gradient(120deg, #f6d365 0%, #fda085 100%)'],
    ['dusk', 'Dusk', 'linear-gradient(180deg, #0f2027, #203a43 50%, #2c5364)'],
  ];
  const COVERS_KEY = 'gcx-covers';
  const RECENT_KEY = 'gcx-cover-recent';
  const coverKey = (id) => `${PAGE_USER || 'anon'}:${id}`;
  let covers = {};
  let recent = []; // his last few uploaded or generated pictures, to reuse on other classes
  const isPicture = (d) => typeof d === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(d);
  // Only covers we know how to draw: a preset id or an uploaded/generated JPEG/PNG/WebP.
  const coverLayers = (v) => {
    if (!v) return '';
    if (v.preset) return (COVERS.find((x) => x[0] === v.preset) || [])[2] || '';
    if (isPicture(v.data)) return `url("${v.data}") center / cover no-repeat`;
    return '';
  };
  const coverMotion = (v) => (v && v.preset && prefs().coverMotion !== false && (COVERS.find((x) => x[0] === v.preset) || [])[3]) || '';
  const coverStyle = document.createElement('style');
  coverStyle.id = 'gcx-covers';
  // Last page's cover rules right away (extension storage answers a beat later), so covers are on
  // the dashboard's stand-in cards and the banner from the first frame.
  coverStyle.textContent = store.get('coverCss:' + (PAGE_USER || 'anon'), '');
  (document.head || html).append(coverStyle);
  function markCoverless() {
    for (const b of document.querySelectorAll('.gcx-banner[data-canvas-img]')) b.classList.toggle('gcx-noimg', !b.dataset.canvasImg && !coverLayers(covers[coverKey(COURSE_ID)]));
  }
  function paintCovers() {
    const mine = `${PAGE_USER || 'anon'}:`;
    coverStyle.textContent = Object.entries(covers)
      .filter(([k]) => k.startsWith(mine) && /^\d+$/.test(k.slice(mine.length)))
      .map(([k, v]) => {
        const id = k.slice(mine.length);
        const layers = coverLayers(v);
        if (!layers) return '';
        const card = `.ic-DashboardCard:has(a.gcx-card-ov[href="/courses/${id}"])`;
        // On the banner the cover is its own layer (::after of the picture layer), so it can move
        // and the black-and-white / dim filter still applies to it.
        const motion = coverMotion(v);
        // On cards it goes on a layer of our own (.gcx-card-cover): BetterCampus's custom cards hide
        // Canvas's image layer and draw pictures elsewhere, which left covered cards blank.
        return (
          `${card} .gcx-card-cover { display: block; background: ${layers};${motion === 'drift' ? ' background-size: 300% 300%;' : ''} }\n` +
          (motion ? `${card} .gcx-card-cover { animation: gcx-cv-${motion} ${motion === 'drift' ? '8s ease-in-out infinite alternate' : '5s linear infinite'}; }\n` : '') +
          `html[data-gcx-course="${id}"] .gcx-banner-img::after { content: ''; position: absolute; inset: 0; background: ${layers};${
            motion === 'drift' ? ' background-size: 300% 300%;' : ''
          } }\n` +
          (motion ? `html[data-gcx-course="${id}"] .gcx-banner-img::after { animation: gcx-cv-${motion} ${motion === 'drift' ? '8s ease-in-out infinite alternate' : '5s linear infinite'}; }` : '')
        );
      })
      .join('\n');
    // The instant copy (localStorage) skips uploaded/generated pictures: they're hundreds of KB each.
    // Those arrive a beat later from extension storage.
    const k = 'coverCss:' + (PAGE_USER || 'anon');
    const quick = coverStyle.textContent
      .split('\n')
      .filter((line) => !line.includes('data:image/'))
      .join('\n');
    if (store.get(k, '') !== quick) store.set(k, quick.length < 200000 ? quick : '');
    markCoverless();
  }
  const saveCover = (id, v) => {
    const next = { ...covers };
    if (v) next[coverKey(id)] = v;
    else delete next[coverKey(id)];
    covers = next;
    paintCovers();
    chrome.storage.local.set({ [COVERS_KEY]: next }).catch(() => toast("Couldn't save that image"));
  };
  const remember = (data) => {
    recent = [data, ...recent.filter((d) => d !== data)].slice(0, 8);
    chrome.storage.local.set({ [RECENT_KEY + ':' + (PAGE_USER || 'anon')]: recent }).catch(() => {});
  };
  try {
    const rk = RECENT_KEY + ':' + (PAGE_USER || 'anon');
    chrome.storage.local.get([COVERS_KEY, rk]).then((r) => {
      covers = r[COVERS_KEY] || {};
      recent = (r[rk] || []).filter(isPicture);
      paintCovers();
    }, () => {});
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area !== 'local') return;
      if (ch[COVERS_KEY]) {
        covers = ch[COVERS_KEY].newValue || {};
        paintCovers();
      }
      if (ch[rk]) recent = (ch[rk].newValue || []).filter(isPicture);
    });
  } catch {}
  addEventListener('gcx:prefs', paintCovers);
  // A picture (file or blob), center-cropped to the banner's shape and squeezed to a JPEG.
  async function shrinkImage(file) {
    const bmp = await createImageBitmap(file);
    const W = 1600;
    const H = 600;
    const scale = Math.max(W / bmp.width, H / bmp.height);
    const w = Math.min(W, Math.round(bmp.width * scale));
    const h = Math.min(H, Math.round(bmp.height * scale));
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    cv.getContext('2d').drawImage(bmp, (w - bmp.width * scale) / 2, (h - bmp.height * scale) / 2, bmp.width * scale, bmp.height * scale);
    bmp.close();
    return cv.toDataURL('image/jpeg', 0.85);
  }
  // A background picture: kept whole, at most 1920 wide, as a JPEG.
  async function shrinkBackdrop(file) {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1920 / bmp.width, 1200 / bmp.height);
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(bmp.width * scale));
    cv.height = Math.max(1, Math.round(bmp.height * scale));
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    bmp.close();
    return cv.toDataURL('image/jpeg', 0.85);
  }
  let closeCovers = null;
  function openCoverPicker(btn, id) {
    if (closeCovers) return closeCovers();
    const cur = covers[coverKey(id)] || {};
    const banner = btn.closest('.gcx-banner');
    const course = (COURSES || []).find((c) => c.id === id);
    const pop = el(`<div class="gcx-covers gcx-pop-panel" role="dialog" aria-label="Class image">
      <div class="gcx-covers-h"><span>Class image</span>
        <label class="gcx-covers-motion" title="Grid and Dots scroll, Aurora and Ocean drift"><input type="checkbox" ${prefs().coverMotion !== false ? 'checked' : ''}>Motion</label></div>
      <div class="gcx-covers-grid">${COVERS.map(
        ([k, label, , motion]) =>
          `<button type="button" data-cover="${k}" title="${label}${motion ? ' (moves)' : ''}" aria-label="${label}" class="${cur.preset === k ? 'on' : ''}"><span></span><small>${label}</small></button>`,
      ).join('')}</div>
      ${
        recent.length
          ? `<div class="gcx-covers-sub">Recent</div><div class="gcx-covers-grid gcx-covers-recent">${recent
              .map((_, i) => `<button type="button" data-recent="${i}" aria-label="Recent picture ${i + 1}"><span></span></button>`)
              .join('')}</div>`
          : ''
      }
      <form class="gcx-covers-ai" hidden><input type="text" maxlength="300" placeholder="Describe it, like “watercolor cells under a microscope”" aria-label="Describe the picture"><button type="submit">Make it</button></form>
      <div class="gcx-covers-acts">
        <button type="button" data-act="upload">${svg('upload', 18)}Upload</button>
        <button type="button" data-act="ai"><span class="gcx-covers-ai-mark">AI</span>Generate</button>
        ${cur.preset || cur.data ? `<button type="button" data-act="reset">${banner && banner.dataset.canvasImg ? "Canvas's image" : 'Remove'}</button>` : ''}
      </div>
      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden>
    </div>`);
    pop.querySelectorAll('[data-cover] span').forEach((n, i) => (n.style.background = COVERS[i][2]));
    pop.querySelectorAll('[data-recent] span').forEach((n, i) => (n.style.background = `url("${recent[i]}") center / cover`));
    document.body.append(pop);
    const place = () => {
      const r = btn.getBoundingClientRect();
      pop.style.left = Math.max(12, Math.min(r.right - pop.offsetWidth, window.innerWidth - pop.offsetWidth - 12)) + 'px';
      pop.style.top = Math.max(12, Math.min(r.bottom + 8, window.innerHeight - pop.offsetHeight - 12)) + 'px';
    };
    place();
    pop.style.transformOrigin = 'top right';
    const input = pop.querySelector('input[type=file]');
    const form = pop.querySelector('.gcx-covers-ai');
    const usePicture = (data) => {
      saveCover(id, { data });
      remember(data);
      close();
    };
    pop.querySelector('.gcx-covers-motion input').addEventListener('change', (e) => {
      store.set('prefs', { ...prefs(), coverMotion: e.target.checked });
      window.dispatchEvent(new CustomEvent('gcx:prefs'));
    });
    pop.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.type === 'submit') return;
      if (b.dataset.cover) {
        saveCover(id, { preset: b.dataset.cover });
        pop.querySelectorAll('[data-cover]').forEach((x) => x.classList.toggle('on', x === b));
      } else if (b.dataset.recent) usePicture(recent[+b.dataset.recent]);
      else if (b.dataset.act === 'upload') input.click();
      else if (b.dataset.act === 'ai') {
        form.hidden = !form.hidden;
        place();
        if (!form.hidden) form.querySelector('input').focus();
      } else if (b.dataset.act === 'reset') {
        saveCover(id, null);
        close();
      }
    });
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        usePicture(await shrinkImage(file));
      } catch {
        toast("Couldn't read that image");
      }
    });
    // A picture from his OpenAI key (background.js), cropped like an upload.
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = form.querySelector('input').value.trim();
      const go = form.querySelector('button');
      if (!text || go.disabled) return;
      go.disabled = true;
      go.textContent = 'Making…';
      form.classList.add('busy');
      try {
        const r = await chrome.runtime.sendMessage({ type: 'genCover', prompt: text, course: course ? prettyName(course) : '' });
        if (!r || !r.data) throw new Error((r && r.error) || 'No picture came back');
        const blob = await (await fetch(r.data)).blob();
        usePicture(await shrinkImage(blob));
      } catch (err) {
        toast(`Couldn't make that picture: ${err.message || err}`);
        if (pop.isConnected) {
          go.disabled = false;
          go.textContent = 'Make it';
          form.classList.remove('busy');
        }
      }
    });
    const close = () => {
      if (closeCovers === close) closeCovers = null;
      pop.classList.add('gcx-out');
      setTimeout(() => pop.remove(), 160);
      document.removeEventListener('mousedown', outside, true);
      document.removeEventListener('keydown', onKey, true);
    };
    closeCovers = close;
    const outside = (e) => {
      if (!pop.contains(e.target) && !btn.contains(e.target)) close();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', outside, true);
    document.addEventListener('keydown', onKey, true);
    pop.querySelector('[data-cover]').focus({ preventScroll: true });
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('.gcx-banner-edit');
    if (b && COURSE_ID) openCoverPicker(b, COURSE_ID);
  });

  // Icon + color for a course's rail avatar, picked from a little panel next to the cursor.
  const LOOK_ICONS = ['', 'science', 'biotech', 'psych', 'calc', 'chart', 'code', 'book', 'pen', 'globe', 'palette', 'music', 'sport', 'leaf', 'bolt', 'star', 'heart', 'school', 'people', 'quiz'];
  const LOOK_COLORS = ['', '#d93025', '#e8710a', '#f9ab00', '#188038', '#12a4af', '#1a73e8', '#9334e6', '#c2185b', '#5f6368'];
  let closeLook = null;
  function openLookPicker(item, ev) {
    if (closeLook) closeLook();
    const id = Number(item.dataset.id);
    const c = (COURSES || []).find((x) => x.id === id);
    if (!c) return;
    const looks = store.get('looks', {});
    const look = { ...(looks[id] || {}) };
    // Just icons and one thin row of colors. The letter and the course color are the "reset".
    const pop = el(`<div class="gcx-look gcx-pop-panel" role="dialog" aria-label="Icon for ${esc(prettyName(c))}">
      <div class="gcx-look-icons">${LOOK_ICONS.map((k) => `<button type="button" data-icon="${k}" title="${k || 'Letter'}" aria-label="${k || 'Letter'}">${k ? svg(k, 18) : `<span>${esc(initial(c))}</span>`}</button>`).join('')}</div>
      <div class="gcx-look-colors">${LOOK_COLORS.map((k) => `<button type="button" data-color="${k}" title="${k || 'Course color'}" aria-label="${k || 'Course color'}" style="--sw:${k || c.color}"></button>`).join('')}</div>
    </div>`);
    document.body.append(pop);
    html.classList.add('gcx-rail-hold');
    const W = pop.offsetWidth;
    const H = pop.offsetHeight;
    pop.style.left = Math.min(ev.clientX + 14, window.innerWidth - W - 12) + 'px';
    pop.style.top = Math.max(12, Math.min(ev.clientY - 40, window.innerHeight - H - 12)) + 'px';
    const paint = () => {
      const color = look.color || c.color;
      for (const n of rail.querySelectorAll(`.gcx-ri-course[data-id="${id}"] .gcx-av`)) {
        n.innerHTML = avatarInner(c, look);
        n.style.background = color;
      }
      rail.querySelector(`.gcx-ri-course[data-id="${id}"]`)?.style.setProperty('--av', color);
      pop.querySelectorAll('[data-icon]').forEach((b) => b.classList.toggle('on', b.dataset.icon === (look.icon || '')));
      pop.querySelectorAll('[data-color]').forEach((b) => b.classList.toggle('on', b.dataset.color === (look.color || '')));
    };
    const save = () => {
      const all = store.get('looks', {});
      if (look.icon || look.color) all[id] = look;
      else delete all[id];
      store.set('looks', all);
    };
    paint();
    pop.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.icon != null) look.icon = b.dataset.icon || undefined;
      else if (b.dataset.color != null) look.color = b.dataset.color || undefined;
      b.classList.remove('gcx-bump');
      void b.offsetWidth;
      b.classList.add('gcx-bump');
      paint();
      save();
    });
    const close = () => {
      if (closeLook === close) closeLook = null;
      pop.classList.add('gcx-out');
      html.classList.remove('gcx-rail-hold');
      setTimeout(() => pop.remove(), 160);
      document.removeEventListener('mousedown', outside, true);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointermove', onMove);
      clearTimeout(leaveTimer);
    };
    closeLook = close;
    const outside = (e) => {
      if (!pop.contains(e.target) && !e.target.closest?.('.gcx-ri-dots')) close();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    // Moving the pointer well away from both the panel and the rail closes it, like the chat.
    let leaveTimer = 0;
    const onMove = (e) => {
      const near = (n, m) => {
        const r = n.getBoundingClientRect();
        return e.clientX > r.left - m && e.clientX < r.right + m && e.clientY > r.top - m && e.clientY < r.bottom + m;
      };
      const live = rail.querySelector(`.gcx-ri-course[data-id="${id}"]`) || item;
      const over = near(pop, 40) || near(live, 8);
      if (over) {
        clearTimeout(leaveTimer);
        leaveTimer = 0;
      } else if (!leaveTimer) leaveTimer = setTimeout(close, 350);
    };
    document.addEventListener('mousedown', outside, true);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointermove', onMove, { passive: true });
    pop.querySelector('.gcx-look-icons button.on, .gcx-look-icons button')?.focus({ preventScroll: true });
  }

  // ---------------------------------------------------------------- course top bar
  // The course menu, parsed once. Some course pages don't render it, so the last copy seen for
  // this course stands in.
  let tabsCache = null;
  function courseTabs() {
    if (tabsCache) return tabsCache;
    const live = [...document.querySelectorAll('#section-tabs a')]
      .map((a) => ({ label: tabLabel(a), href: a.getAttribute('href') || '' }))
      .filter((t) => t.href && t.label);
    if (live.length && COURSE_ID) store.set('tabs:' + COURSE_ID, live);
    tabsCache = live.length ? live : (COURSE_ID && store.get('tabs:' + COURSE_ID, [])) || [];
    return tabsCache;
  }
  const CORE = { home: /^\/?$/, classwork: /^\/modules\/?$/, people: /^\/users\/?$/ };
  function tabLabel(a) {
    const c = a.cloneNode(true);
    c.querySelectorAll('[class*="badge"], .screenreader-only, .nav-icon').forEach((n) => n.remove());
    return c.textContent.replace(/\s+/g, ' ').trim();
  }
  function tabIcon(href) {
    if (/\/assignments\/syllabus/.test(href)) return 'page';
    if (/\/assignments/.test(href)) return 'assignment';
    if (/\/quizzes/.test(href)) return 'quiz';
    if (/\/files/.test(href)) return 'file';
    if (/\/grades/.test(href)) return 'grade';
    if (/\/announcements/.test(href)) return 'announce';
    if (/\/discussion_topics/.test(href)) return 'discussion';
    if (/\/(wiki|pages)/.test(href)) return 'page';
    if (/\/(users|groups)/.test(href)) return 'people';
    if (/\/external_tools/.test(href)) return 'tool';
    return 'link';
  }

  // Everything the More search can jump to, built from what's already cached: the To-do list
  // (all classes), and the Classwork and file lists of classes he's opened.
  async function buildSearchIndex() {
    const courses = COURSES || (await coursesReady);
    const code = new Map(courses.map((c) => [c.id, c.code || prettyName(c)]));
    const out = new Map();
    // One entry per thing: the To-do list, a module and an assignment group can all link the same
    // assignment (the first one added, the direct link, wins); files dedupe by file id.
    const add = (e) => {
      if (!e.href || !e.label) return;
      const k = e.fileId ? 'f' + e.fileId : `${e.courseId}|${e.icon}|${e.label.trim().toLowerCase()}`;
      if (!out.has(k)) out.set(k, { ...e, sub: code.get(e.courseId) || '', hay: e.label.toLowerCase() + ' ' + (code.get(e.courseId) || '').toLowerCase() });
    };
    for (const it of (await cache.get('todo:items')) || []) {
      if (it.courseId) add({ label: it.title, href: it.url, courseId: it.courseId, icon: TYPE_ICON[it.type] || 'assignment' });
    }
    await Promise.all(
      courses.map(async (c) => {
        const [cw, cwf] = await Promise.all([cache.get('cw:' + c.id), cache.get('cwf:' + c.id)]);
        for (const m of (cw && cw.mods) || []) {
          for (const it of m.items || []) {
            if (it.type === 'SubHeader') continue;
            const file = it.type === 'File' ? it.content_id : null;
            add({
              label: it.title,
              href: file ? `/courses/${c.id}/files/${file}` : it.html_url || it.external_url,
              courseId: c.id,
              fileId: file,
              icon: KIND_ICON[it.type] || 'link',
            });
          }
        }
        for (const g of (cw && cw.groups) || []) {
          for (const a of g.assignments || []) add({ label: a.name, href: a.html_url, courseId: c.id, icon: a.quiz_id ? 'quiz' : a.discussion_topic ? 'discussion' : 'assignment' });
        }
        for (const f of (cwf && cwf.files) || []) add({ label: f.name, href: `/courses/${c.id}/files/${f.id}`, courseId: c.id, fileId: f.id, icon: 'file' });
      }),
    );
    return [...out.values()];
  }
  // Every word must appear (in the title or the course code); titles that start with the query,
  // and things from the current class, come first.
  function searchIndex(index, q, courseId) {
    const words = q.split(/\s+/).filter(Boolean);
    const compact = q.replace(/\s+/g, '');
    return index
      .map((e) => {
        const tight = e.hay.replace(/\s+/g, '');
        if (!words.every((w) => e.hay.includes(w)) && !tight.includes(compact)) return null;
        const t = e.label.toLowerCase();
        const score = (t.startsWith(q) ? 0 : t.includes(q) ? 1 : 2) + (e.courseId === courseId ? 0 : 0.5);
        return { e, score };
      })
      .filter(Boolean)
      .sort((x, y) => x.score - y.score || x.e.label.length - y.e.label.length)
      .slice(0, 8)
      .map((x) => x.e);
  }

  async function renderCourseBar() {
    const id = COURSE_ID;
    const base = `/courses/${id}`;
    const rest = location.pathname.slice(base.length);
    const tabs = courseTabs();
    const hasPeople = !tabs.length || tabs.some((t) => /\/users\/?$/.test(t.href));
    // Canvas redirects a hidden tab back to course home, so courses without Modules
    // reach Classwork through the home URL instead.
    const hasModules = !tabs.length || tabs.some((t) => /\/modules\/?$/.test(t.href));
    const classworkHref = hasModules ? `${base}/modules` : `${base}?gcx=classwork`;
    const others = tabs.filter((t) => {
      const r = t.href.replace(/^https?:\/\/[^/]+/, '').replace(base, '').split('?')[0];
      return !(CORE.home.test(r) || CORE.classwork.test(r) || CORE.people.test(r));
    });

    const active = VIEW === 'classwork'
      ? 'classwork'
      : CORE.home.test(rest) || /^\/announcements/.test(rest)
      ? 'home'
      : /^\/(users|groups)/.test(rest)
        ? 'people'
        : /^\/(modules|assignments|quizzes|files|grades|pages|wiki|discussion_topics)/.test(rest)
          ? 'classwork'
          : '';

    let bar = el(`<div id="gcx-cbar">
      <a class="gcx-cbar-title" href="${base}"><span class="gcx-cbar-name"><span class="gcx-skel gcx-skel-name"></span></span><span class="gcx-cbar-sub"><span class="gcx-skel gcx-skel-sub"></span></span></a>
      <nav class="gcx-tabs" aria-label="Course">
        <a class="gcx-tab${active === 'home' ? ' on' : ''}" href="${base}">Home</a>
        <a class="gcx-tab${active === 'classwork' ? ' on' : ''}" href="${classworkHref}">Classwork</a>
        ${hasPeople ? `<a class="gcx-tab${active === 'people' ? ' on' : ''}" href="${base}/users">People</a>` : ''}
        <span class="gcx-tabs-ink"></span>
      </nav>
      <div class="gcx-cbar-actions">
        <button class="gcx-cbar-set" type="button" title="Classroom settings" aria-label="Classroom settings">${svg('palette', 20)}</button>
        <button class="gcx-more-btn" type="button" aria-expanded="false" aria-haspopup="true" title="Search everything else in this course (/)">
          ${svg('search', 20)}<span>More</span><kbd>/</kbd>
        </button>
        <div class="gcx-more" hidden>
          <div class="gcx-more-search">${svg('search', 20)}<input type="text" placeholder="Search course tools" aria-label="Search course tools" autocomplete="off"></div>
          <div class="gcx-more-list" role="listbox"></div>
        </div>
      </div>
    </div>`);
    // early.js may have put a stand-in in for the page transition; take that element over (keeping
    // its title, which the transition is animating) instead of adding a second bar.
    const early = document.getElementById('gcx-cbar');
    if (early) {
      const keepTitle = early.querySelector('.gcx-cbar-title');
      early.replaceChildren(...bar.childNodes);
      if (keepTitle) early.querySelector('.gcx-cbar-title').replaceWith(keepTitle);
      delete early.dataset.early;
      bar = early;
    } else document.getElementById('wrapper').prepend(bar);
    // Same course as the last page: paint the title from cache now so it doesn't blink during
    // the page transition, and slide the tab underline over from the tab he came from.
    // Until the name is known the title shows shimmer placeholders; the real text fades in.
    const paintTitle = (c) => {
      bar.style.setProperty('--c', c.color);
      // The class color for the rest of the page too (an announcement's title and accent).
      html.style.setProperty('--gcx-cc', c.color);
      const name = prettyName(c) || c.code || 'Course';
      // Like Classroom's header: the name, and under it just the course code (the teacher is on
      // the class card and in People), unless the name already says it.
      const squash = (t) => String(t || '').replace(/\s+/g, '').toLowerCase();
      const sub = c.code && !squash(name).includes(squash(c.code)) ? c.code : '';
      const title = bar.querySelector('.gcx-cbar-title');
      const wasLoading = !!title.querySelector('.gcx-skel');
      if (!wasLoading && title.textContent === name + sub) return;
      bar.querySelector('.gcx-cbar-name').textContent = name;
      bar.querySelector('.gcx-cbar-sub').textContent = sub;
      if (wasLoading) reveal(title);
    };
    const cachedCourse = COURSES && COURSES.find((x) => x.id === id);
    if (cachedCourse) paintTitle(cachedCourse);
    const ink = bar.querySelector('.gcx-tabs-ink');
    const tabEls = [...bar.querySelectorAll('.gcx-tab')];
    const onTab = bar.querySelector('.gcx-tab.on');
    const placeInk = (t) => (ink.style.cssText = t ? `left:${t.offsetLeft + 10}px;width:${t.offsetWidth - 20}px;opacity:1` : 'opacity:0');
    const fromTab = tabEls[Number(html.dataset.gcxFrom)];
    if (fromTab && onTab && fromTab !== onTab) {
      ink.classList.add('still');
      placeInk(fromTab);
      void ink.offsetWidth;
      ink.classList.remove('still');
      requestAnimationFrame(() => placeInk(onTab));
    } else placeInk(onTab);
    addEventListener('resize', debounce(() => placeInk(bar.querySelector('.gcx-tab.on')), 100));
    // Built ahead of time (a prerendered tab): slide the underline over once he actually arrives.
    if (document.prerendering)
      addEventListener(
        'pagereveal',
        () => {
          const from = tabEls[Number(html.dataset.gcxFrom)];
          const on = bar.querySelector('.gcx-tab.on');
          if (!from || !on || from === on) return;
          ink.classList.add('still');
          placeInk(from);
          void ink.offsetWidth;
          ink.classList.remove('still');
          requestAnimationFrame(() => placeInk(on));
        },
        { once: true },
      );

    const panel = bar.querySelector('.gcx-more');
    // Just the Classroom settings, in a small panel by the button (not BetterCampus's whole panel).
    bar.querySelector('.gcx-cbar-set').addEventListener('click', (e) => openFallbackSettings(e.currentTarget));
    const btn = bar.querySelector('.gcx-more-btn');
    const input = panel.querySelector('input');
    const list = panel.querySelector('.gcx-more-list');
    const extras = [
      { label: 'Canvas home page', href: `${base}?gcx-original=1`, icon: 'home' },
      ...(hasModules ? [{ label: 'Canvas modules page', href: `${base}/modules?gcx-original=1`, icon: 'page' }] : []),
    ];
    let sel = 0;
    let index = null;
    const drawList = () => {
      const q = input.value.trim().toLowerCase();
      const match = (t) => !q || t.label.toLowerCase().includes(q);
      const a = others.filter(match);
      const b = extras.filter(match);
      // Assignments, quizzes, pages and files across classes ("hw 7" -> HW 7 · BIO 315H).
      const c = q.length >= 2 && index ? searchIndex(index, q, id) : [];
      let n = 0;
      const row = (t) =>
        `<a class="gcx-more-item${n++ === sel ? ' sel' : ''}" href="${esc(t.href)}" role="option"${
          t.fileId ? ` data-gcx-file="${esc(t.fileId)}" data-gcx-course="${esc(t.courseId)}"` : ''
        }>${svg(t.icon || tabIcon(t.href), 20)}<span>${esc(t.label)}</span>${t.sub ? `<small>${esc(t.sub)}</small>` : ''}</a>`;
      list.innerHTML =
        (a.length ? a.map(row).join('') : '') +
        (c.length ? `<div class="gcx-more-h">Classwork and files</div>` + c.map(row).join('') : '') +
        (b.length ? `<div class="gcx-more-h">Original Canvas pages</div>` + b.map(row).join('') : '') ||
        `<div class="gcx-more-empty">Nothing matches "${esc(input.value)}"</div>`;
    };
    const open = (show) => {
      panel.hidden = !show;
      btn.setAttribute('aria-expanded', String(show));
      if (show) {
        input.value = '';
        sel = 0;
        drawList();
        input.focus();
        // Rebuilt on every open (a few cache reads), so a class opened since then is included.
        buildSearchIndex().then((ix) => {
            index = ix;
            if (!panel.hidden && input.value.trim()) drawList();
          });
      }
    };
    btn.addEventListener('click', () => open(panel.hidden));
    input.addEventListener('input', () => {
      sel = 0;
      drawList();
    });
    input.addEventListener('keydown', (e) => {
      const items = list.querySelectorAll('.gcx-more-item');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        sel = Math.max(0, Math.min(items.length - 1, sel + (e.key === 'ArrowDown' ? 1 : -1)));
        items.forEach((n, i) => n.classList.toggle('sel', i === sel));
        if (items[sel]) items[sel].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && items[sel]) {
        // A click, so files go to the in-page viewer like any other file link.
        items[sel].click();
      } else if (e.key === 'Escape') {
        open(false);
        btn.focus();
      }
    });
    document.addEventListener('click', (e) => {
      if (!panel.hidden && !e.target.closest('.gcx-cbar-actions')) open(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || html.classList.contains('gcx-fv-open')) return;
      const t = e.composedPath()[0] || e.target;
      if (!t.tagName || t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      e.preventDefault();
      open(true);
    });

    const c = await courseById(id);
    paintTitle(c);
    document.querySelector('#gcx-rail .gcx-ri-course.on')?.style.setProperty('--c', c.color);
    return c;
  }

  // ---------------------------------------------------------------- replacement views
  function mountView() {
    const content = document.getElementById('content');
    if (!content) return null;
    const early = document.getElementById('gcx-view');
    if (early) {
      delete early.dataset.early;
      return early;
    }
    const view = el('<div id="gcx-view"></div>');
    const snap = document.getElementById('gcx-snap');
    if (!snap) {
      content.prepend(view);
      return view;
    }
    // early.js put last visit's copy of this page up for the page transition. The live view draws
    // hidden right behind it (laid out, so measuring works) and takes over once the transition has
    // finished and the view has its content, so nothing blinks or replays.
    view.classList.add('gcx-behind');
    snap.after(view);
    const swap = () => {
      if (!snap.isConnected) return;
      const y = window.scrollY;
      snap.remove();
      view.classList.remove('gcx-behind');
      window.scrollTo(0, y);
    };
    Promise.resolve(window.gcxTransition).then(() => {
      const t0 = Date.now();
      const tick = () => (view.childElementCount && !view.querySelector('.gcx-skel')) || Date.now() - t0 > 1500 ? swap() : requestAnimationFrame(tick);
      tick();
    });
    return view;
  }
  const showError = (box, what, originalHref, err) => {
    console.warn('[canvas-classroom]', what, err);
    box.innerHTML = `<div class="gcx-err">Couldn't load ${esc(what)} (${esc(err && err.message)}). <a href="${esc(originalHref)}">Open the original Canvas page</a>.</div>`;
  };
  const skeleton = (n = 3) => Array.from({ length: n }, (_, i) => `<div class="gcx-skel ${['w80', 'w60', 'w40'][i % 3]}"></div>`).join('');
  // Fade freshly loaded content in (restarts the animation if it already ran).
  const reveal = (n) => {
    if (!n) return;
    n.classList.remove('gcx-in');
    void n.offsetWidth;
    n.classList.add('gcx-in');
  };
  // The first fill of a box fades in; later refreshes (fresh data after the cached copy) just swap.
  const swapIn = (box, markup) => {
    const first = !box.dataset.filled;
    box.dataset.filled = '1';
    box.innerHTML = markup;
    // Still rising in with the rest of the page (gcx-enter)? Then that's its entrance; a second
    // fade on top made it flicker.
    if (first && waited() && box.checkVisibility() && !document.getAnimations().some((x) => x.playState === 'running' && x.effect && x.effect.target && x.effect.target.contains && x.effect.target.contains(box))) reveal(box);
    else box.classList.remove('gcx-stagger');
  };

  // Announcement HTML comes from Canvas (already sanitized server-side); strip embeds so the preview stays light.
  function cleanHtml(markup) {
    const doc = new DOMParser().parseFromString(markup || '', 'text/html');
    doc.querySelectorAll('script, style, iframe, object, embed, link, meta, form').forEach((n) => n.remove());
    doc.querySelectorAll('*').forEach((n) => {
      for (const a of [...n.attributes]) if (/^on/i.test(a.name)) n.removeAttribute(a.name);
    });
    doc.querySelectorAll('a').forEach((a) => a.setAttribute('target', '_blank'));
    doc.querySelectorAll('p, div').forEach((n) => {
      if (!n.textContent.replace(/ /g, ' ').trim() && !n.querySelector('img, video, a')) n.remove();
    });
    return doc.body.innerHTML;
  }

  // ----- course Home data (also warmed from other pages; see warmCourses)
  const fetchAnns = async (id) =>
    (
      await api(
        `/announcements?context_codes[]=course_${id}&start_date=2000-01-01&end_date=${new Date(Date.now() + DAY).toISOString()}&active_only=true&per_page=15`,
      )
    ).map((a) => ({
      title: a.title,
      html_url: a.html_url,
      message: a.message,
      posted_at: a.posted_at,
      read_state: a.read_state,
      replies: a.discussion_subentry_count || 0,
      author: { name: (a.author || {}).display_name, avatar: (a.author || {}).avatar_image_url },
    }));
  // Classroom-style "posted a new assignment / new material" items from the last three weeks.
  // Assignments count from when they opened (unlock date) if that's later than when they were made.
  const POST_DAYS = 21;
  const fetchPosts = async (id, strict = false, tally) => {
    const since = Date.now() - POST_DAYS * DAY;
    const now = Date.now();
    const [assigns, files] = await Promise.all([
      api(`/courses/${id}/assignments?per_page=100`, true).catch(softFail(strict, [], tally)),
      courseHasFiles(id) ? api(`/courses/${id}/files?sort=created_at&order=desc&per_page=40`).catch(softFail(strict, [], tally)) : Promise.resolve([]),
    ]);
    const posts = [];
    for (const a of assigns) {
      if (!a.published && a.published !== undefined) continue;
      const opened = [a.created_at, a.unlock_at].filter(Boolean).map(Date.parse).filter((t) => t <= now);
      const t = opened.length ? Math.max(...opened) : 0;
      if (t >= since) posts.push({ kind: a.quiz_id ? 'quiz' : a.discussion_topic ? 'discussion' : 'assignment', t, title: a.name, url: a.html_url, due: a.due_at });
    }
    // Files posted the same day become one "posted N new materials" item.
    const byDay = new Map();
    for (const f of files) {
      const t = Date.parse(f.created_at);
      if (!(t >= since) || f.locked_for_user || f.hidden_for_user) continue;
      const day = startOfDay(t).getTime();
      if (!byDay.has(day)) byDay.set(day, { kind: 'files', t, files: [] });
      const g = byDay.get(day);
      g.t = Math.max(g.t, t);
      g.files.push({ id: f.id, name: f.display_name });
    }
    posts.push(...byDay.values());
    return posts;
  };

  // ----- Home: banner, Upcoming, announcements stream
  async function renderHome(view, cPromise) {
    const id = COURSE_ID;
    const earlyBanner = view.querySelector('.gcx-banner[data-early]');
    view.innerHTML = `
      <div class="gcx-banner"><div class="gcx-banner-img"></div><button type="button" class="gcx-banner-edit" aria-label="Change class image" title="Change class image">${svg('image', 18)}<span>Add image</span></button><div class="gcx-banner-tx"><h1>&nbsp;</h1><div>&nbsp;</div></div></div>
      <div class="gcx-home-cols">
        <div class="gcx-home-side">
          <aside class="gcx-card gcx-upc"><div class="gcx-upc-h">Upcoming</div><div class="gcx-upc-list">${skeleton(3)}</div>
            <div class="gcx-upc-foot"><a class="gcx-upc-all" href="/courses/${id}/modules">View all</a></div></aside>
          <aside class="gcx-card gcx-links"></aside>
        </div>
        <section class="gcx-stream">${`<div class="gcx-card gcx-ann">${skeleton(4)}</div>`.repeat(2)}</section>
      </div>`;
    // The class card is growing into early.js's stand-in banner right now: keep that element (with
    // the real banner's insides), or the transition would lose its target.
    if (earlyBanner) {
      const fresh = view.querySelector('.gcx-banner');
      earlyBanner.querySelector('.gcx-banner-img').after(fresh.querySelector('.gcx-banner-edit'));
      delete earlyBanner.dataset.early;
      fresh.replaceWith(earlyBanner);
    }

    const classworkTab = document.querySelector('#gcx-cbar .gcx-tabs a:nth-child(2)');
    if (classworkTab) view.querySelector('.gcx-upc-all').href = classworkTab.href;
    const paintBanner = (c) => {
      view.style.setProperty('--c', c.color);
      const banner = view.querySelector('.gcx-banner');
      // The fresh course data carries the same image under a new access token; swapping to that URL
      // made the banner drop to plain color while it re-downloaded. Only change it for a new image.
      const imgPath = (c.image || '').split('?')[0];
      if (c.image && banner.dataset.img !== imgPath) {
        banner.dataset.img = imgPath;
        banner.querySelector('.gcx-banner-img').style.backgroundImage = `url("${c.image.replace(/"/g, '%22')}")`;
      }
      banner.dataset.canvasImg = c.image ? '1' : '';
      markCoverless();
      const tx = banner.querySelector('.gcx-banner-tx');
      const sig = [prettyName(c), c.code, c.term, teacherLine(c), c.score, c.letter].join('|');
      if (tx.dataset.sig === sig) return;
      tx.dataset.sig = sig;
      banner.querySelector('.gcx-banner-tx').innerHTML = `<h1>${esc(prettyName(c))}</h1><div>${esc([c.code, c.term].filter(Boolean).join(' · '))}</div>${
        c.teachers.length ? `<div>${esc(teacherLine(c))}</div>` : ''
      }`;
      banner.querySelector('.gcx-banner-grade')?.remove();
      if (c.score != null) banner.append(el(`<a class="gcx-banner-grade" href="/courses/${id}/grades">${esc(c.letter ? c.letter + ' · ' : '')}${esc(+c.score.toFixed(2))}%</a>`));
    };
    const cached = COURSES && COURSES.find((x) => x.id === id);
    if (cached) paintBanner(cached);
    cPromise.then(paintBanner);
    renderLinks(view.querySelector('.gcx-links'), id);

    const color = () => (cached || {}).color || getComputedStyle(view).getPropertyValue('--c') || '#1a73e8';
    swr(
      'home:upc:' + id,
      () => planner(-HORIZON_DAYS, HORIZON_DAYS, id),
      (items) => {
        const soon = dueSoon(items);
        swapIn(
          view.querySelector('.gcx-upc-list'),
          soon.length ? `<div class="gcx-due">${dueGroupsHtml(soon, 6, color)}</div>` : `<div class="gcx-due-none">Nothing due in the next two weeks.</div>`,
        );
      },
      reviveItems,
    ).catch((e) => showError(view.querySelector('.gcx-upc-list'), 'upcoming work', `/courses/${id}/assignments`, e));

    const stream = view.querySelector('.gcx-stream');
    const postHtml = (pst, i) => {
      const c = COURSES && COURSES.find((x) => x.id === id);
      const who = (c && c.teachers[0] && c.teachers[0].name) || 'Your instructor';
      const when = new Date(pst.t);
      const date = postedWhen(when, false);
      if (pst.kind === 'files') {
        const shown = pst.files.slice(0, 4);
        const more = pst.files.length - shown.length;
        return `<article class="gcx-card gcx-post" style="--i:${Math.min(i, 8)}">
          <div class="gcx-post-head"><span class="gcx-post-ic">${svg('file', 20)}</span>
            <div class="gcx-post-tx"><span><b>${esc(who)}</b> posted ${pst.files.length === 1 ? 'a new material' : `${pst.files.length} new materials`}</span><small>${esc(date)}</small></div></div>
          <div class="gcx-post-files">${shown
            .map((f) => `<a class="gcx-post-file" href="/courses/${id}/files/${f.id}" data-gcx-file="${f.id}" data-gcx-course="${id}">${fileTile(f.name, 20)}<span>${esc(f.name)}</span></a>`)
            .join('')}${more > 0 ? `<a class="gcx-post-more" href="/courses/${id}/files">+${more} more</a>` : ''}</div>
        </article>`;
      }
      const noun = pst.kind === 'quiz' ? 'quiz' : pst.kind === 'discussion' ? 'discussion' : 'assignment';
      return `<a class="gcx-card gcx-post gcx-post-link" href="${esc(pst.url)}" style="--i:${Math.min(i, 8)}">
        <div class="gcx-post-head"><span class="gcx-post-ic">${svg(TYPE_ICON[pst.kind === 'discussion' ? 'discussion_topic' : pst.kind] || 'assignment', 20)}</span>
          <div class="gcx-post-tx"><span><b>${esc(who)}</b> posted a new ${noun}: <b>${esc(pst.title)}</b></span><small>${esc(date)}${pst.due ? ' · ' + esc(dueText(new Date(pst.due))) : ''}</small></div></div>
      </a>`;
    };
    let annsNow = null;
    let postsNow = [];
    const drawStream = () => {
      if (!annsNow) return;
      const anns = annsNow;
      // Fresh data often differs only invisibly (signed image links in the message); redrawing
      // then reloads avatars and re-measures "Show more", which made the links jump. Skip it.
      const sig = JSON.stringify([
        anns.map((a) => [a.title, a.posted_at, a.read_state, a.replies, htmlText(a.message || '').slice(0, 2000)]),
        postsNow.map((x) => [x.kind, x.t, x.title, x.due, (x.files || []).map((f) => f.id)]),
      ]);
      if (stream.dataset.sig === sig) return;
      stream.dataset.sig = sig;
      if (!anns.length && !postsNow.length) {
        swapIn(stream, `<div class="gcx-card gcx-empty">No announcements yet.</div>`);
        return;
      }
      const entries = [...anns.map((a) => ({ t: a.posted_at ? Date.parse(a.posted_at) : 0, a })), ...postsNow.map((p) => ({ t: p.t, p }))].sort((x, y) => y.t - x.t);
      swapIn(
        stream,
        entries
          .map(({ a, p }, i) => {
            if (p) return postHtml(p, i);
            const author = a.author || {};
            const when = a.posted_at ? new Date(a.posted_at) : null;
            const av = author.avatar && !/avatar-50\.png/.test(author.avatar) ? `data-av="${esc(author.avatar)}"` : '';
            return `<article class="gcx-card gcx-ann" style="--i:${Math.min(i, 8)}">
            <div class="gcx-ann-head">
              <span class="gcx-ann-av" ${av}>${av ? '' : esc(firstChar(author.name))}</span>
              <div class="gcx-ann-who"><b>${esc(author.name || 'Instructor')}</b><span>${when ? esc(postedWhen(when)) : ''}</span></div>
              ${a.read_state === 'unread' ? '<span class="gcx-ann-new">New</span>' : ''}
            </div>
            <a class="gcx-ann-title" href="${esc(a.html_url)}">${esc(a.title)}</a>
            <div class="gcx-ann-body">${cleanHtml(a.message)}</div>
            <div class="gcx-ann-foot">
              <button type="button" class="gcx-ann-toggle" hidden>Show more</button>
              <a href="${esc(a.html_url)}">${a.replies ? `${a.replies} ${a.replies === 1 ? 'reply' : 'replies'}` : 'Open'}</a>
            </div>
          </article>`;
          })
          .join(''),
      );
      if (anns.length >= 15) stream.append(el(`<a class="gcx-chip" style="align-self:center" href="/courses/${id}/announcements">Older announcements</a>`));
      stream.querySelectorAll('[data-av]').forEach((n) => (n.style.backgroundImage = `url(${JSON.stringify(n.dataset.av)})`));
      fixInlineColors(stream);
      // Past the first two, announcements fade and slide up as they scroll into view. This runs
      // on every draw (the fresh copy replaces the cached one), but anything already on screen or
      // above it stays put so a refresh never hides what he's looking at.
      if (stream.gcxIo) stream.gcxIo.disconnect();
      // Drawn behind last visit's copy (page transition): everything is laid out out of sight, so
      // nothing would count as on screen; skip the reveal rather than fade them in twice.
      if (prefs().annReveal && 'IntersectionObserver' in window && !stream.closest('.gcx-behind')) {
        const io = (stream.gcxIo = new IntersectionObserver(
          (entries) => {
            for (const e of entries) {
              if (!e.isIntersecting) continue;
              e.target.classList.add('gcx-shown');
              io.unobserve(e.target);
            }
          },
          { rootMargin: '0px 0px -8% 0px' },
        ));
        for (const n of [...stream.querySelectorAll('.gcx-ann, .gcx-post')].slice(2)) {
          if (n.getBoundingClientRect().top < innerHeight) continue;
          n.classList.add('gcx-reveal');
          io.observe(n);
        }
      }
      for (const art of stream.querySelectorAll('.gcx-ann')) {
        const body = art.querySelector('.gcx-ann-body');
        const toggle = art.querySelector('.gcx-ann-toggle');
        toggle.addEventListener('click', () => {
          // Animate between the clipped height and the full height.
          const from = body.getBoundingClientRect().height;
          const open = body.classList.toggle('open');
          const to = body.scrollHeight;
          toggle.textContent = open ? 'Show less' : 'Show more';
          body.animate([{ maxHeight: from + 'px' }, { maxHeight: (open ? to : body.getBoundingClientRect().height) + 'px' }], { duration: 280, easing: 'cubic-bezier(.2,.7,.2,1)' });
        });
        // Images load after this runs, so measure again when each one arrives.
        const measure = () => {
          if (!toggle.hidden || body.scrollHeight <= body.clientHeight + 4) return;
          body.classList.add('clip');
          toggle.hidden = false;
        };
        measure();
        body.querySelectorAll('img').forEach((img) => img.addEventListener('load', measure, { once: true }));
      }
    };
    barStart();
    // Both saved halves (announcements and "posted new work") go up in one draw, so the stream
    // animates in once instead of once per half (and again when the fresh copy lands).
    const [annSaved, postsSaved] = await Promise.all([cache.get('home:ann:' + id), cache.get('home:posts:' + id)]);
    if (postsSaved) postsNow = postsSaved;
    if (annSaved) {
      annsNow = annSaved;
      drawStream();
    }
    swr('home:ann:' + id, () => fetchAnns(id), (anns) => {
      annsNow = anns;
      drawStream();
      barDone();
    })
      .catch((e) => showError(stream, 'announcements', `/courses/${id}/announcements`, e))
      .finally(barDone);
    swr('home:posts:' + id, (t) => fetchPosts(id, false, t), (posts) => {
      postsNow = posts;
      drawStream();
    }).catch(() => {});
  }

  // ----- Pinned links under Upcoming: any course tool or URL, saved per course
  function renderLinks(box, id) {
    const key = 'links:' + id;
    const links = () => store.get(key, []);
    const draw = (animateIdx = -1) => {
      const list = links();
      box.innerHTML = `
        <div class="gcx-links-h"><span>Pinned</span><button class="gcx-links-add" type="button" aria-haspopup="dialog" aria-expanded="false">${svg('add', 18)}Add</button></div>
        <div class="gcx-links-list">${
          list.length
            ? list
                .map(
                  (l, i) => `<div class="gcx-link${i === animateIdx ? ' gcx-pop' : ''}"><a href="${esc(l.href)}">${svg(l.icon || tabIcon(l.href), 18)}<span>${esc(l.label)}</span></a>
                  <button type="button" class="gcx-link-x" data-i="${i}" title="Remove ${esc(l.label)}" aria-label="Remove ${esc(l.label)}">${svg('close', 16)}</button></div>`,
                )
                .join('')
            : '<div class="gcx-links-empty">Pin course tools you use a lot, like Instapoll or the original home page.</div>'
        }</div>`;
    };
    draw();
    box.addEventListener('click', (e) => {
      const x = e.target.closest('.gcx-link-x');
      if (x) {
        const row = x.parentElement;
        if (row.classList.contains('gcx-out')) return;
        const href = row.querySelector('a').getAttribute('href');
        const list = links();
        const at = list.findIndex((l) => l.href === href);
        if (at < 0) return;
        const [gone] = list.splice(at, 1);
        store.set(key, list);
        row.classList.add('gcx-out');
        clearTimeout(box.gcxRedraw);
        box.gcxRedraw = setTimeout(() => draw(), 180);
        toast(`Removed ${gone.label}`);
        return;
      }
      if (e.target.closest('.gcx-links-add')) openPicker(e.target.closest('.gcx-links-add'));
    });

    function openPicker(btn) {
      const base = `/courses/${id}`;
      const pinned = new Set(links().map((l) => l.href));
      const options = [
        ...courseTabs(),
        { label: 'Original Canvas home page', href: `${base}?gcx-original=1`, icon: 'home' },
        ...(hasTab(/\/modules\/?$/) ? [{ label: 'Original modules page', href: `${base}/modules?gcx-original=1`, icon: 'page' }] : []),
      ].filter((o) => o.href && o.label && !pinned.has(o.href));
      openLinkPicker(btn, options, 'Pin link', (o) => {
        const l = links();
        if (l.some((x) => x.href === o.href)) return toast(`${o.label} is already pinned`);
        l.push({ label: o.label, href: o.href, icon: o.icon });
        store.set(key, l);
        draw(l.length - 1);
        toast(`Pinned ${o.label}`);
      });
    }
  }

  // A searchable list of a course's tools and pages, plus "any link"; used to pin links on a
  // class's Home and to add shortcuts to its dashboard card. One open at a time.
  let closeLinkPicker = null;
  function openLinkPicker(btn, options, verb, onAdd) {
    if (closeLinkPicker) {
      // Its own button toggles it; anything else (a card's ⋮ › Add shortcut) opens a fresh one.
      const same = btn.getAttribute('aria-expanded') === 'true';
      closeLinkPicker();
      if (same) return;
    }
    const pop = el(`<div class="gcx-picker gcx-pop-panel" role="dialog" aria-label="${esc(verb)}">
        <div class="gcx-more-search">${svg('search', 20)}<input type="text" placeholder="Search course tools" aria-label="Search course tools" autocomplete="off"></div>
        <div class="gcx-more-list"></div>
        <form class="gcx-picker-custom">
          <div class="gcx-more-h">Or any link</div>
          <input type="text" name="label" placeholder="Name" aria-label="Link name" required>
          <input type="text" name="href" placeholder="https://… or /courses/…" aria-label="Link address" required>
          <button type="submit">${esc(verb)}</button>
        </form>
      </div>`);
    document.body.append(pop);
    const r = btn.getBoundingClientRect();
    pop.style.left = Math.max(12, Math.min(r.left, window.innerWidth - 356)) + 'px';
    pop.style.top = Math.max(12, Math.min(r.bottom + 8, window.innerHeight - pop.offsetHeight - 12)) + 'px';
    btn.setAttribute('aria-expanded', 'true');
    const input = pop.querySelector('input');
    const list = pop.querySelector('.gcx-more-list');
    const drawList = () => {
      const q = input.value.trim().toLowerCase();
      const hits = options.filter((o) => !q || o.label.toLowerCase().includes(q));
      list.innerHTML = hits.length
        ? hits.map((o, i) => `<button type="button" class="gcx-more-item${i === 0 ? ' sel' : ''}" data-i="${options.indexOf(o)}">${svg(o.icon || tabIcon(o.href), 20)}<span>${esc(o.label)}</span></button>`).join('')
        : `<div class="gcx-more-empty">${options.length ? `Nothing matches "${esc(input.value)}"` : 'Loading this class’s pages…'}</div>`;
    };
    // Options can arrive late (fetched): the caller may hand a promise.
    if (options && typeof options.then === 'function') {
      const p = options;
      options = [];
      p.then((o) => {
        options = o;
        if (pop.isConnected) drawList();
      });
    }
    drawList();
    input.focus();
    const add = (o) => {
      close();
      onAdd(o);
    };
    const close = () => {
      closeLinkPicker = null;
      pop.classList.add('gcx-out');
      btn.setAttribute('aria-expanded', 'false');
      setTimeout(() => pop.remove(), 160);
      document.removeEventListener('mousedown', outside, true);
    };
    closeLinkPicker = close;
    const outside = (e) => {
      if (!pop.contains(e.target) && !btn.contains(e.target)) close();
    };
    document.addEventListener('mousedown', outside, true);
    input.addEventListener('input', drawList);
    input.addEventListener('keydown', (e) => {
      const items = [...list.querySelectorAll('.gcx-more-item')];
      let sel = items.findIndex((n) => n.classList.contains('sel'));
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        sel = Math.max(0, Math.min(items.length - 1, sel + (e.key === 'ArrowDown' ? 1 : -1)));
        items.forEach((n, i) => n.classList.toggle('sel', i === sel));
        items[sel]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && items[sel]) {
        e.preventDefault();
        add(options[Number(items[sel].dataset.i)]);
      }
    });
    pop.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        close();
        btn.focus();
      }
    });
    list.addEventListener('click', (e) => {
      const b = e.target.closest('.gcx-more-item');
      if (b) add(options[Number(b.dataset.i)]);
    });
    pop.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      let href = f.elements.href.value.trim();
      if (!/^(https?:\/\/|\/)/i.test(href)) href = 'https://' + href;
      add({ label: f.elements.label.value.trim() || href, href });
    });
  }


  // ----- Classwork: modules as topics, each item with its grade or due status
  const dueStatus = (d, highlightSoon) =>
    d < new Date()
      ? { text: `Was due ${shortDate(d)}`, cls: '', done: false }
      : { text: dueText(d), cls: highlightSoon && dayDiff(d) <= 1 ? 'soon' : '', done: false };
  function statusOf(a, details) {
    if (a) {
      const s = a.submission || {};
      const pts = a.points_possible;
      const fmt = (n) => (Number.isInteger(n) ? n : +Number(n).toFixed(2));
      if (s.excused) return { text: 'Excused', cls: 'graded', done: true };
      if (s.workflow_state === 'graded' && s.score != null) return { text: pts ? `${fmt(s.score)}/${fmt(pts)}` : `${fmt(s.score)} pts`, cls: 'graded', done: true };
      if (s.missing) return { text: 'Missing', cls: 'missing', done: false };
      if (s.submitted_at) return { text: s.late ? 'Turned in late' : 'Turned in', cls: '', done: true };
      if (a.due_at) return dueStatus(new Date(a.due_at), true);
      return { text: pts ? `${fmt(pts)} pts` : '', cls: '', done: false };
    }
    if (details && details.due_at) return dueStatus(new Date(details.due_at), false);
    return { text: '', cls: '', done: false };
  }
  const KIND_ICON = { Assignment: 'assignment', Quiz: 'quiz', Discussion: 'discussion', File: 'file', Page: 'page', ExternalUrl: 'link', ExternalTool: 'tool' };

  function rowHtml(r, i = 0) {
    const st = statusOf(r.a, r.details);
    const locked = r.details && r.details.locked_for_user;
    const sub = r.details && r.details.lock_explanation && locked ? htmlText(r.details.lock_explanation) : '';
    const pad = r.indent ? `padding-left:${16 + r.indent * 20}px;` : '';
    const host = r.ext ? hostOf(r.url) : '';
    return `<a class="gcx-row${st.done || r.kind === 'File' || r.kind === 'Page' ? ' done' : ''}${locked ? ' locked' : ''}" href="${esc(r.url)}"${
      r.fileId ? ` data-gcx-file="${esc(r.fileId)}" data-gcx-course="${COURSE_ID}"` : ''
    }${r.ext ? ` target="_blank" rel="noopener noreferrer" data-gcx-ext="1"${r.track ? ` data-gcx-track="${esc(r.track)}"` : ''}` : ''}${
      r.a && r.a.id ? ` data-aid="${esc(r.a.id)}"` : ''
    } data-q="${esc(
      r.title.toLowerCase(),
    )}" style="${pad}--i:${Math.min(i, 12)}">
      <span class="gcx-row-ic">${!locked && r.kind === 'File' ? fileTile(r.title, 34) : svg(locked ? 'lock' : KIND_ICON[r.kind] || 'link', 20)}</span>
      <span class="gcx-row-main"><span class="gcx-row-title">${esc(r.title)}</span>${sub ? `<span class="gcx-row-sub">${esc(sub)}</span>` : ''}</span>
      <span class="gcx-row-meta ${st.cls}">${host ? `${esc(host)}${svg('open', 14)}` : esc(r.meta != null ? r.meta : st.text)}</span></a>`;
  }
  const hostOf = (u) => {
    try {
      return new URL(u).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  };

  // Hovering a web link shows a small card by the cursor: favicon, title and domain (and a
  // thumbnail for YouTube). Titles come from the course itself; nothing is fetched from the site.
  let linkCard = null;
  let linkTimer = 0;
  const ytId = (u) => {
    try {
      const x = new URL(u);
      if (/(^|\.)youtu\.be$/.test(x.hostname)) return x.pathname.slice(1).split('/')[0];
      if (/(^|\.)youtube\.com$/.test(x.hostname)) return x.searchParams.get('v') || (x.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{6,})/) || [])[1] || '';
    } catch {}
    return '';
  };
  let lastPointer = null;
  function showLinkCard(a, ev) {
    if (!a.matches(':hover')) return;
    // Not while the page itself is still loading.
    if (document.readyState !== 'complete') {
      addEventListener('load', () => showLinkCard(a, lastPointer || ev), { once: true });
      return;
    }
    const url = a.href;
    const host = hostOf(url);
    if (!host) return;
    const title = (a.querySelector('.gcx-row-title') || a).textContent.trim();
    const yt = ytId(url);
    if (!linkCard) {
      linkCard = el('<div class="gcx-linkcard" role="tooltip"></div>');
      document.body.append(linkCard);
    }
    linkCard.innerHTML = `${yt ? `<div class="gcx-lc-thumb"><img alt="" src="https://i.ytimg.com/vi/${esc(yt)}/mqdefault.jpg"><span>${svg('play', 28)}</span></div>` : ''}
      <div class="gcx-lc-row"><span class="gcx-lc-fav"><img alt="" src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64"></span>
      <span class="gcx-lc-tx"><b></b><small></small></span>${svg('open', 16)}</div>`;
    linkCard.querySelector('b').textContent = title || host;
    linkCard.querySelector('small').textContent = host;
    // No favicon (or a blocked image): fall back to a plain link icon; a failed thumbnail just goes.
    linkCard.querySelector('.gcx-lc-fav img').addEventListener('error', (e) => (e.target.parentElement.innerHTML = svg('link', 18)), { once: true });
    linkCard.querySelector('.gcx-lc-thumb img')?.addEventListener('error', (e) => e.target.parentElement.remove(), { once: true });
    // Only appear once the favicon (and thumbnail) have arrived, so it never pops in half-built.
    const imgs = [...linkCard.querySelectorAll('img')];
    const settled = (img) =>
      img.complete
        ? null
        : new Promise((r) => {
            img.addEventListener('load', r, { once: true });
            img.addEventListener('error', r, { once: true });
          });
    const ready = Promise.all(imgs.map(settled));
    const card = linkCard;
    const token = (card.dataset.token = String(Math.random()));
    Promise.race([ready, new Promise((r) => setTimeout(r, 900))]).then(() => {
      if (card.dataset.token !== token || !a.matches(':hover')) return;
      card.classList.add('show');
      moveLinkCard(lastPointer || ev);
    });
  }
  function moveLinkCard(ev) {
    if (!linkCard || !linkCard.classList.contains('show')) return;
    const w = linkCard.offsetWidth;
    const h = linkCard.offsetHeight;
    // Centered under the pointer, flipping above it near the bottom of the window.
    const x = Math.min(Math.max(8, ev.clientX - w / 2), innerWidth - w - 8);
    let y = ev.clientY + 16;
    if (y + h > innerHeight - 8) y = ev.clientY - h - 12;
    linkCard.style.transform = `translate(${x}px, ${Math.max(8, y)}px)`;
  }
  const hideLinkCard = () => {
    clearTimeout(linkTimer);
    linkTimer = 0;
    if (linkCard) {
      linkCard.dataset.token = '';
      linkCard.classList.remove('show');
    }
  };
  document.addEventListener('pointerover', (e) => {
    const a = e.target.closest && e.target.closest('a[data-gcx-ext]');
    if (!a) {
      if (linkCard || linkTimer) hideLinkCard();
      return;
    }
    if (e.relatedTarget && a.contains(e.relatedTarget)) return;
    clearTimeout(linkTimer);
    // A deliberate pause first: the card is for when he's lingering, not passing over.
    linkTimer = setTimeout(() => showLinkCard(a, lastPointer || e), 800);
  });
  document.addEventListener('pointerout', (e) => {
    const a = e.target.closest && e.target.closest('a[data-gcx-ext]');
    if (a && !(e.relatedTarget && a.contains(e.relatedTarget))) hideLinkCard();
  });
  document.addEventListener(
    'pointermove',
    (e) => {
      if (!linkTimer && !linkCard) return;
      lastPointer = e;
      if (linkCard) moveLinkCard(e);
    },
    { passive: true },
  );
  document.addEventListener('scroll', hideLinkCard, { passive: true, capture: true });
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[data-gcx-track]');
    if (!a) return;
    hideLinkCard();
    fetch(a.dataset.gcxTrack, { credentials: 'same-origin' }).catch(() => {});
  });
  const htmlText = (markup) => new DOMParser().parseFromString(markup, 'text/html').body.textContent.trim();
  const collapse = (inner) => `<div class="gcx-collapse"><div class="gcx-collapse-in">${inner}</div></div>`;
  // A collapsible subgroup (module text headers, file folders).
  const subHtml = (key, title, count, inner, closed, icon = 'folder') =>
    `<div class="gcx-sub${closed ? ' closed' : ''}" data-k="${esc(key)}"><button class="gcx-sub-h" type="button" aria-expanded="${!closed}">${svg(icon, 20)}<span class="gcx-sub-t">${esc(
      title,
    )}</span><span class="gcx-count">${count || ''}</span>${svg('chevron', 20)}</button>${collapse(inner)}</div>`;

  // Rows after a module's text header belong to that header, so each header becomes a subgroup.
  function topicRowsHtml(rows, keyBase, closedSet) {
    const out = [];
    let cur = null;
    let n = 0;
    const flush = () => {
      if (!cur) return;
      const key = `${keyBase}/${cur.title}`;
      // The subgroup already shows the nesting, so drop the first level of Canvas indent.
      out.push(subHtml(key, cur.title, cur.rows.length, cur.rows.map((r, i) => rowHtml({ ...r, indent: Math.max(0, (r.indent || 0) - 1) }, i)).join('') || '<div class="gcx-empty">Nothing here yet.</div>', closedSet.has(key), 'list'));
      cur = null;
    };
    for (const r of rows) {
      if (r.header) {
        flush();
        cur = { title: r.header, rows: [] };
      } else if (cur) cur.rows.push(r);
      else out.push(rowHtml(r, n++));
    }
    flush();
    return out.join('');
  }

  // Canvas data trimmed to what Classwork draws, so it caches small.
  async function fetchClasswork(id, strict = false, tally) {
    const [mods, groups] = await Promise.all([
      api(`/courses/${id}/modules?include[]=items&include[]=content_details&per_page=50`, true).catch(softFail(strict, null, tally)),
      api(`/courses/${id}/assignment_groups?include[]=assignments&include[]=submission&include[]=discussion_topic&per_page=50`, true).catch(softFail(strict, null, tally)),
    ]);
    if (!mods && !groups) throw new Error('Canvas returned nothing');
    // Big modules come back without inline items.
    await Promise.all(
      (mods || [])
        .filter((m) => !m.items && m.items_url)
        .map(async (m) => {
          m.items = await api(`${m.items_url}${m.items_url.includes('?') ? '&' : '?'}include[]=content_details&per_page=100`, true).catch(softFail(strict, [], tally));
        }),
    );
    const sub = (s) =>
      s && { excused: !!s.excused, workflow_state: s.workflow_state, score: s.score, missing: !!s.missing, submitted_at: s.submitted_at, late: !!s.late };
    return {
      mods:
        mods &&
        mods.map((m) => ({
          name: m.name,
          state: m.state,
          items: (m.items || []).map((it) => ({
            type: it.type,
            title: it.title,
            html_url: it.html_url,
            external_url: it.external_url,
            indent: it.indent || 0,
            content_id: it.content_id,
            content_details: it.content_details && {
              due_at: it.content_details.due_at,
              locked_for_user: it.content_details.locked_for_user,
              lock_explanation: it.content_details.lock_explanation,
            },
          })),
        })),
      groups: (groups || []).map((g) => ({
        name: g.name,
        assignments: (g.assignments || []).map((a) => ({
          id: a.id,
          name: a.name,
          html_url: a.html_url,
          due_at: a.due_at,
          points_possible: a.points_possible,
          quiz_id: a.quiz_id,
          // For the in-place preview on Classwork.
          description: a.description || '',
          created_at: a.created_at,
          unlock_at: a.unlock_at,
          discussion_topic: a.discussion_topic ? { id: a.discussion_topic.id } : null,
          submission: sub(a.submission),
        })),
      })),
    };
  }
  async function fetchFiles(id, tally) {
    const [files, folders] = await Promise.all([
      api(`/courses/${id}/files?per_page=100&sort=updated_at&order=desc`, true),
      api(`/courses/${id}/folders?per_page=100`, true).catch(softFail(false, [], tally)),
    ]);
    return {
      folders: folders.map((f) => ({ id: f.id, path: f.full_name })),
      files: files.map((f) => ({ id: f.id, name: f.display_name, folder: f.folder_id, updated: f.updated_at, locked: !!f.locked_for_user })),
    };
  }
  const hasTab = (re) => courseTabs().some((t) => re.test(t.href));
  const courseHasFiles = (id) => {
    if (id === COURSE_ID) return hasTab(/\/files\/?$/);
    const tabs = store.get('tabs:' + id, []);
    return !tabs.length || tabs.some((t) => /\/files\/?$/.test(t.href));
  };

  // Every class's Home and Classwork data is kept warm in the background, so opening any class
  // draws at once from the saved copy (and still refreshes if anything changed).
  const WARM_EVERY = 10 * 6e4;
  async function warmCourses() {
    // One pass at a time across tabs; each key below is skipped if it's fresh, so a pass cut short
    // by leaving the page picks up where it stopped on the next page.
    if (Date.now() - store.get('warmedAt', 0) < 6e4) return;
    // Leaving the page mid-pass frees the next page to carry on right away (see pagehide).
    store.set('warmedAt', (warmStamp = Date.now()));
    try {
      await warmPass();
    } finally {
      warmStamp = 0;
    }
  }
  async function warmPass() {
    const courses = await coursesReady.catch(() => null);
    for (const c of courses || []) {
      if (document.hidden) await new Promise((r) => document.addEventListener('visibilitychange', r, { once: true }));
      const jobs = [
        ['home:upc:' + c.id, () => planner(-HORIZON_DAYS, HORIZON_DAYS, c.id)],
        ['home:ann:' + c.id, () => fetchAnns(c.id)],
        ['home:posts:' + c.id, () => fetchPosts(c.id, true)],
        ['cw:' + c.id, () => fetchClasswork(c.id, true)],
      ];
      await Promise.all(
        jobs.map(async ([key, fetcher]) => {
          if (Date.now() - fetchedAt(key) < WARM_EVERY) return;
          claim(key); // now, so the page's own prefetch doesn't fetch it too
          let d;
          try {
            d = JSON.parse(JSON.stringify(await fetcher()));
          } catch (e) {
            release(key, false);
            throw e;
          }
          release(key, true);
          const ent = await cache.entry(key); // after the fetch: the page may have saved a copy meanwhile
          if (!ent || sansTokens(JSON.stringify(ent.d)) !== sansTokens(JSON.stringify(d)) || Date.now() - ent.t > 864e5) cache.set(key, d);
        }).map((p) => p.catch(() => {})),
      );
    }
  }

  // Pressing on a class (rail, class card) starts building its page before the click completes,
  // and the class he was in just before this one is built ahead of time outright, so going back
  // and forth between two classes is instant. Not on hover: Canvas would log a visit to every
  // class he passed over.
  const LAST_CLASS = 'gcx:lastClass'; // this tab's last class (sessionStorage: per tab)
  const AHEAD_MS = 5 * 60 * 1000; // a page built ahead goes stale; after this it waits for a press
  // Returns the class this tab was in before, and makes this one the last.
  function markClass() {
    let prev = null;
    try {
      prev = Number(sessionStorage.getItem(LAST_CLASS)) || null;
      if (COURSE_ID) sessionStorage.setItem(LAST_CLASS, String(COURSE_ID));
    } catch {}
    return prev;
  }
  addEventListener('pageshow', (e) => e.persisted && markClass()); // back to a page kept in memory
  function buildBackAhead() {
    const back = markClass();
    // Only on the home page he just switched to from another class: building a page ahead is a
    // full Canvas page load (and a visit in Canvas's logs), so not on every page he opens.
    if (!COURSE_ID || VIEW !== 'home' || !back || back === COURSE_ID) return;
    if (!(COURSES || []).some((c) => c.id === back)) return;
    const ahead = document.createElement('script');
    ahead.type = 'speculationrules';
    ahead.textContent = JSON.stringify({ prerender: [{ source: 'list', urls: [`/courses/${back}`], eagerness: 'immediate' }] });
    document.head.append(ahead);
    setTimeout(() => ahead.remove(), AHEAD_MS);
  }
  function prefetchCoursePages() {
    if (!HTMLScriptElement.supports || !HTMLScriptElement.supports('speculationrules')) return;
    // A page that is itself being built ahead counts as visited (and builds its own) only once he
    // actually arrives on it.
    if (document.prerendering)
      document.addEventListener(
        'prerenderingchange',
        () => {
          // Built ahead long ago (a press-built page can outlive the 5 minutes): load it fresh.
          if (performance.now() > AHEAD_MS + 60000) return location.reload();
          buildBackAhead();
        },
        { once: true },
      );
    else buildBackAhead();
    const s = document.createElement('script');
    s.type = 'speculationrules';
    s.textContent = JSON.stringify({
      prefetch: [
        {
          source: 'document',
          where: {
            or: [
              {
                and: [
                  { href_matches: '/courses/*' },
                  { selector_matches: '#gcx-rail a.gcx-ri-course, #gcx-cbar a.gcx-tab, .ic-DashboardCard__link, .ic-DashboardCard a.gcx-card-ov' },
                  { not: { href_matches: '/courses/*/files/*' } },
                ],
              },
              { selector_matches: '#gcx-rail a.gcx-ri[href="/"], #gcx-rail a.gcx-ri[href="/?gcx=todo"]' },
            ],
          },
          eagerness: 'conservative',
        },
      ],
      // This class's own tabs load in full while the pointer rests on them, so switching tabs
      // starts sliding the moment he clicks, with the real page (not one still loading). Another
      // class starts building in full as soon as he presses on it.
      prerender: [
        {
          source: 'document',
          where: { and: [{ href_matches: '/courses/*' }, { selector_matches: '#gcx-cbar a.gcx-tab:not(.on)' }] },
          eagerness: 'moderate',
        },
        {
          source: 'document',
          where: {
            and: [
              { href_matches: '/courses/*' },
              { selector_matches: '#gcx-rail a.gcx-ri-course:not(.on), .ic-DashboardCard__link, .ic-DashboardCard a.gcx-card-ov' },
              { not: { href_matches: '/courses/*/*' } },
            ],
          },
          eagerness: 'conservative',
        },
      ],
    });
    document.head.append(s);
  }

  // Warm the Classwork cache while he's on any other page of the course.
  function prefetchClasswork(id) {
    const go = async () => {
      if (Date.now() - fetchedAt('cw:' + id) < WARM_EVERY) return;
      claim('cw:' + id);
      fetchClasswork(id, true)
        .then((d) => {
          release('cw:' + id, true);
          cache.set('cw:' + id, JSON.parse(JSON.stringify(d)));
        })
        .catch(() => release('cw:' + id, false));
      if (hasTab(/\/files\/?$/)) fetchFiles(id).then((d) => cache.set('cwf:' + id, d)).catch(() => {});
    };
    (window.requestIdleCallback || setTimeout)(go, { timeout: 2500 });
  }

  function buildTopics(data) {
    const { mods, groups } = data;
    const assigns = groups.flatMap((g) => g.assignments || []);
    const byId = new Map(assigns.map((a) => [a.id, a]));
    const byQuiz = new Map(assigns.filter((a) => a.quiz_id).map((a) => [a.quiz_id, a]));
    const byDisc = new Map(assigns.filter((a) => a.discussion_topic).map((a) => [a.discussion_topic.id, a]));
    const byTitle = new Map(assigns.map((a) => [a.name.trim().toLowerCase(), a]));
    const used = new Set();
    const topics = [];
    for (const m of mods || []) {
      const rows = [];
      for (const it of m.items || []) {
        if (it.type === 'SubHeader') {
          rows.push({ header: it.title });
          continue;
        }
        let a = null;
        if (it.type === 'Assignment') a = byId.get(it.content_id);
        else if (it.type === 'Quiz') a = byQuiz.get(it.content_id);
        else if (it.type === 'Discussion') a = byDisc.get(it.content_id) || byTitle.get(String(it.title).trim().toLowerCase());
        if (a) used.add(a.id);
        rows.push({
          kind: it.type,
          title: it.title,
          // Web links open the site itself in a new tab; Canvas's module-item URL is pinged
          // alongside so "view this" requirements still count.
          url: (it.type === 'ExternalUrl' && it.external_url) || it.html_url || it.external_url || '#',
          ext: it.type === 'ExternalUrl' && !!it.external_url,
          track: it.type === 'ExternalUrl' ? it.html_url : null,
          indent: it.indent || 0,
          a,
          details: it.content_details,
          fileId: it.type === 'File' ? it.content_id : null,
        });
      }
      topics.push({ name: m.name, key: 'm:' + m.name, rows, tag: m.state === 'locked' ? 'Locked' : '' });
    }
    const kindOf = (a) => (a.quiz_id ? 'Quiz' : a.discussion_topic ? 'Discussion' : 'Assignment');
    for (const g of groups) {
      const rows = (g.assignments || [])
        .filter((a) => !used.has(a.id))
        .sort((x, y) => (x.due_at ? Date.parse(x.due_at) : Infinity) - (y.due_at ? Date.parse(y.due_at) : Infinity))
        .map((a) => ({ kind: kindOf(a), title: a.name, url: a.html_url, a }));
      if (rows.length) topics.push({ name: g.name, key: 'g:' + g.name, rows, tag: mods && mods.length ? 'Not in a module' : '' });
    }
    if (hasTab(/\/files\/?$/)) topics.push({ name: 'All course files', rows: [], files: true });
    const missing = assigns.filter((a) => a.submission && a.submission.missing).length;
    const weekEnd = weekStart(1);
    const dueThisWeek = assigns.filter((a) => {
      const s = a.submission || {};
      const d = a.due_at && new Date(a.due_at);
      return d && d >= new Date() && d < weekEnd && !s.submitted_at && !s.excused;
    }).length;
    return { topics, missing, dueThisWeek };
  }

  // Files grouped by folder, folders nested like Canvas's file tree.
  function filesTreeHtml(id, data, closedSet) {
    const pathOf = new Map(data.folders.map((f) => [f.id, f.path.replace(/^course files\/?/i, '')]));
    const root = { name: '', kids: new Map(), files: [] };
    for (const f of data.files) {
      let node = root;
      for (const part of (pathOf.get(f.folder) || '').split('/').filter(Boolean)) {
        if (!node.kids.has(part)) node.kids.set(part, { name: part, kids: new Map(), files: [] });
        node = node.kids.get(part);
      }
      node.files.push(f);
    }
    const count = (n) => n.files.length + [...n.kids.values()].reduce((s, k) => s + count(k), 0);
    const row = (f, i) =>
      rowHtml(
        { kind: 'File', title: f.name, url: `/courses/${id}/files/${f.id}`, fileId: f.id, details: { locked_for_user: f.locked }, meta: shortDate(new Date(f.updated)) },
        i,
      );
    const draw = (node, path) =>
      [...node.kids.values()]
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
        .map((k) => {
          const key = `files/${path}${k.name}`;
          // Folders start closed unless he opened them before.
          return subHtml(key, k.name, count(k), draw(k, `${path}${k.name}/`), !closedSet.has('open:' + key), 'folder');
        })
        .join('') + node.files.map(row).join('');
    return draw(root, '') || '<div class="gcx-empty">No files.</div>';
  }

  const gradeChip = (c) => `${svg('grade', 20)}${c && c.score != null ? `Grade · ${esc(c.letter ? c.letter + ' · ' : '')}${esc(+c.score.toFixed(2))}%` : 'Grades'}`;
  async function renderClasswork(view, cPromise) {
    const id = COURSE_ID;
    view.innerHTML = `<div class="gcx-cw-head">${skeleton(1)}</div><div class="gcx-card gcx-pad">${skeleton(6)}</div>`;
    // Remembered open/closed state for topics, subgroups and folders.
    const closedKey = 'cwstate:' + id;
    const closedSet = new Set(store.get(closedKey, []));
    const saveClosed = () => store.set(closedKey, [...closedSet].slice(-300));
    let filesData = null;
    let drawn = false;
    let c = COURSES && COURSES.find((x) => x.id === id);

    let lastData = null;
    const draw = (data, fromCache) => {
      lastData = data;
      const openAid = drawn ? view.querySelector('.gcx-row.gcx-pv-on')?.dataset.aid : null;
      const { topics, missing, dueThisWeek } = buildTopics(data);
      const scrollY = window.scrollY;
      const oldInput = drawn ? view.querySelector('.gcx-filter input') : null;
      const q = oldInput ? oldInput.value : '';
      const typing = oldInput && document.activeElement === oldInput ? [oldInput.selectionStart, oldInput.selectionEnd] : null;
      view.innerHTML = `
      <div class="gcx-cw-head">
        <a class="gcx-chip" href="/courses/${id}/grades">${gradeChip(c)}</a>
        ${missing ? `<span class="gcx-chip warn">${missing} missing</span>` : ''}
        ${dueThisWeek ? `<span class="gcx-chip">${dueThisWeek} due this week</span>` : ''}
        <span class="gcx-sync" ${fromCache ? '' : 'hidden'}>${svg('sync', 18)}Updating</span>
        <label class="gcx-filter">${svg('search', 18)}<input type="text" placeholder="Filter classwork" aria-label="Filter classwork"></label>
      </div>
      <div class="gcx-cw">
        <nav class="gcx-toc" aria-label="Topics">${topics.map((t, i) => `<a href="#gcx-t${i}">${esc(t.name)}</a>`).join('')}</nav>
        <div class="gcx-topics">${
          topics.length
            ? topics
                .map((t, i) => {
                  const closed = t.files ? !closedSet.has('open:files') : closedSet.has(t.key);
                  return `<section class="gcx-topic${closed ? ' closed' : ''}${t.files ? ' gcx-files-topic' : ''}" id="gcx-t${i}" data-k="${esc(t.files ? 'files' : t.key)}" style="--i:${Math.min(i, 8)}">
            <button class="gcx-topic-h" type="button" aria-expanded="${!closed}"><h2>${esc(t.name)}</h2>${t.tag ? `<span class="gcx-topic-tag">${esc(t.tag)}</span>` : ''}<span class="gcx-count">${
              t.files ? '' : t.rows.filter((r) => !r.header).length || ''
            }</span>${svg('chevron')}</button>
            <div class="gcx-topic-rows gcx-collapse"><div class="gcx-collapse-in">${
              t.files
                ? `<div class="gcx-files-slot">${filesData ? filesTreeHtml(id, filesData, closedSet) : `<div class="gcx-pad">${skeleton(3)}</div>`}</div>`
                : topicRowsHtml(t.rows, t.key, closedSet) || '<div class="gcx-empty">Nothing here yet.</div>'
            }</div></div></section>`;
                })
                .join('')
            : '<div class="gcx-card gcx-empty">This course has no modules or assignments yet.</div>'
        }</div>
      </div>`;
      if (!drawn && waited()) view.querySelector('.gcx-cw').classList.add('gcx-stagger');
      else window.scrollTo(0, scrollY);
      drawn = true;
      wire();
      const reopen = openAid && view.querySelector(`.gcx-row[data-aid="${CSS.escape(openAid)}"]`);
      if (q) {
        const input = view.querySelector('.gcx-filter input');
        input.value = q;
        input.dispatchEvent(new Event('input'));
      }
      if (reopen && reopen.style.display !== 'none') togglePreview(reopen, true);
      if (typing) {
        const input = view.querySelector('.gcx-filter input');
        input.focus({ preventScroll: true });
        input.setSelectionRange(...typing);
      }
      const filesTopic = view.querySelector('.gcx-files-topic');
      if (filesTopic && !filesTopic.classList.contains('closed')) loadFiles();
    };

    function loadFiles() {
      if (loadFiles.started) return;
      loadFiles.started = true;
      swr(
        'cwf:' + id,
        (t) => fetchFiles(id, t),
        (d) => {
          filesData = d;
          const slot = view.querySelector('.gcx-files-slot');
          if (slot) swapIn(slot, filesTreeHtml(id, d, closedSet));
        },
      ).catch(() => {
        const slot = view.querySelector('.gcx-files-slot');
        if (slot) slot.innerHTML = `<div class="gcx-pad">Files aren't available here. <a href="/courses/${id}/files" style="color:var(--gcx-link)">Open the Files page</a></div>`;
      });
    }

    // Clicking an assignment opens it in place, like Classroom: when it was posted, the
    // instructions, its files and a way into the full page. Everything comes from the classwork
    // data already on hand, so it opens at once. Ctrl/middle-click still opens the page.
    const findAssignment = (aid) => {
      for (const g of (lastData && lastData.groups) || []) for (const a of g.assignments || []) if (String(a.id) === aid) return a;
      return null;
    };
    function previewHtml(a, href) {
      const posted = [a.unlock_at, a.created_at].filter(Boolean).map(Date.parse).filter((t) => t <= Date.now());
      const when = posted.length ? `Posted ${shortDate(new Date(Math.max(...posted)))}` : '';
      const pts = a.points_possible ? `${+a.points_possible} point${a.points_possible === 1 ? '' : 's'}` : '';
      const body = a.description && a.description.trim() ? cleanHtml(a.description) : '';
      const doc = new DOMParser().parseFromString(body, 'text/html');
      const files = [];
      const seen = new Set();
      for (const link of doc.querySelectorAll('a[href]')) {
        const m = link.getAttribute('href').match(/(?:\/courses\/(\d+))?\/files\/(\d+)/);
        if (!m || seen.has(m[2])) continue;
        seen.add(m[2]);
        files.push({ id: m[2], course: m[1] || COURSE_ID, name: (link.getAttribute('title') || link.textContent || 'File').replace(/\s+/g, ' ').trim() });
      }
      const label = a.quiz_id ? 'View quiz' : a.discussion_topic ? 'View discussion' : 'View assignment';
      return `<div class="gcx-pv-in">
        <div class="gcx-pv-meta">${esc([when, pts].filter(Boolean).join(' · '))}</div>
        ${body ? `<div class="gcx-pv-desc">${body}</div>` : '<div class="gcx-pv-desc gcx-pv-none">No instructions.</div>'}
        ${
          files.length
            ? `<div class="gcx-pv-files">${files
                .map(
                  (f) =>
                    `<a class="gcx-post-file" href="/courses/${esc(f.course)}/files/${esc(f.id)}" data-gcx-file="${esc(f.id)}" data-gcx-course="${esc(f.course)}">${fileTile(f.name, 20)}<span>${esc(f.name)}</span></a>`,
                )
                .join('')}</div>`
            : ''
        }
        <div class="gcx-pv-foot"><a class="gcx-pv-open" href="${esc(href)}">${label}</a></div>
      </div>`;
    }
    function togglePreview(row, instant = false) {
      const open = view.querySelector('.gcx-row.gcx-pv-on');
      const close = (r) => {
        r.classList.remove('gcx-pv-on');
        r.setAttribute('aria-expanded', 'false');
        const pv = r.nextElementSibling;
        if (!pv || !pv.classList.contains('gcx-pv')) return;
        pv.classList.remove('open');
        setTimeout(() => pv.remove(), 260);
      };
      if (open) close(open);
      if (open === row) return;
      const a = findAssignment(row.dataset.aid);
      if (!a) return (location.href = row.href);
      const pv = el(`<div class="gcx-pv" role="region" aria-label="${esc(a.name)}">${previewHtml(a, row.href)}</div>`);
      fixInlineColors(pv);
      pv.querySelectorAll('.gcx-pv-desc img').forEach((img) => img.addEventListener('error', () => img.remove(), { once: true }));
      row.after(pv);
      row.classList.add('gcx-pv-on');
      row.setAttribute('aria-expanded', 'true');
      if (instant) pv.style.transition = 'none';
      void pv.offsetWidth;
      pv.classList.add('open');
    }

    function wire() {
      // Assignment rows open in place; their "View" link goes to the page.
      view.querySelector('.gcx-topics').addEventListener('click', (e) => {
        if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const row = e.target.closest('.gcx-row[data-aid]');
        if (!row || row.classList.contains('locked')) return;
        e.preventDefault();
        togglePreview(row);
      });
      // Topic, subgroup and folder headers all toggle the same way.
      view.querySelector('.gcx-topics').addEventListener('click', (e) => {
        const h = e.target.closest('.gcx-topic-h, .gcx-sub-h');
        if (!h) return;
        const box = h.parentElement;
        const nowClosed = box.classList.toggle('closed');
        h.setAttribute('aria-expanded', String(!nowClosed));
        const k = box.dataset.k;
        // Folders and the files topic default to closed, so remember the opened ones instead.
        if (k === 'files' || k.startsWith('files/')) nowClosed ? closedSet.delete('open:' + k) : closedSet.add('open:' + k);
        else nowClosed ? closedSet.add(k) : closedSet.delete(k);
        saveClosed();
        if (k === 'files' && !nowClosed) loadFiles();
      });

      // Filter rows by title; subgroups and topics with nothing left disappear.
      const filter = view.querySelector('.gcx-filter input');
      filter.addEventListener('input', () => {
        const openRow = view.querySelector('.gcx-row.gcx-pv-on');
        if (openRow) togglePreview(openRow);
        const q = filter.value.trim().toLowerCase();
        view.classList.toggle('gcx-filtering', !!q);
        view.querySelectorAll('.gcx-topic').forEach((sec, i) => {
          const tocLink = view.querySelector(`.gcx-toc a[href="#gcx-t${i}"]`);
          if (sec.classList.contains('gcx-files-topic')) {
            sec.style.display = q ? 'none' : '';
            if (tocLink) tocLink.style.display = q ? 'none' : '';
            return;
          }
          let any = !q;
          sec.querySelectorAll('.gcx-row').forEach((r) => {
            const hit = !q || (r.dataset.q || '').includes(q);
            r.style.display = hit ? '' : 'none';
            any = any || hit;
          });
          sec.querySelectorAll('.gcx-sub').forEach((s) => {
            s.style.display = !q || [...s.querySelectorAll('.gcx-row')].some((r) => r.style.display !== 'none') ? '' : 'none';
          });
          sec.style.display = any ? '' : 'none';
          if (tocLink) tocLink.style.display = any ? '' : 'none';
        });
      });

      // Highlight the topic in view.
      const tocLinks = [...view.querySelectorAll('.gcx-toc a')];
      if (view.gcxIo) view.gcxIo.disconnect();
      const io = (view.gcxIo = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            tocLinks.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
          }
        },
        { rootMargin: '-90px 0px -70% 0px' },
      ));
      view.querySelectorAll('.gcx-topic').forEach((s) => io.observe(s));
      tocLinks.forEach((a) =>
        a.addEventListener('click', (e) => {
          e.preventDefault();
          const sec = view.querySelector(a.getAttribute('href'));
          if (sec.classList.contains('closed')) sec.querySelector('.gcx-topic-h').click();
          sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }),
      );
    }

    filesData = await cache.get('cwf:' + id);
    cPromise.then((cc) => {
      c = cc;
      view.style.setProperty('--c', cc.color);
      const chip = view.querySelector('.gcx-cw-head .gcx-chip');
      if (chip) chip.innerHTML = gradeChip(cc);
    });
    if (c) view.style.setProperty('--c', c.color);
    try {
      barStart();
      await swr('cw:' + id, (t) => fetchClasswork(id, false, t), (d, fromCache) => {
        draw(d, fromCache);
        barDone();
      });
      const badge = view.querySelector('.gcx-sync');
      if (badge) badge.hidden = true;
    } catch (e) {
      barDone();
      return showError(view, 'classwork', hasTab(/\/modules\/?$/) ? `/courses/${id}/modules?gcx-original=1` : `/courses/${id}?gcx-original=1`, e);
    }
  }


  // ----- To-do: every course's work in Assigned / Missing / Done
  async function renderTodo(view) {
    const params = new URLSearchParams(location.search);
    let tab = ['assigned', 'missing', 'done'].includes(params.get('tab')) ? params.get('tab') : 'assigned';
    let courseFilter = params.get('course') || '';
    view.innerHTML = `
      <div class="gcx-todo-head"><h1>To-do</h1><span class="gcx-sync" hidden>${svg('sync', 18)}Updating</span><select class="gcx-select" aria-label="Class"><option value="">All classes</option></select></div>
      <div class="gcx-seg" role="tablist">
        <button type="button" role="tab" data-tab="assigned">Assigned<span class="gcx-n"></span></button>
        <button type="button" role="tab" data-tab="missing">Missing<span class="gcx-n"></span></button>
        <button type="button" role="tab" data-tab="done">Done<span class="gcx-n"></span></button>
        <span class="gcx-seg-ink"></span>
      </div>
      <div class="gcx-todo-body"><div class="gcx-card">${skeleton(6)}</div></div>`;
    document.title = 'To-do';

    const courses = COURSES || (await coursesReady);
    const colorOf = new Map(courses.map((c) => [c.id, c.color]));
    const nameOf = new Map(courses.map((c) => [c.id, prettyName(c)]));
    const select = view.querySelector('select');
    select.insertAdjacentHTML('beforeend', courses.map((c) => `<option value="${c.id}">${esc(prettyName(c))}</option>`).join(''));
    select.value = courseFilter;
    if (select.value !== courseFilter) courseFilter = '';

    const fetchItems = async (tally) => {
      const list = await coursesReady;
      const [dated, undated] = await Promise.all([
        planner(-120, 120),
        Promise.all(
          list.map((c) =>
            api(`/courses/${c.id}/assignments?bucket=undated&include[]=submission&per_page=100`, true)
              // Undated tools, polls and grade placeholders aren't work; keep things you can hand in.
              .then((l) =>
                l
                  .filter((a) => (a.submission_types || []).some((t) => /^online_|^discussion_topic$/.test(t)))
                  .map((a) => normAssignment(a, c)),
              )
              .catch(softFail(false, [], tally)),
          ),
        ).then((x) => x.flat()),
      ]);
      const seen = new Set();
      return [...dated, ...undated].filter((i) => !seen.has(i.key) && seen.add(i.key));
    };

    const thisWeek = weekStart(0);
    const nextWeek = weekStart(1);
    const weekAfter = weekStart(2);
    const lastWeek = weekStart(-1);
    const bucketsFor = {
      assigned: [
        ['This week', (i) => i.due && i.due < nextWeek],
        ['Next week', (i) => i.due && i.due >= nextWeek && i.due < weekAfter],
        ['Later', (i) => i.due && i.due >= weekAfter],
        ['No due date', (i) => !i.due],
      ],
      missing: [
        ['Upcoming', (i) => i.due && i.due >= nextWeek],
        ['This week', (i) => i.due && i.due >= thisWeek && i.due < nextWeek],
        ['Last week', (i) => i.due && i.due >= lastWeek && i.due < thisWeek],
        ['Earlier', (i) => i.due && i.due < lastWeek],
        ['No due date', (i) => !i.due],
      ],
      done: [
        ['No due date', (i) => !i.due],
        ['Upcoming', (i) => i.due && i.due >= nextWeek],
        ['This week', (i) => i.due && i.due >= thisWeek && i.due < nextWeek],
        ['Last week', (i) => i.due && i.due >= lastWeek && i.due < thisWeek],
        ['Earlier', (i) => i.due && i.due < lastWeek],
      ],
    };
    const inTab = {
      assigned: (i) => !i.done && !i.missing,
      missing: (i) => i.missing,
      done: (i) => i.done,
    };
    const meta = (i) => {
      if (tab === 'missing') {
        const when = i.due ? ` · ${shortDate(i.due)}` : '';
        return i.flagged ? { text: `Missing${when}`, cls: 'missing' } : { text: `Past due${when}`, cls: '' };
      }
      if (tab === 'done') return { text: i.graded ? 'Graded' : i.submitted ? (i.late ? 'Turned in late' : 'Turned in') : 'Done', cls: i.graded ? 'graded' : '' };
      if (!i.due) return { text: '', cls: '' };
      return { text: dueText(i.due), cls: dayDiff(i.due) <= 1 ? 'soon' : '' };
    };

    const TABS = ['assigned', 'missing', 'done'];
    let items = null;
    const ink = view.querySelector('.gcx-seg-ink');
    const moveInk = () => {
      const b = view.querySelector(`.gcx-seg button[data-tab="${tab}"]`);
      if (b) ink.style.cssText = `left:${b.offsetLeft + 12}px;width:${b.offsetWidth - 24}px`;
    };
    // anim: 'left' / 'right' slide the list in from that side, 'fade' just fades, '' redraws quietly.
    const draw = (anim = '') => {
      if (!items) return;
      const pool = items.filter((i) => !courseFilter || String(i.courseId) === courseFilter);
      view.querySelectorAll('.gcx-seg button').forEach((b) => {
        b.classList.toggle('on', b.dataset.tab === tab);
        b.setAttribute('aria-selected', String(b.dataset.tab === tab));
        b.querySelector('.gcx-n').textContent = pool.filter(inTab[b.dataset.tab]).length || '';
      });
      moveInk();
      const list = pool.filter(inTab[tab]);
      const order = tab === 'assigned' ? 1 : -1;
      list.sort((a, b) => order * ((a.due ? +a.due : order * Infinity) - (b.due ? +b.due : order * Infinity)));
      const groups = bucketsFor[tab].map(([label, fn]) => [label, list.filter(fn)]).filter(([, l]) => l.length);
      const body = view.querySelector('.gcx-todo-body');
      if (!anim) body.classList.remove('gcx-slide-left', 'gcx-slide-right', 'gcx-in', 'gcx-stagger');
      const closed = new Set([...body.querySelectorAll('.gcx-grp.closed')].map((g) => g.dataset.label));
      const keepClosed = !anim && body.dataset.tab === tab;
      body.dataset.tab = tab;
      body.innerHTML = !groups.length
        ? `<div class="gcx-card gcx-empty">${tab === 'missing' ? 'Nothing missing. Nice.' : tab === 'done' ? 'Nothing turned in yet.' : 'No work assigned right now.'}</div>`
        : groups
            .map(([label, l], gi) => {
              const isClosed = keepClosed ? closed.has(label) : tab === 'done' && gi > 1;
              let n = 0;
              return `<section class="gcx-card gcx-grp${isClosed ? ' closed' : ''}" data-label="${esc(label)}" style="--i:${gi}">
          <button class="gcx-grp-h" type="button" aria-expanded="${!isClosed}">${esc(label)}<span class="gcx-count">${l.length}</span>${svg('chevron')}</button>
          <div class="gcx-grp-rows gcx-collapse"><div class="gcx-collapse-in">${l
            .map((i) => {
              const m = meta(i);
              return `<a class="gcx-row${i.done ? ' done' : ''}" href="${esc(i.url)}" style="--c:${esc(colorOf.get(i.courseId) || '#5f6368')};--i:${Math.min(n++, 12)}">
                <span class="gcx-row-ic">${svg(TYPE_ICON[i.type] || 'assignment', 20)}</span>
                <span class="gcx-row-main"><span class="gcx-row-title">${esc(i.title)}</span><span class="gcx-row-sub">${esc(nameOf.get(i.courseId) || i.courseName || 'Personal to-do')}</span></span>
                <span class="gcx-row-meta ${m.cls}">${esc(m.text)}</span></a>`;
            })
            .join('')}</div></div></section>`;
            })
            .join('');
      if (anim) {
        body.classList.remove('gcx-slide-left', 'gcx-slide-right', 'gcx-in', 'gcx-stagger');
        void body.offsetWidth;
        body.classList.add(anim === 'fade' ? 'gcx-in' : `gcx-slide-${anim}`, 'gcx-stagger');
      }
    };
    view.querySelector('.gcx-todo-body').addEventListener('click', (e) => {
      const h = e.target.closest('.gcx-grp-h');
      if (!h) return;
      const open = h.parentElement.classList.toggle('closed');
      h.setAttribute('aria-expanded', String(!open));
    });
    const syncUrl = () => {
      const p = new URLSearchParams({ gcx: 'todo' });
      if (tab !== 'assigned') p.set('tab', tab);
      if (courseFilter) p.set('course', courseFilter);
      history.replaceState(null, '', '/?' + p);
    };
    view.querySelector('.gcx-seg').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.dataset.tab === tab) return;
      const dir = TABS.indexOf(b.dataset.tab) > TABS.indexOf(tab) ? 'left' : 'right';
      tab = b.dataset.tab;
      syncUrl();
      draw(dir);
    });
    select.addEventListener('change', () => {
      courseFilter = select.value;
      syncUrl();
      draw('fade');
    });
    window.addEventListener('resize', debounce(moveInk, 100));

    // Saved list first (instant), then the fresh one; redraws only if something changed.
    const syncBadge = view.querySelector('.gcx-sync');
    syncBadge.hidden = false;
    barStart();
    try {
      await swr(
        'todo:items',
        fetchItems,
        (data, fromCache) => {
          const first = !items;
          items = data;
          draw(first ? 'fade' : '');
          barDone();
        },
        reviveItems,
      );
    } catch (e) {
      showError(view.querySelector('.gcx-todo-body'), 'your to-do list', '/', e);
    } finally {
      barDone();
      syncBadge.hidden = true;
    }
  }

  // ---------------------------------------------------------------- dashboard
  let dashItems = null; // planner items for the next two weeks (cached copy first, then fresh)

  // While Canvas builds its cards, show last visit's finished cards (a snapshot) in their place,
  // or, the first time, one placeholder card per class. Canvas's own loading state stays hidden
  // (early.js adds gcx-dash-wait) until the real cards are ready, then they swap in place.
  let ghosts = null;
  const snapKey = () => 'dashsnap:' + (PAGE_USER || 'anon');
  const DASH_VIEW = (() => {
    for (const sc of document.scripts) {
      const m = !sc.src && sc.textContent.match(/"dashboard_view":"(\w+)"/);
      if (m) return m[1];
    }
    return 'cards';
  })();
  function mountGhosts() {
    if (DASH_VIEW !== 'cards') return releaseGhosts();
    const container = document.getElementById('DashboardCard_Container');
    if (!container || document.querySelector('.ic-DashboardCard .gcx-card-body')) return releaseGhosts();
    const snap = store.get(snapKey(), null);
    const n = (COURSES || []).length || 6;
    const skeletonCard = `<div class="ic-DashboardCard gcx-skelcard"><div class="ic-DashboardCard__header"></div><div class="gcx-card-body">${skeleton(3)}</div></div>`;
    const markup = snap || `<div class="ic-DashboardCard__box__container">${skeletonCard.repeat(n)}</div>`;
    ghosts = el(`<div class="gcx-ghosts ic-DashboardCard__box" aria-hidden="true">${markup}</div>`);
    const css = snap && !document.querySelector(BC_CARD_STYLE) && store.get(snapKey() + ':css', '');
    if (css) {
      const st = document.createElement('style');
      st.id = 'gcx-ghost-css';
      st.textContent = css;
      ghosts.prepend(st);
    }
    // Clickable (they're plain class links) but out of the Tab order, since they're hidden from screen readers.
    ghosts.querySelectorAll('a, button, [tabindex]').forEach((n) => n.setAttribute('tabindex', '-1'));
    container.before(ghosts);
    setTimeout(releaseGhosts, 10000); // never block the real cards for long
  }
  let ghostCheck = 0;
  // Card pictures, loaded before the real cards show (so they don't blink to a plain color).
  const loadedPics = new Set();
  function cardPicturesReady(cards) {
    let ready = true;
    for (const c of cards) {
      const n = c.querySelector('.ic-DashboardCard__header_image');
      const url = n && (getComputedStyle(n).backgroundImage.match(/url\("?([^")]+)"?\)/) || [])[1];
      if (!url || loadedPics.has(url)) continue;
      ready = false;
      if (loadedPics.has('…' + url)) continue;
      loadedPics.add('…' + url);
      const img = new Image();
      img.onload = img.onerror = () => loadedPics.add(url);
      img.src = url;
    }
    return ready;
  }
  function releaseGhosts() {
    if (ghosts) {
      // The real cards take over the same spot without replaying the entrance animation.
      html.classList.add('gcx-swapped');
      ghosts.remove();
      ghosts = null;
    }
    html.classList.remove('gcx-dash-wait');
  }
  // Real cards are ready once every one has its body and its due list (or placeholder) drawn.
  function maybeReleaseGhosts() {
    if (!ghosts && !html.classList.contains('gcx-dash-wait')) return;
    const cards = [...document.querySelectorAll('#DashboardCard_Container .ic-DashboardCard')];
    if (!cards.length) {
      if (document.querySelector('#DashboardCard_Container .ic-DashboardCard__box')) releaseGhosts();
      return;
    }
    const filled = cards.every((c) => c.querySelector('.gcx-card-body[data-color]'));
    // The real cards take over only once they'll look the same: BetterCampus has styled them (its
    // stylesheet is in and each card has its custom-card class, if the stand-ins had one) and their
    // pictures have loaded. Never longer than 3 s.
    const late = performance.now() - T0 > 3000;
    const wantsBc = ghosts && ghosts.querySelector('[class*="custom-card-"]');
    const styled = late || !ghosts || ((!ghosts.querySelector('#gcx-ghost-css') || document.querySelector(BC_CARD_STYLE)) && (!wantsBc || cards.every((c) => /\bcustom-card-/.test(c.className))));
    const pics = late || cardPicturesReady(cards);
    if (!styled || !pics) {
      clearTimeout(ghostCheck);
      ghostCheck = setTimeout(maybeReleaseGhosts, 120);
    }
    if (filled && styled && pics && (!dashItems || cards.every((c) => c.querySelector('.gcx-card-due-wrap[data-markup]')))) {
      releaseGhosts();
      if (dashItems) saveSnapshot();
    }
  }
  // After a fresh load, keep a copy of the finished cards for next time.
  const saveSnapshot = debounce(() => {
    const box = document.querySelector('#DashboardCard_Container .ic-DashboardCard__box__container');
    if (!box || box.querySelector('.gcx-skel')) return;
    const copy = box.cloneNode(true);
    copy.querySelectorAll('*').forEach((n) => {
      for (const a of [...n.attributes]) if (/^on|^id$|^draggable$|^data-testid$/i.test(a.name)) n.removeAttribute(a.name);
    });
    copy.querySelectorAll('script, iframe').forEach((n) => n.remove());
    const markup = copy.outerHTML;
    if (markup.length < 300000 && store.get(snapKey(), null) !== markup) store.set(snapKey(), markup);
    // BetterCampus styles each card from a stylesheet it adds a moment after load; the stand-ins
    // need it from the first frame, or they start in Canvas's look and size and then reshape.
    const css = bcCardCss();
    const keep = css && css.length < 200000 ? css : '';
    if (store.get(snapKey() + ':css', '') !== keep) store.set(snapKey() + ':css', keep);
  }, 800);
  const BC_CARD_STYLE = ':is(style[id*="card" i], style[id*="dashboard" i]):is([id^="bettercampus"], [id^="bettercanvas"])';
  const bcCardCss = () => [...document.querySelectorAll(BC_CARD_STYLE)].map((n) => n.textContent).join('\n');
  function enhanceCards() {
    const cards = document.querySelectorAll('#DashboardCard_Container .ic-DashboardCard');
    for (const card of cards) {
      html.classList.add('gcx-cards');
      if (card.querySelector(':scope > .gcx-card-body')) continue;
      const link = card.querySelector('a.ic-DashboardCard__link, a[href^="/courses/"]');
      const id = Number(((link && link.getAttribute('href')) || '').match(/\/courses\/(\d+)/)?.[1]);
      const header = card.querySelector('.ic-DashboardCard__header');
      if (!id || !header) continue;
      const fallbackTitle = card.querySelector('.ic-DashboardCard__header-title')?.textContent.trim() || '';
      header.prepend(el('<div class="gcx-card-cover" aria-hidden="true"></div>'));
      header.append(
        el(`<a class="gcx-card-ov" href="/courses/${id}"><div class="gcx-card-title">${esc(prettyName({ name: fallbackTitle }))}</div><div class="gcx-card-teacher"></div></a>`),
      );
      card.append(
        el(`<div class="gcx-card-body" data-course="${id}"><div class="gcx-card-due-wrap">${skeleton(2)}</div><div class="gcx-card-foot"><span></span></div></div>`),
      );
      fillCard(card, id);
    }
    // Canvas may render an empty card box (no favorites); that also ends the stand-ins.
    maybeReleaseGhosts();
    if (cards.length && !document.querySelector('.gcx-hidden-note') && store.get(HIDDEN_KEY(), []).length) paintHidden();
  }
  async function fillCard(card, id) {
    const c = (COURSES || []).find((x) => x.id === id) || (await coursesReady).find((x) => x.id === id) || (await courseById(id));
    const ov = card.querySelector('.gcx-card-ov');
    const body = card.querySelector('.gcx-card-body');
    if (!ov || !body) return;
    body.dataset.color = c.color;
    ov.style.setProperty('--c', c.color);
    body.style.setProperty('--c', c.color);
    if (c.name) ov.querySelector('.gcx-card-title').textContent = prettyName(c);
    ov.querySelector('.gcx-card-teacher').textContent = teacherLine(c);
    const foot = body.querySelector('.gcx-card-foot');
    // Shortcuts he added, the email button, and ⋮ (Add shortcut / Hide), right-aligned together.
    let acts = foot.querySelector('.gcx-card-acts');
    if (!acts) {
      acts = el(`<div class="gcx-card-acts"><span class="gcx-card-links"></span><button type="button" class="gcx-iconbtn gcx-card-more" aria-haspopup="menu" aria-expanded="false" title="More" aria-label="More options for ${esc(prettyName(c))}">${svg('more', 22)}</button></div>`);
      foot.append(acts);
      acts.querySelector('.gcx-card-more').addEventListener('click', (e) => openCardMenu(e.currentTarget, c));
    }
    if (c.teachers.length && !acts.querySelector('.gcx-card-mail')) {
      const who = c.teachers.length <= 2 ? c.teachers[0].name : 'the instructors';
      acts.querySelector('.gcx-card-more').before(el(`<a class="gcx-iconbtn gcx-card-mail" href="${esc(emailHref(c))}" title="Email ${esc(who)}" aria-label="Email ${esc(who)}">${svg('mail', 22)}</a>`));
    }
    drawCardLinks(acts, id);
    if (dashItems) fillCardDue(body);
    maybeReleaseGhosts();
  }
  // ----- a card's own shortcuts (⋮ › Add shortcut): straight to one of the class's pages
  const cardLinksKey = (id) => `cardlinks:${PAGE_USER || 'anon'}:${id}`;
  function drawCardLinks(acts, id) {
    const box = acts.querySelector('.gcx-card-links');
    const list = store.get(cardLinksKey(id), []);
    const markup = list
      .map((l) => `<a class="gcx-iconbtn gcx-card-link" href="${esc(l.href)}" title="${esc(l.label)}" aria-label="${esc(l.label)}">${svg(l.icon || tabIcon(l.href), 18)}</a>`)
      .join('');
    if (box.dataset.markup !== markup) {
      box.dataset.markup = markup;
      box.innerHTML = markup;
    }
  }
  // The class's pages, from its course tabs (saved when he was last in the class, else asked for).
  async function courseOptions(id) {
    let tabs = store.get('tabs:' + id, []);
    if (!tabs.length) {
      try {
        tabs = (await api(`/courses/${id}/tabs`))
          .filter((t) => !t.hidden && t.html_url)
          .map((t) => ({ label: t.label, href: t.html_url.replace(/^https?:\/\/[^/]+/, '') }));
        store.set('tabs:' + id, tabs);
      } catch {
        tabs = [];
      }
    }
    return [...tabs, { label: 'Original Canvas home page', href: `/courses/${id}?gcx-original=1`, icon: 'home' }];
  }
  // ----- hiding a card (on this dashboard only; Canvas's own list is left alone)
  const HIDDEN_KEY = () => 'hiddenCards:' + (PAGE_USER || 'anon');
  const hiddenStyle = document.createElement('style');
  hiddenStyle.id = 'gcx-hidden-cards';
  (document.head || html).append(hiddenStyle);
  function paintHidden() {
    let ids = store.get(HIDDEN_KEY(), []);
    // A hidden class that's no longer on the dashboard (unfavorited, term over) is forgotten.
    if (COURSES && COURSES.length) {
      const on = ids.filter((x) => COURSES.some((c) => String(c.id) === String(x)));
      if (on.length !== ids.length) store.set(HIDDEN_KEY(), (ids = on));
    }
    hiddenStyle.textContent = ids
      .filter((x) => /^\d+$/.test(String(x)))
      .map((x) => `.ic-DashboardCard:has(a.gcx-card-ov[href="/courses/${x}"]) { display: none !important; }`)
      .join('\n');
    const container = document.getElementById('DashboardCard_Container');
    let note = document.querySelector('.gcx-hidden-note');
    if (!container || !html.classList.contains('gcx-dash')) return;
    if (!ids.length) return note?.remove();
    if (!note) {
      note = el('<button type="button" class="gcx-hidden-note" aria-haspopup="menu"></button>');
      note.addEventListener('click', () => openHiddenMenu(note));
      container.after(note);
    }
    note.textContent = `${ids.length} hidden ${ids.length === 1 ? 'class' : 'classes'}`;
  }
  const setCardHidden = (id, on) => {
    const ids = store.get(HIDDEN_KEY(), []).filter((x) => String(x) !== String(id));
    if (on) ids.push(id);
    store.set(HIDDEN_KEY(), ids);
    paintHidden();
  };
  // A small menu by a button: [{label, icon, run, danger}] items, closes on pick, outside click, Esc.
  let closeMiniMenu = null;
  function miniMenu(btn, items, heading = '') {
    if (closeMiniMenu) {
      const same = btn.getAttribute('aria-expanded') === 'true';
      closeMiniMenu();
      if (same) return;
    }
    const pop = el(`<div class="gcx-mini gcx-pop-panel" role="menu">${heading ? `<div class="gcx-mini-h">${esc(heading)}</div>` : ''}${items
      .map((it, i) =>
        it.sep
          ? '<div class="gcx-mini-sep"></div>'
          : `<div class="gcx-mini-row"><button type="button" role="menuitem" class="gcx-mini-item${it.danger ? ' danger' : ''}" data-i="${i}">${svg(it.icon, 18)}<span>${esc(it.label)}</span></button>${
              it.remove ? `<button type="button" class="gcx-mini-x" data-x="${i}" title="Remove" aria-label="Remove ${esc(it.label)}">${svg('close', 16)}</button>` : ''
            }</div>`,
      )
      .join('')}</div>`);
    document.body.append(pop);
    const r = btn.getBoundingClientRect();
    pop.style.left = Math.max(12, Math.min(r.right - pop.offsetWidth, innerWidth - pop.offsetWidth - 12)) + 'px';
    const below = r.bottom + 6 + pop.offsetHeight < innerHeight - 12;
    pop.style.top = (below ? r.bottom + 6 : Math.max(12, r.top - pop.offsetHeight - 6)) + 'px';
    pop.style.transformOrigin = below ? 'top right' : 'bottom right';
    btn.setAttribute('aria-expanded', 'true');
    const close = () => {
      if (closeMiniMenu === close) closeMiniMenu = null;
      pop.classList.add('gcx-out');
      btn.setAttribute('aria-expanded', 'false');
      setTimeout(() => pop.remove(), 160);
      document.removeEventListener('mousedown', outside, true);
      document.removeEventListener('keydown', onKey, true);
    };
    closeMiniMenu = close;
    const outside = (e) => !pop.contains(e.target) && !btn.contains(e.target) && close();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        close();
        btn.focus();
      }
    };
    document.addEventListener('mousedown', outside, true);
    document.addEventListener('keydown', onKey, true);
    pop.addEventListener('click', (e) => {
      const x = e.target.closest('[data-x]');
      const b = e.target.closest('[data-i]');
      if (x) {
        close();
        items[Number(x.dataset.x)].remove();
      } else if (b) {
        close();
        items[Number(b.dataset.i)].run();
      }
    });
    pop.querySelector('[role="menuitem"]')?.focus({ preventScroll: true });
  }
  function openCardMenu(btn, c) {
    const id = c.id;
    const acts = btn.closest('.gcx-card-acts');
    const list = store.get(cardLinksKey(id), []);
    const items = [
      {
        label: 'Add shortcut',
        icon: 'add',
        run: () =>
          openLinkPicker(
            btn,
            courseOptions(id).then((o) => o.filter((x) => !store.get(cardLinksKey(id), []).some((l) => l.href === x.href))),
            'Add shortcut',
            (o) => {
              const l = store.get(cardLinksKey(id), []);
              if (l.some((x) => x.href === o.href)) return toast(`${o.label} is already a shortcut`);
              l.push({ label: o.label, href: o.href, icon: o.icon });
              store.set(cardLinksKey(id), l.slice(-4));
              drawCardLinks(acts, id);
              saveSnapshot();
              toast(`Added ${o.label} to ${prettyName(c)}`);
            },
          ),
      },
      ...list.map((l) => ({
        label: l.label,
        icon: l.icon || tabIcon(l.href),
        run: () => (location.href = l.href),
        remove: () => {
          store.set(
            cardLinksKey(id),
            store.get(cardLinksKey(id), []).filter((x) => x.href !== l.href),
          );
          drawCardLinks(acts, id);
          saveSnapshot();
          toast(`Removed ${l.label}`);
        },
      })),
      { sep: true },
      {
        label: 'Hide from dashboard',
        icon: 'hide',
        run: () => {
          setCardHidden(id, true);
          toast(`Hid ${prettyName(c)}`, 'Undo', () => setCardHidden(id, false));
        },
      },
    ];
    miniMenu(btn, items, list.length ? '' : '');
  }
  function openHiddenMenu(btn) {
    const ids = store.get(HIDDEN_KEY(), []);
    const name = (x) => {
      const c = (COURSES || []).find((k) => String(k.id) === String(x));
      return c ? prettyName(c) : `Class ${x}`;
    };
    miniMenu(
      btn,
      ids.map((x) => ({ label: `Show ${name(x)}`, icon: 'show', run: () => setCardHidden(x, false) })),
      'Hidden from your dashboard',
    );
  }
  const CARD_LIMIT = 3;
  function fillCardDue(body) {
    const id = Number(body.dataset.course);
    const color = body.dataset.color || '#1a73e8';
    const soon = dueSoon(dashItems.filter((i) => i.courseId === id));
    const markup = soon.length
      ? `<div class="gcx-due">${dueGroupsHtml(soon, CARD_LIMIT, () => color)}</div>`
      : `<div class="gcx-due-none">Nothing due in the next two weeks.</div>`;
    const wrap = body.querySelector('.gcx-card-due-wrap');
    if (wrap.dataset.markup === markup) return;
    wrap.dataset.markup = markup;
    swapIn(wrap, markup);
    const foot = body.querySelector('.gcx-card-foot');
    foot.firstElementChild.outerHTML =
      soon.length > CARD_LIMIT ? `<a class="gcx-more-link" href="/?gcx=todo&course=${id}">${soon.length - CARD_LIMIT} more</a>` : '<span></span>';
  }
  function refreshCards() {
    document.querySelectorAll('#DashboardCard_Container .gcx-card-body[data-color]').forEach(fillCardDue);
    maybeReleaseGhosts();
  }

  // ----- "Hey Saif!" greeting, picked from what's going on. Settings can turn it off or change its tone.
  const PREF_DEFAULTS = {
    greeting: true, tone: 'normal', font: 'fredoka', ask: true, hotkey: true, routing: true, suggest: true, confetti: true, motion: true, annReveal: true,
    school: false, theme: '', shade: 1, cardRipple: true, tint: true, tintAmt: 55, gray: false, dim: 0, uniform: true, dashGap: 0,
    look: '', uiFont: '', art: '', artAmt: 18,
  };
  const prefs = () => ({ ...PREF_DEFAULTS, ...store.get('prefs', {}) });
  const applyFontPref = () => (html.dataset.gcxFont = prefs().font);
  // How dark the course images get behind their white titles (cards and the class banner).
  const SHADES = [
    ['Light', 0],
    ['Medium', 1],
    ['Strong', 2],
    ['Max', 3],
  ];
  // Room between the rail and the dashboard (early.js sets it too, before first paint).
  const DASH_GAP_MAX = 320;
  const applyLayoutPref = () => {
    const g = Math.max(0, Math.min(DASH_GAP_MAX, Number(prefs().dashGap) || 0));
    if (g) html.style.setProperty('--gcx-dash-gap', `${g}px`);
    else html.style.removeProperty('--gcx-dash-gap');
  };
  const applyShadePref = () => {
    const p = prefs();
    html.dataset.gcxShade = String(p.shade);
    // With the wash on, it replaces Canvas's own color overlay on pictures (see classroom.css).
    html.classList.toggle('gcx-tint', p.tint !== false);
    html.style.setProperty('--gcx-tint', `${p.tintAmt}%`);
    // Black and white and/or dimmed class images (cards and the class banner).
    const f = [p.gray ? 'grayscale(1)' : '', p.dim ? `brightness(${(100 - p.dim) / 100})` : ''].filter(Boolean).join(' ');
    if (f) html.style.setProperty('--gcx-img-filter', f);
    else html.style.removeProperty('--gcx-img-filter');
  };

  // School colors: the rail takes the school's Canvas nav color (and logo), like stock Canvas,
  // and the accent color follows it. Everything comes from Canvas's own brand variables.
  // Color themes for the rail and accents: the school's own Canvas colors (with its logo), or a
  // preset. `school: true` is the setting from before themes existed.
  const THEMES = [
    ['', 'Default', ''],
    ['school', 'School', ''],
    ['deepblue', 'Deep blue', '#1e3a8a'],
    ['forest', 'Forest', '#166534'],
    ['blossom', 'Blossom', '#c2457a'],
    ['plum', 'Plum', '#6b21a8'],
    ['crimson', 'Crimson', '#9f1239'],
    ['teal', 'Teal', '#0f766e'],
    ['slate', 'Slate', '#334155'],
  ];
  const themeOf = (p) => p.theme || (p.school ? 'school' : '');
  function applySchoolPref() {
    const theme = themeOf(prefs());
    const on = !!theme;
    html.classList.toggle('gcx-school', on);
    rail.querySelector('.gcx-rail-logo')?.remove();
    document.querySelector('.gcx-school-mark')?.remove();
    html.classList.remove('gcx-themed', 'gcx-uniform');
    if (!on) {
      html.style.removeProperty('--gcx-school');
      html.style.removeProperty('--gcx-school-fg');
      html.style.removeProperty('--gcx-link');
      html.style.removeProperty('--gcx-accent');
      return;
    }
    const cs = getComputedStyle(html);
    const preset = (THEMES.find((t) => t[0] === theme) || [])[2];
    const nav = preset || cs.getPropertyValue('--ic-brand-global-nav-bgd').trim() || cs.getPropertyValue('--ic-brand-primary').trim() || '#394b58';
    const fg = (!preset && cs.getPropertyValue('--ic-brand-global-nav-menu-item__text-color').trim()) || (luminance(nav) > 0.55 ? '#1f1f1f' : '#ffffff');
    html.style.setProperty('--gcx-school', nav);
    html.style.setProperty('--gcx-school-fg', fg);
    // The theme color is the accent everywhere (links, tabs, chips, surfaces). Where it's too close
    // to the page to read (a dark color on a dark page), it's lifted toward white, or black on light.
    // A see-through body (image themes) says nothing; go by the theme's background color then.
    const bodyBg = getComputedStyle(document.body).backgroundColor;
    let bg = rgbLuminance(bodyBg);
    if (/^transparent$|,\s*0\)$/.test(bodyBg)) {
      const n = document.createElement('i');
      n.style.cssText = 'position:absolute;visibility:hidden;background:var(--bcbackground-0, #fff)';
      document.body.append(n);
      bg = rgbLuminance(getComputedStyle(n).backgroundColor);
      n.remove();
    }
    const L = luminance(nav);
    const readable = (Math.max(L, bg) + 0.05) / (Math.min(L, bg) + 0.05) >= 3;
    const accent = readable ? nav : `color-mix(in oklab, ${nav} 55%, ${bg < 0.4 ? 'white' : 'black'})`;
    html.style.setProperty('--gcx-link', accent);
    html.style.setProperty('--gcx-accent', accent);
    html.classList.add('gcx-themed');
    html.classList.toggle('gcx-uniform', prefs().uniform !== false);
    if (preset) return; // logos only come with the school theme
    const logo = (cs.getPropertyValue('--ic-brand-header-image').match(/url\(["']?([^"')]+)/) || [])[1];
    if (logo) {
      const a = el(`<a class="gcx-rail-logo" href="/" aria-label="Dashboard"></a>`);
      a.style.backgroundImage = `url(${JSON.stringify(logo)})`;
      rail.prepend(a);
    }
    // The school's wordmark, the one Canvas puts at the top of the dashboard sidebar.
    const mark = document.querySelector('.ic-sidebar-logo__image');
    const side = document.getElementById('right-side-wrapper');
    if (html.classList.contains('gcx-dash') && mark && mark.src && side) {
      const box = el('<div class="gcx-school-mark"><img alt=""></div>');
      box.querySelector('img').src = mark.src;
      box.querySelector('img').alt = mark.alt || 'School logo';
      side.prepend(box);
    }
  }
  // Looks: a whole style in one tap (page colors, theme color, fonts, background). Picking one sets
  // the settings below it, which can still be changed one by one; its page colors stay until another
  // look (or None, back to BetterCampus's colors) is picked. Page colors: background, second and
  // third surfaces, cards, text (strong, muted, faint), borders, links.
  const LOOKS = [
    { id: '', label: 'None', sw: [] },
    {
      id: 'classroom',
      label: 'Classroom',
      vars: ['#ffffff', '#f1f3f4', '#e8eaed', '#ffffff', '#1f1f1f', '#5f6368', '#80868b', '#dadce0', '#1a73e8'],
      set: { theme: '', uniform: false, font: 'grotesk', uiFont: '', art: '' },
    },
    {
      id: 'blossom',
      label: 'Blossom',
      vars: ['#fff6f9', '#fde7ef', '#f9d5e2', '#ffffff', '#3a1f2b', '#86566a', '#a77f90', '#f3d1de', '#c2185b'],
      set: { theme: 'blossom', uniform: true, font: 'playfair', uiFont: 'nunito', art: 'blossom', artAmt: 30 },
    },
    {
      id: 'forest',
      label: 'Forest',
      vars: ['#f3f7f1', '#e4ede0', '#d5e3cf', '#ffffff', '#1c2a1f', '#56695a', '#7d8f80', '#d0ddca', '#2e7d32'],
      set: { theme: 'forest', uniform: true, font: 'fredoka', uiFont: 'lexend', art: 'trees', artAmt: 16 },
    },
    {
      id: 'midnight',
      label: 'Midnight',
      dark: true,
      vars: ['#0c1430', '#141f45', '#1b2856', '#17224b', '#e8ecf8', '#a3add0', '#7c87ad', '#2a3870', '#8ab4ff'],
      set: { theme: 'deepblue', uniform: false, font: 'poppins', uiFont: '', art: '' },
    },
    {
      id: 'schooldark',
      label: 'School dark',
      dark: true,
      vars: ['#141414', '#1e1e1e', '#262626', '#232323', '#f5f5f5', '#b0b0b0', '#8a8a8a', '#343434', 'color-mix(in oklab, var(--ic-brand-global-nav-bgd, #8ab4f8) 55%, white)'],
      set: { theme: 'school', uniform: true, font: 'grotesk', uiFont: 'lexend', art: '' },
    },
  ];
  const LOOK_VARS = ['--bcbackground-0', '--bcbackground-1', '--bcbackground-2', '--bccards', '--bctext-0', '--bctext-1', '--bctext-2', '--bcborders', '--bclinks'];
  const lookOf = (id) => LOOKS.find((l) => l.id === id && l.vars) || null;
  function lookCss(l) {
    if (!l) return '';
    const d = LOOK_VARS.map((k, i) => `${k}: ${l.vars[i]} !important`);
    d.push(
      `--bcbackground-0-ungradient: ${l.vars[0]} !important`,
      '--bcbackground-image: initial !important',
      '--bcbackground-image-layer: initial !important',
      `color-scheme: ${l.dark ? 'dark' : 'light'}`,
    );
    return `:root.gcx, :root.gcx body { ${d.join('; ')} } html.gcx :is(body, #application.ic-app) { background-color: ${l.vars[0]} !important; color: ${l.vars[4]}; }`;
  }
  // The look's colors go in over BetterCampus's (they're its variables, so its own dark mode
  // follows them too); early.js puts the same style in before the next page's first frame.
  function applyLook(changed = false) {
    const p = prefs();
    const css = lookCss(lookOf(p.look));
    let st = document.getElementById('gcx-look');
    if (css) {
      if (!st) {
        st = document.createElement('style');
        st.id = 'gcx-look';
        html.append(st);
      }
      if (st.textContent !== css) st.textContent = css;
      store.set('look', { css });
    } else {
      st?.remove();
      try {
        localStorage.removeItem('gcx:look');
      } catch {}
    }
    if (p.uiFont && UI_FONTS.some((f) => f[0] === p.uiFont)) html.dataset.gcxUi = p.uiFont;
    else delete html.dataset.gcxUi;
    applyArt();
    if (changed) {
      checkFlatSurface();
      refreshInlineColors();
      saveThemeVars();
    }
  }
  // Page backgrounds: two drawings (each with an ink for light pages and one for dark), or his
  // own picture (uploaded or made with AI, in chrome.storage). The strength is how much of it
  // shows through the page color.
  const ARTS = [
    ['', 'None'],
    ['trees', 'Trees', 'center bottom'],
    ['blossom', 'Blossom', 'center top'],
    ['mine', 'Yours', 'center'],
  ];
  const BG_KEY = 'gcx:bgimg';
  let bgMine = null; // his picture once read ('' if there's none)
  const pageIsDark = () => {
    const l = lookOf(prefs().look);
    if (l) return !!l.dark;
    const n = document.createElement('i');
    n.style.cssText = 'position:absolute;visibility:hidden;background:var(--bcbackground-0-ungradient, var(--gcx-bg, #fff))';
    (document.body || html).append(n);
    const c = getComputedStyle(n).backgroundColor;
    n.remove();
    return rgbLuminance(c) < 0.35;
  };
  let artRun = 0;
  async function applyArt() {
    const run = ++artRun;
    const p = prefs();
    const amt = Math.max(3, Math.min(100, Number(p.artAmt) || 18));
    const art = ARTS.find((a) => a[0] === p.art && a[0]);
    let url = '';
    if (art && art[0] === 'mine') {
      if (bgMine === null) bgMine = (await chrome.storage.local.get(BG_KEY).catch(() => ({})))[BG_KEY] || '';
      if (run !== artRun) return;
      url = bgMine;
    } else if (art) url = chrome.runtime.getURL(`art/${art[0]}-${pageIsDark() ? 'dark' : 'light'}.svg`);
    html.classList.toggle('gcx-art', !!url);
    html.classList.toggle('gcx-artbold', !!url && amt >= 40);
    let src = document.getElementById('gcx-art-src');
    if (!url) {
      src?.remove();
      ['--gcx-art-pos', '--gcx-art-amt'].forEach((k) => html.style.removeProperty(k));
      try {
        localStorage.removeItem('gcx:art');
      } catch {}
      return;
    }
    if (!src) {
      src = document.createElement('style');
      src.id = 'gcx-art-src';
      html.append(src);
    }
    const rule = `:root{--gcx-art:url("${url}")}`;
    if (src.textContent !== rule) src.textContent = rule;
    html.style.setProperty('--gcx-art-pos', art[2]);
    html.style.setProperty('--gcx-art-amt', `${amt}%`);
    store.set('art', art[0] === 'mine' ? { mine: true, pos: art[2], amt } : { url, pos: art[2], amt });
  }
  function rgbLuminance(rgb) {
    const m = String(rgb).match(/(\d+(?:\.\d+)?)/g);
    if (!m || m.length < 3) return 1;
    const hex = '#' + m.slice(0, 3).map((v) => Math.round(+v).toString(16).padStart(2, '0')).join('');
    return luminance(hex);
  }
  function luminance(color) {
    const m = String(color).trim().match(/^#?([\da-f]{3}|[\da-f]{6})$/i);
    if (!m) return 0.3;
    let h = m[1];
    if (h.length === 3) h = h.replace(/./g, (c) => c + c);
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function mountWelcome() {
    const anchor = document.getElementById('dashboard_header_container');
    if (!anchor || document.querySelector('.gcx-welcome')) return;
    const name = ((me && me.name) || PAGE_NAME).split(' ')[0] || 'there';
    const wel = el(`<div class="gcx-welcome"><h1 class="gcx-hello"></h1><div class="gcx-ask-slot"></div></div>`);
    anchor.before(wel);
    mountBell(wel);
    const lastVisit = store.get('lastVisit', 0);
    store.set('lastVisit', Date.now());
    welcomeCtx = { name, lastVisit, wel, titled: false, fromCache: false, items: null };
    applyWelcomePrefs();
    // One greeting per browsing session (a fresh one after a few hours), so it doesn't change on
    // every visit to the dashboard. It's still re-picked if the work it mentions changed.
    let saved = null;
    try {
      saved = JSON.parse(sessionStorage.getItem('gcx:hello') || 'null');
    } catch {}
    if (saved && !FORCE_HELLO && saved.kind !== 'urgent' && saved.tone === prefs().tone && Date.now() - saved.t < 3 * 36e5) {
      welcomeCtx.titled = true;
      welcomeCtx.fromCache = true;
      greetRefs = saved.refs || [];
      greetKind = saved.kind || '';
      setHello(saved.text, false, saved.t);
      return;
    }
    // If nothing arrives in time, show a plain greeting; the first real data may still re-pick it.
    setTimeout(() => {
      if (welcomeCtx.titled) return;
      welcomeCtx.titled = true;
      welcomeCtx.provisional = true;
      setHello(greeting(name, null, lastVisit), false);
    }, 350);
  }
  let welcomeCtx = null;
  // Emoji in the greeting get their own box, so hovering one can wiggle it (classroom.css).
  const EMOJI = /\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier}|\u200D\p{Extended_Pictographic}\uFE0F?)*/gu;
  function helloText(hello, text) {
    hello.textContent = '';
    let at = 0;
    for (const m of text.matchAll(EMOJI)) {
      if (m.index > at) hello.append(text.slice(at, m.index));
      const e = document.createElement('span');
      e.className = 'gcx-emo';
      e.textContent = m[0];
      hello.append(e);
      at = m.index + m[0].length;
    }
    if (at < text.length) hello.append(text.slice(at));
  }
  function setHello(text, animate, since = Date.now()) {
    const hello = welcomeCtx.wel.querySelector('.gcx-hello');
    helloText(hello, text);
    welcomeCtx.refs = greetRefs;
    welcomeCtx.kind = greetKind;
    if (animate) reveal(hello);
    // A placeholder picked without his work list isn't worth keeping for the session.
    if (welcomeCtx.provisional || FORCE_HELLO) return;
    try {
      sessionStorage.setItem('gcx:hello', JSON.stringify({ text, refs: greetRefs, kind: greetKind, tone: prefs().tone, t: since }));
    } catch {}
  }
  function applyWelcomePrefs() {
    if (!welcomeCtx) return;
    const p = prefs();
    welcomeCtx.wel.classList.toggle('no-hello', !p.greeting);
    welcomeCtx.wel.classList.toggle('no-ask', !p.ask);
  }
  function updateWelcome(items, fromCache, failed = false) {
    if (!welcomeCtx) return;
    const { name } = welcomeCtx;
    if (!failed) welcomeCtx.items = items;
    if (!welcomeCtx.titled) {
      welcomeCtx.titled = true;
      welcomeCtx.fromCache = fromCache;
      setHello(greeting(name, failed ? null : items, welcomeCtx.lastVisit), false);
    } else if (failed) {
      // Leave whatever is showing; an empty list would read as "all clear".
    } else if (welcomeCtx.provisional) {
      // The placeholder greeting knew nothing about his work; pick once more with it.
      welcomeCtx.provisional = false;
      greetRefs = [];
      welcomeCtx.fromCache = fromCache;
      setHello(greeting(name, items, welcomeCtx.lastVisit), true);
    } else if (!fromCache && welcomeCtx.fromCache) {
      // The greeting came from the saved list. If what it talked about changed (work handed in,
      // now missing, new work due today, or new work when it said "all clear"), pick again.
      welcomeCtx.fromCache = false;
      const now = new Date();
      const openItems = items.filter((i) => !i.done && !i.missing);
      const open = new Set(openItems.map((i) => i.key));
      const flagged = items.some((i) => i.flagged);
      const todayKeys = openItems.filter((i) => i.due && i.due >= now && dayDiff(i.due) === 0).map((i) => i.key);
      const refs = welcomeCtx.refs || [];
      const stale = refs.some((k) =>
        k === 'flagged' ? !flagged : k === 'clear' ? openItems.some((i) => i.due && i.due >= now && i.due < horizonEnd()) || flagged : !open.has(k),
      );
      // New work due today outranks what it said, unless it said something that outranks
      // "due today" anyway (a deadline within hours, a holiday).
      const newToday = !['urgent', 'holiday'].includes(welcomeCtx.kind) && todayKeys.some((k) => !refs.includes(k));
      if (stale || newToday) setHello(greeting(name, items, welcomeCtx.lastVisit), true);
    }
  }

  // Most specific wins: something due within hours, a holiday, something due today, a long
  // absence, late night. Otherwise a random pick from time of day, weekday and season, never the
  // same line twice in a row. Tone: 'calm' (plain), 'normal', 'extra' (emoji, sillier lines).
  // Day of November that Thanksgiving falls on (fourth Thursday).
  const thanksgiving = (year) => ((4 - new Date(year, 10, 1).getDay() + 7) % 7) + 1 + 21;
  let greetRefs = []; // keys of the work items ('flagged', 'clear') the last greeting talked about
  let greetKind = ''; // which branch it came from: 'urgent', 'holiday', 'today' or ''
  const FORCE_HELLO = new URLSearchParams(location.search).get('gcx-hello') || '';
  function greeting(n, items, lastVisit = 0) {
    greetRefs = [];
    greetKind = '';
    const tone = prefs().tone;
    const calm = tone === 'calm';
    const extra = tone === 'extra';
    const now = new Date();
    const h = now.getHours();
    const wd = now.getDay();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    // [text, emoji] pairs: the emoji only shows in the extra tone.
    const say = (pairs) => {
      const [t, e] = pick(pairs);
      return extra && e ? `${t} ${e}` : t;
    };
    const open = (items || []).filter((i) => !i.done && !i.missing && i.due && i.due >= now).sort((a, b) => a.due - b.due);
    const next = open[0];
    const hoursLeft = next ? (next.due - now) / 36e5 : Infinity;
    const short = (t) => (t.length > 34 ? t.slice(0, 32).trim() + '…' : t);
    // Asked for by the address (?gcx-hello=returns, spooky, morning or due): for screenshots, or to
    // see the kinds there are.
    if (FORCE_HELLO === 'returns') return say([[`${n} returns!`, '🦸'], [`Look who's back, ${n}!`, '👀']]);
    if (FORCE_HELLO === 'spooky') return say([[`Boo! Greetings, ${n}!`, '👻'], [`Spooky season, ${n}.`, '🎃']]);
    if (FORCE_HELLO === 'morning') return say([[`Good morning, ${n}!`, '☀️'], [`Rise and shine, ${n}!`, '🌅']]);
    if (FORCE_HELLO === 'due' && next) {
      greetRefs = [next.key];
      const when = dayDiff(next.due) === 0 ? 'today' : dayDiff(next.due) === 1 ? 'tomorrow' : 'soon';
      return say([[`${short(next.title)} is due ${when}, ${n}.`, '📅']]);
    }

    if (next && hoursLeft < 6) {
      greetRefs = [next.key];
      greetKind = 'urgent';
      const left = hoursLeft < 1 ? `${Math.max(1, Math.round(hoursLeft * 60))} min` : `${Math.round(hoursLeft)} hr`;
      if (calm) return `${short(next.title)} is due in ${left}.`;
      return say([
        [`${short(next.title)} is due in ${left}, ${n}.`, '⏰'],
        [`Clock's ticking, ${n}: ${short(next.title)} in ${left}.`, '🔥'],
        [`${n}, heads up: ${short(next.title)} in ${left}.`, '⏳'],
      ]);
    }

    const tg = thanksgiving(now.getFullYear());
    const holiday =
      (m === 1 && d === 1 && [[`Happy New Year, ${n}!`, '🎉'], [`New year, ${n}. Let's go.`, '🥳']]) ||
      (m === 2 && d === 14 && [[`Happy Valentine's Day, ${n}!`, '💘']]) ||
      (m === 3 && d === 17 && [[`Happy St. Patrick's Day, ${n}!`, '☘️']]) ||
      (m === 4 && d === 1 && [[`Nice try, ${n}. No pranks here.`, '🃏']]) ||
      (m === 7 && d === 4 && [[`Happy Fourth, ${n}!`, '🎆']]) ||
      (m === 10 && d === 31 && [[`Happy Halloween, ${n}!`, '🎃'], [`Trick or treat, ${n}!`, '🍬'], [`Boo! Greetings, ${n}!`, '👻']]) ||
      (m === 10 && d >= 24 && [[`Boo! Greetings, ${n}!`, '👻'], [`Spooky season, ${n}.`, '🎃'], [`Almost Halloween, ${n}!`, '🦇']]) ||
      (m === 11 && d === tg && [[`Happy Thanksgiving, ${n}!`, '🦃']]) ||
      (m === 11 && d > tg - 5 && d < tg && [[`Almost turkey time, ${n}!`, '🦃'], [`Break's close, ${n}.`, '🥧']]) ||
      (m === 12 && d >= 24 && d <= 25 && [[`Merry Christmas, ${n}!`, '🎄'], [`Happy holidays, ${n}!`, '🎁']]) ||
      (m === 12 && d === 31 && [[`Last day of the year, ${n}!`, '🎆']]) ||
      (((m === 12 && d <= 16) || (m === 5 && d <= 14)) && [[`Finals season, ${n}. You've got this.`, '💪'], [`Home stretch, ${n}!`, '🏁']]) ||
      (((m === 8 && d >= 24) || (m === 1 && d >= 12 && d <= 20)) && [[`New semester, ${n}!`, '📚'], [`Fresh start, ${n}.`, '✨']]) ||
      null;
    // Calm keeps only the real holidays (one day), said plainly.
    const bigDay = (m === 1 && d === 1) || (m === 7 && d === 4) || (m === 10 && d === 31) || (m === 11 && d === tg) || (m === 12 && d >= 24 && d <= 25);
    if (holiday && (!calm || bigDay)) greetKind = 'holiday';
    if (greetKind === 'holiday') return calm ? holiday[0][0].replace(/!$/, '.') : say(holiday);

    const dueToday = open.filter((i) => dayDiff(i.due) === 0);
    if (dueToday.length) {
      greetRefs = dueToday.map((i) => i.key);
      greetKind = 'today';
      if (calm) return dueToday.length === 1 ? `${short(dueToday[0].title)} is due today.` : `${dueToday.length} things are due today.`;
      return say(
        dueToday.length === 1
          ? [[`${short(dueToday[0].title)} is due today, ${n}.`, '📌'], [`One thing due today, ${n}. You've got it.`, '💪']]
          : [[`${dueToday.length} things due today, ${n}.`, '📌'], [`Busy day, ${n}: ${dueToday.length} due today.`, '🏃']],
      );
    }
    const flagged = (items || []).filter((i) => i.flagged).length;
    if (flagged && !calm && Math.random() < 0.5) {
      greetRefs = ['flagged'];
      return say([[`Let's catch up, ${n}.`, '🧹'], [`A little catching up to do, ${n}.`, '📝']]);
    }

    const away = lastVisit ? (Date.now() - lastVisit) / 864e5 : 0;
    if (away > 7) return calm ? `Welcome back, ${n}.` : say([[`Long time no see, ${n}!`, '👋'], [`It's been a minute, ${n}!`, '👀'], [`${n} returns!`, '🦸']]);
    if (away > 2 && !calm) return say([[`Good to see you, ${n}!`, '👋'], [`Missed you, ${n}.`, '🫶']]);
    if (lastVisit && Date.now() - lastVisit < 10 * 6e4 && !calm && Math.random() < 0.5) return say([[`Back already, ${n}?`, '😄'], [`Hi again, ${n}!`, '👋']]);
    if (h < 4 && !calm) return say([[`Up late, ${n}?`, '🌙'], [`Night owl mode, ${n}.`, '🦉'], [`Still up, ${n}? Get some sleep.`, '😴']]);
    if (items && !open.some((i) => i.due < horizonEnd()) && !flagged && Math.random() < 0.6) {
      greetRefs = ['clear'];
      return calm ? `Nothing due for two weeks, ${n}.` : say([[`All clear, ${n}!`, '😎'], [`Nothing due for two weeks, ${n}.`, '🏖️']]);
    }
    if (next && dayDiff(next.due) === 1 && Math.random() < 0.5) {
      greetRefs = [next.key];
      return calm ? `${short(next.title)} is due tomorrow.` : say([[`${short(next.title)} is due tomorrow, ${n}.`, '📅']]);
    }

    let pool;
    if (calm) {
      pool = [[`Welcome back, ${n}.`], [`Hello, ${n}.`], [h >= 4 && h < 12 ? `Good morning, ${n}.` : h < 17 ? `Good afternoon, ${n}.` : `Good evening, ${n}.`]];
    } else {
      pool = [[`Hey ${n}!`, '👋'], [`Hi ${n}!`, '😊'], [`Welcome back, ${n}!`, '👋'], [`Let's get to it, ${n}.`, '💪']];
      if (h >= 4 && h < 12) pool.push([`Good morning, ${n}!`, '☀️'], [`Morning, ${n}!`, '☕'], [`Rise and shine, ${n}!`, '🌅']);
      else if (h < 17) pool.push([`Good afternoon, ${n}!`, '🌤️'], [`Afternoon, ${n}!`, '🙌']);
      else pool.push([`Good evening, ${n}!`, '🌙'], [`Evening, ${n}!`, '✨']);
      if (wd === 1) pool.push([`Happy Monday, ${n}!`, '💼'], [`New week, ${n}. Let's go.`, '🚀']);
      if (wd === 3) pool.push([`Halfway there, ${n}!`, '⛰️']);
      if (wd === 5) pool.push([`Happy Friday, ${n}!`, '🎉'], [`Almost the weekend, ${n}!`, '🙌']);
      if (wd === 0 || wd === 6) pool.push([`Happy ${now.toLocaleDateString(undefined, { weekday: 'long' })}, ${n}!`, '🛋️']);
      if (m >= 9 && m <= 11) pool.push([`Cozy fall vibes, ${n}.`, '🍂']);
      if (m === 12 || m <= 2) pool.push([`Stay warm, ${n}!`, '❄️']);
      if (m >= 3 && m <= 5) pool.push([`Happy spring, ${n}!`, '🌷']);
      if (extra)
        pool.push([`Let's gooo, ${n}!`, '🚀'], [`${n} has entered the chat.`, '😎'], [`Main character energy, ${n}.`, '✨'], [`Big brain time, ${n}.`, '🧠'], [`You're doing great, ${n}.`, '🌟']);
    }
    const last = store.get('lastHello', '');
    const choices = pool.filter((p) => p[0] !== last);
    const chosen = pick(choices.length ? choices : pool);
    store.set('lastHello', chosen[0]);
    return extra && chosen[1] ? `${chosen[0]} ${chosen[1]}` : chosen[0];
  }

  // ----- Settings live in a "Classroom" tab inside BetterCampus's own settings panel (its gear,
  // top right of the dashboard's to-do list).
  const FONTS = [
    ['fredoka', 'Rounded'],
    ['poppins', 'Bold'],
    ['playfair', 'Serif'],
    ['caveat', 'Handwritten'],
    ['grotesk', 'Grotesk'],
    ['canvas', 'Plain'],
  ];
  const UI_FONTS = [
    ['', 'Canvas'],
    ['nunito', 'Nunito'],
    ['lexend', 'Lexend'],
    ['lora', 'Lora'],
  ];
  function settingsHtml() {
    const p = prefs();
    const toggle = (k, label, sub) =>
      `<label class="gcx-set-row"><span><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span><input type="checkbox" class="gcx-switch" data-k="${k}" ${p[k] ? 'checked' : ''}></label>`;
    return `
      <div class="gcx-set-h">Dashboard</div>
      <div class="gcx-set-card">
        ${toggle('greeting', 'Greeting', 'The hello at the top of the dashboard')}
        <div class="gcx-set-sub" data-needs="greeting">
          <div class="gcx-set-lbl">Style</div>
          <div class="gcx-set-tone" role="radiogroup" aria-label="Greeting style">${['calm', 'normal', 'extra']
            .map((t) => `<button type="button" role="radio" data-tone="${t}" aria-checked="${p.tone === t}">${t === 'calm' ? 'Calm' : t === 'normal' ? 'Normal' : 'Extra 🎉'}</button>`)
            .join('')}</div>
          <div class="gcx-set-lbl">Font</div>
          <div class="gcx-set-fonts" role="radiogroup" aria-label="Greeting font">${FONTS.map(
            ([k, label]) => `<button type="button" role="radio" data-font="${k}" aria-checked="${p.font === k}"><span class="gcx-font-${k}">Aa</span><small>${label}</small></button>`,
          ).join('')}</div>
        </div>
        <div class="gcx-set-sub gcx-set-gap">
          <div class="gcx-set-lbl">Space between the menu rail and your classes <span class="gcx-set-val">${p.dashGap}px</span></div>
          <input type="range" class="gcx-set-range" data-range="dashGap" data-unit="px" min="0" max="${DASH_GAP_MAX}" step="8" value="${p.dashGap}" aria-label="Space between the menu rail and your classes">
        </div>
        ${toggle('ask', 'AI button', 'The AI button next to the greeting')}
        ${toggle('hotkey', 'Ctrl + Space anywhere', 'Opens Ask anything in the middle of any Canvas page, even with the button hidden. Ctrl + Shift + Space brings back your last chat')}
        ${toggle('routing', 'Quick model for simple questions', 'Quick lookups use a smaller, cheaper model; reading, explaining and planning use the full one')}
        ${toggle('suggest', 'Suggestions in Inbox', 'Gray text suggests how a message goes on, or a whole reply when the box is empty. Tab takes it, Ctrl + → takes a word, Esc hides it. The conversation and your draft are sent to OpenAI to write it')}
      </div>
      <div class="gcx-set-h">Look</div>
      <div class="gcx-set-card">
        <div class="gcx-set-sub">
          <div class="gcx-set-lbl">Style (sets everything below in one go; dark ones color the rest of Canvas when BetterCampus's dark mode is on)</div>
          <div class="gcx-set-looks" role="radiogroup" aria-label="Style">${LOOKS.map(
            (l) =>
              `<button type="button" role="radio" data-look="${l.id}" aria-checked="${(p.look || '') === l.id}" title="${l.label}"><span class="gcx-lk"${
                l.vars ? ` style="--lk-bg:${l.vars[0]};--lk-card:${l.vars[3]};--lk-text:${l.vars[4]};--lk-bar:${(THEMES.find((t) => t[0] === l.set.theme) || [])[2] || l.vars[8]}"` : ''
              }><i></i><b></b><b></b></span><small>${l.label}</small></button>`,
          ).join('')}</div>
        </div>
        <div class="gcx-set-sub">
          <div class="gcx-set-lbl">Theme (menu rail and accents; School uses your school's Canvas colors and logo)</div>
          <div class="gcx-set-themes" role="radiogroup" aria-label="Theme">${THEMES.map(
            ([k, label, color]) =>
              `<button type="button" role="radio" data-theme="${k}" aria-checked="${themeOf(p) === k}" title="${label}"><span class="gcx-sw gcx-sw-${k || 'default'}" style="${color ? `--sw:${color}` : ''}"></span><small>${label}</small></button>`,
          ).join('')}</div>
          </div>
        ${toggle('uniform', 'Classes take the theme color', 'With a theme on, every class card, banner and chip uses the theme color instead of its own').replace('<label class="gcx-set-row"', '<label class="gcx-set-row" data-needs="theme"')}
        <div class="gcx-set-sub">
          <div class="gcx-set-lbl">Font for everything</div>
          <div class="gcx-set-fonts gcx-set-uifonts" role="radiogroup" aria-label="Font for everything">${UI_FONTS.map(
            ([k, label]) => `<button type="button" role="radio" data-uifont="${k}" aria-checked="${(p.uiFont || '') === k}"><span class="gcx-ui-${k || 'canvas'}">Aa</span><small>${label}</small></button>`,
          ).join('')}</div>
        </div>
        <div class="gcx-set-sub">
          <div class="gcx-set-lbl">Background</div>
          <div class="gcx-set-tone gcx-set-arts" role="radiogroup" aria-label="Background">${ARTS.map(
            ([k, label]) => `<button type="button" role="radio" data-art="${k}" aria-checked="${(p.art || '') === k}">${label}</button>`,
          ).join('')}</div>
          <div class="gcx-set-bgmine">
            <button type="button" class="gcx-set-try gcx-set-bgup">Upload a picture</button>
            <input type="file" class="gcx-set-bgfile" accept="image/jpeg,image/png,image/webp,image/gif" hidden>
            <form class="gcx-set-bggen"><input type="text" maxlength="300" placeholder="Or describe one for AI: misty mountains at dawn" aria-label="Describe a background for AI to make"><button type="submit" class="gcx-set-try">Make it</button></form>
          </div>
          <div class="gcx-set-need" data-needs="art">
            <div class="gcx-set-lbl">Strength <span class="gcx-set-val">${p.artAmt}%</span></div>
            <input type="range" class="gcx-set-range" data-range="artAmt" min="5" max="100" step="1" value="${p.artAmt}" aria-label="Background strength">
          </div>
        </div>
        ${toggle('tint', 'Color over class images', "Each class image takes a wash of that class's color, like Canvas's own color overlay")}
        <div class="gcx-set-sub" data-needs="tint">
          <div class="gcx-set-lbl">Strength <span class="gcx-set-val">${p.tintAmt}%</span></div>
          <input type="range" class="gcx-set-range" data-range="tintAmt" min="10" max="90" step="5" value="${p.tintAmt}" aria-label="Color strength">
        </div>
        ${toggle('gray', 'Black and white class images', 'Takes the color out of class pictures; the color wash above still applies')}
        <div class="gcx-set-sub">
          <div class="gcx-set-lbl">Dim class images <span class="gcx-set-val">${p.dim}%</span></div>
          <input type="range" class="gcx-set-range" data-range="dim" min="0" max="60" step="5" value="${p.dim}" aria-label="Dim class images">
        </div>
        <div class="gcx-set-sub">
          <div class="gcx-set-lbl">Darken class images (so white titles stand out)</div>
          <div class="gcx-set-tone" role="radiogroup" aria-label="Darken class images">${SHADES.map(
            ([label, v]) => `<button type="button" role="radio" data-shade="${v}" aria-checked="${p.shade === v}">${label}</button>`,
          ).join('')}</div>
        </div>
      </div>
      <div class="gcx-set-h">Motion</div>
      <div class="gcx-set-card">
        ${toggle('motion', 'Page animations', 'Slides between tabs, pages easing in')}
        ${toggle('cardRipple', 'Ripple on class cards', 'The circle that spreads from where you click a class card')}
        ${toggle('annReveal', 'Reveal announcements as you scroll', 'Past the first two, each one fades and slides up as it comes into view')}
      </div>
      <div class="gcx-set-h">Fun</div>
      <div class="gcx-set-card">
        ${toggle('confetti', 'Confetti when you submit', 'Goes seasonal on holidays')}
        <div class="gcx-set-row gcx-set-try-row"><button type="button" class="gcx-set-try">Try confetti</button></div>
        <div class="gcx-set-pets"></div>
      </div>`;
  }
  function bindSettings(box) {
    // pets.js fills its own controls into .gcx-set-pets (same content-script world, so the event's
    // detail is the live element).
    setTimeout(() => window.dispatchEvent(new CustomEvent('gcx:settings', { detail: box })), 0);
    const save = (patch) => {
      store.set('prefs', { ...prefs(), ...patch });
      applyWelcomePrefs();
      applyFontPref();
      applyShadePref();
      applyLayoutPref();
      if ('school' in patch || 'uniform' in patch || 'theme' in patch) applySchoolPref();
      if ('look' in patch) applyLook(true);
      else if ('uiFont' in patch || 'art' in patch || 'artAmt' in patch) applyLook();
      html.classList.toggle('gcx-still', !prefs().motion);
      window.dispatchEvent(new CustomEvent('gcx:prefs'));
    };
    const needs = (k) => (k === 'theme' ? !!themeOf(prefs()) : prefs()[k]);
    // His own background: an upload, or one made with AI. Kept at screen size, then shown.
    const useBackdrop = async (blob) => {
      const data = await shrinkBackdrop(blob);
      await chrome.storage.local.set({ [BG_KEY]: data });
      bgMine = data;
      const amt = prefs().art === 'mine' ? {} : { artAmt: 35 };
      save({ art: 'mine', ...amt });
      box.querySelectorAll('[data-art]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.art === 'mine')));
      const r = box.querySelector('[data-range="artAmt"]');
      if (r) {
        r.value = prefs().artAmt;
        const val = r.parentElement.querySelector('.gcx-set-val');
        if (val) val.textContent = `${prefs().artAmt}%`;
      }
      sync();
    };
    box.querySelector('.gcx-set-bgfile')?.addEventListener('change', async (e) => {
      if (!e.isTrusted) return;
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        await useBackdrop(file);
      } catch (err) {
        toast(`Couldn't use that picture: ${err.message || err}`);
      }
    });
    box.querySelector('.gcx-set-bggen')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!e.isTrusted) return;
      const form = e.currentTarget;
      const text = form.querySelector('input').value.trim();
      const go = form.querySelector('button');
      if (!text || go.disabled) return;
      go.disabled = true;
      go.textContent = 'Making…';
      try {
        const r = await chrome.runtime.sendMessage({ type: 'genBackdrop', prompt: text });
        if (!r || !r.data) throw new Error((r && r.error) || 'No picture came back');
        await useBackdrop(await (await fetch(r.data)).blob());
      } catch (err) {
        toast(`Couldn't make that background: ${err.message || err}`);
      } finally {
        go.disabled = false;
        go.textContent = 'Make it';
      }
    });
    const sync = () => box.querySelectorAll('[data-needs]').forEach((n) => n.classList.toggle('off', !needs(n.dataset.needs)));
    sync();
    box.addEventListener('change', (e) => {
      const k = e.target.dataset && e.target.dataset.k;
      if (k) save({ [k]: e.target.checked });
      sync();
    });
    // Sliders save as they move, so the cards behind the panel change live.
    box.addEventListener('input', (e) => {
      const k = e.target.dataset && e.target.dataset.range;
      if (!k) return;
      save({ [k]: Number(e.target.value) });
      const val = e.target.parentElement.querySelector('.gcx-set-val');
      if (val) val.textContent = `${e.target.value}${e.target.dataset.unit || '%'}`;
    });
    box.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tone]');
      const f = e.target.closest('[data-font]');
      const sh = e.target.closest('[data-shade]');
      const th = e.target.closest('[data-theme]');
      const lk = e.target.closest('[data-look]');
      const uf = e.target.closest('[data-uifont]');
      const ar = e.target.closest('[data-art]');
      if (lk) {
        const l = LOOKS.find((x) => x.id === lk.dataset.look);
        if (!l) return;
        save({ look: l.id, ...(l.set || {}), ...(l.set ? { school: false } : {}) });
        applySchoolPref();
        // The rows below show what it set.
        const now = prefs();
        const mark = (sel, key) => box.querySelectorAll(`[${sel}]`).forEach((b) => b.setAttribute('aria-checked', String(b.getAttribute(sel) === String(now[key] || ''))));
        mark('data-look', 'look');
        mark('data-theme', 'theme');
        mark('data-font', 'font');
        mark('data-uifont', 'uiFont');
        mark('data-art', 'art');
        const u = box.querySelector('[data-k="uniform"]');
        if (u) u.checked = now.uniform !== false;
        const amt = box.querySelector('[data-range="artAmt"]');
        if (amt) {
          amt.value = now.artAmt;
          const val = amt.parentElement.querySelector('.gcx-set-val');
          if (val) val.textContent = `${now.artAmt}%`;
        }
        if (welcomeCtx) reveal(welcomeCtx.wel.querySelector('.gcx-hello'));
        sync();
      } else if (uf) {
        save({ uiFont: uf.dataset.uifont });
        box.querySelectorAll('[data-uifont]').forEach((b) => b.setAttribute('aria-checked', String(b === uf)));
      } else if (ar) {
        if (ar.dataset.art === 'mine' && !bgMine) {
          if (bgMine === null) {
            // Not read yet this page: look first, then come back here.
            chrome.storage.local.get(BG_KEY).then(
              (r) => {
                bgMine = r[BG_KEY] || '';
                ar.click();
              },
              () => {},
            );
            return;
          }
          // Nothing of his yet: pick one first.
          box.querySelector('.gcx-set-bgfile').click();
          return;
        }
        save({ art: ar.dataset.art });
        box.querySelectorAll('[data-art]').forEach((b) => b.setAttribute('aria-checked', String(b === ar)));
        sync();
      } else if (e.target.closest('.gcx-set-bgup')) {
        box.querySelector('.gcx-set-bgfile').click();
      } else if (th) {
        save({ theme: th.dataset.theme, school: false });
        applySchoolPref();
        box.querySelectorAll('[data-theme]').forEach((b) => b.setAttribute('aria-checked', String(b === th)));
        sync();
      } else if (sh) {
        save({ shade: Number(sh.dataset.shade) });
        box.querySelectorAll('[data-shade]').forEach((b) => b.setAttribute('aria-checked', String(b === sh)));
      } else if (t) {
        save({ tone: t.dataset.tone });
        box.querySelectorAll('[data-tone]').forEach((b) => b.setAttribute('aria-checked', String(b === t)));
        if (welcomeCtx) setHello(greeting(welcomeCtx.name, welcomeCtx.items, welcomeCtx.lastVisit), true);
      } else if (f) {
        save({ font: f.dataset.font });
        box.querySelectorAll('[data-font]').forEach((b) => b.setAttribute('aria-checked', String(b === f)));
        if (welcomeCtx) reveal(welcomeCtx.wel.querySelector('.gcx-hello'));
      } else if (e.target.closest('.gcx-set-try') && !e.target.closest('.gcx-set-bggen')) confetti();
    });
  }

  // BetterCampus renders its settings panel in the shadow root of <test-element>. We add a
  // "Classroom" tab to its tab strip; picking it puts ours in BetterCampus's settings column
  // (its live dashboard preview stays on the left, like its own tabs), or, if that column can't be
  // found, in place of its whole content.
  const bc = { sr: null, active: false, panel: null, hidden: [], slot: null, dimmed: [] };
  const bcHide = (nodes) => {
    for (const n of nodes) {
      if (n === bc.panel || bc.hidden.includes(n)) continue;
      n.style.display = 'none';
      bc.hidden.push(n);
    }
  };
  const bcBar = () => bc.sr && bc.sr.querySelector('[data-tab-id="popup:themes"]')?.parentElement;
  function bcDeactivate() {
    if (!bc.active) return;
    bc.active = false;
    bc.panel?.remove();
    bc.panel = null;
    bc.hidden.forEach((n) => (n.style.display = ''));
    bc.hidden = [];
    bc.slot = null;
    bc.dimmed.forEach((n) => (n.style.opacity = ''));
    bc.dimmed = [];
    const mine = bc.sr && bc.sr.querySelector('[data-gcx-tab]');
    if (mine) mine.classList.remove('gcx-on');
  }
  function bcActivate() {
    const bar = bcBar();
    if (!bar) return;
    const header = bar.parentElement.parentElement;
    const col = header.parentElement;
    const content = [...col.children].find((c) => c !== header && !c.classList.contains('gcx-bc-panel'));
    if (!content) return;
    bc.active = true;
    bar.querySelector('[data-gcx-tab]').classList.add('gcx-on');
    // BetterCampus's own active tab and its underline step back while ours is showing.
    bc.dimmed = [...bar.querySelectorAll('[data-tab-id]'), ...[...(bar.parentElement.children[1]?.children || [])]];
    bc.dimmed.forEach((n) => (n.style.opacity = n.hasAttribute('data-tab-id') ? '0.6' : '0'));
    const slot = content.querySelector('[data-tour="edit-canvas-panel"]');
    if (!bc.panel || !bc.panel.isConnected) {
      bc.hidden.forEach((n) => (n.style.display = ''));
      bc.hidden = [];
      bc.panel = document.createElement('div');
      bc.panel.className = 'gcx-bc-panel' + (slot ? ' gcx-in-col' : '');
      bc.panel.innerHTML = `<div class="gcx-bc-panel-in">${settingsHtml()}</div>`;
      bindSettings(bc.panel);
      if (slot) slot.append(bc.panel);
      else content.after(bc.panel);
    }
    bc.slot = slot;
    bcHide(slot ? slot.children : [content]);
    // BetterCampus's buttons over the preview (theme Edit / Create...) open its own pages: give the
    // panel back to it. Zoom, reset and the two theme switches don't change pages.
    if (slot && !content.dataset.gcxWired) {
      content.dataset.gcxWired = '1';
      content.addEventListener(
        'click',
        (e) => {
          const b = e.target.closest('button');
          if (!bc.active || !b || !b.closest('[data-theme-chrome]') || b.getAttribute('role') === 'switch' || /zoom|reset/i.test(b.title || '')) return;
          bcDeactivate();
        },
        true,
      );
    }
  }
  // The settings tab he used last ('classroom' for ours, else BetterCampus's data-tab-id).
  const SET_TAB = 'setTab';
  let wantTab = null; // a tab to open the next time the panel opens
  const activeBcTab = (bar) => {
    const on = [...bar.querySelectorAll('[data-tab-id]')].find((b) => /rounded-t-xl|text-theme-0|\bactive\b/.test(b.className) || b.getAttribute('aria-selected') === 'true');
    return (on && on.dataset.tabId) || '';
  };
  function goToSetTab(tab) {
    const bar = bcBar();
    if (!bar) return;
    if (tab === 'classroom') bcActivate();
    else bar.querySelector(`[data-tab-id="${CSS.escape(tab)}"]`)?.click();
  }
  function bcInject() {
    const bar = bcBar();
    if (!bar) {
      bc.open = false;
      bcDeactivate();
      return;
    }
    if (!bc.sr.getElementById('gcx-set-css')) {
      const st = document.createElement('style');
      st.id = 'gcx-set-css';
      st.textContent = SETTINGS_CSS;
      bc.sr.append(st);
    }
    if (!bar.querySelector('[data-gcx-tab]')) {
      const b = document.createElement('button');
      b.dataset.gcxTab = '1';
      b.type = 'button';
      b.className = 'pointer-events-auto transition-opacity duration-200 gcx-bc-tab';
      b.textContent = 'Classroom';
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        store.set(SET_TAB, 'classroom');
        bcActivate();
      });
      bar.append(b);
    }
    if (!bar.dataset.gcxWired) {
      bar.dataset.gcxWired = '1';
      bar.addEventListener(
        'click',
        (e) => {
          const t = e.target.closest('[data-tab-id]');
          if (!t) return;
          bcDeactivate();
          if (e.isTrusted) store.set(SET_TAB, t.dataset.tabId);
        },
        true,
      );
    }
    if (bc.active && (!bc.panel || !bc.panel.isConnected)) bcActivate();
    else if (bc.active && bc.panel) {
      // BetterCampus may replace its page (data arriving) while ours is showing: keep it hidden.
      bc.hidden = bc.hidden.filter((n) => n.isConnected);
      if (bc.slot) bcHide(bc.slot.children);
      else {
        const col = bc.panel.parentElement;
        const header = bar.parentElement.parentElement;
        if (col) bcHide([...col.children].filter((c) => c !== header && !c.classList.contains('gcx-bc-panel')));
      }
    }
    // The panel just opened: go to the tab he asked for (the palette button) or, instead of
    // BetterCampus's default To-do page, the one he used last.
    if (!bc.open) {
      bc.open = true;
      const want = wantTab || (/todo/i.test(activeBcTab(bar)) ? store.get(SET_TAB, '') : '');
      wantTab = null;
      if (want) setTimeout(() => goToSetTab(want), 0);
    }
  }
  function hookBcSettings() {
    let tries = 0;
    const find = () => {
      const host = document.querySelector('test-element');
      if (host && host.shadowRoot) {
        bc.sr = host.shadowRoot;
        new MutationObserver(debounce(bcInject, 60)).observe(bc.sr, { childList: true, subtree: true });
        bcInject();
      } else if (tries++ < 20) setTimeout(find, 750);
      else addFallbackSettings();
    };
    find();
  }
  // Without BetterCampus there's no panel to host our tab, so the rail gets a Settings item that
  // opens the same controls in a small panel.
  function addFallbackSettings() {
    fallbackSettings = true;
    if (rail.querySelector('.gcx-fallback-set')) return;
    const b = el(`<button class="gcx-ri gcx-fallback-set" type="button" aria-haspopup="dialog"><span class="gcx-ri-ic">${svg('gear')}</span><span class="gcx-ri-tx"><span class="gcx-ri-name">Settings</span></span></button>`);
    rail.querySelector('.gcx-rail-bottom').prepend(b);
    b.addEventListener('click', () => openFallbackSettings(b));
  }
  function openFallbackSettings(b) {
    {
      const old = document.querySelector('.gcx-fallback-panel:not(.gcx-out)');
      if (old) return old.gcxClose();
      const pop = el(`<div class="gcx-fallback-panel gcx-pop-panel" role="dialog" aria-label="Classroom settings">${settingsHtml()}</div>`);
      if (!document.getElementById('gcx-set-css')) {
        const st = document.createElement('style');
        st.id = 'gcx-set-css';
        st.textContent = SETTINGS_CSS;
        document.head.append(st);
      }
      document.body.append(pop);
      bindSettings(pop);
      const r = b ? b.getBoundingClientRect() : { right: innerWidth / 2, left: innerWidth / 2, bottom: 80 };
      if (b && b.closest('#gcx-rail')) {
        pop.style.left = r.right + 8 + 'px';
        pop.style.top = Math.max(12, innerHeight - pop.offsetHeight - 12) + 'px';
      } else {
        pop.style.left = Math.max(12, Math.min(r.right - pop.offsetWidth, innerWidth - pop.offsetWidth - 12)) + 'px';
        pop.style.top = Math.max(12, Math.min(r.bottom + 8, innerHeight - pop.offsetHeight - 12)) + 'px';
        pop.style.transformOrigin = 'top right';
      }
      if (b) b.setAttribute('aria-expanded', 'true');
      const close = () => {
        pop.classList.add('gcx-out');
        setTimeout(() => pop.remove(), 170);
        if (b) b.setAttribute('aria-expanded', 'false');
        document.removeEventListener('mousedown', outside, true);
        document.removeEventListener('keydown', onKey, true);
      };
      pop.gcxClose = close;
      const outside = (e) => {
        if (pop.contains(e.target) || (b && b.contains(e.target))) return;
        close();
      };
      const onKey = (e) => e.key === 'Escape' && close();
      document.addEventListener('mousedown', outside, true);
      document.addEventListener('keydown', onKey, true);
    }
  }
  const SETTINGS_CSS = `
    /* BetterCampus wraps its panel in pointer-events: none and opts each control back in. */
    .gcx-bc-panel { flex: 1; min-height: 0; overflow-y: auto; padding: 8px 0 24px; pointer-events: auto; animation: gcx-set-in .28s cubic-bezier(.16,.84,.3,1) both; }
    .gcx-bc-panel-in { max-width: 640px; container-type: inline-size; }
    /* In BetterCampus's settings column, next to its dashboard preview */
    .gcx-bc-panel.gcx-in-col { height: 100%; padding: 2px 4px 24px; overscroll-behavior: contain; }
    .gcx-in-col .gcx-bc-panel-in { max-width: none; }
    @keyframes gcx-set-in { from { opacity: 0; transform: translateY(8px); } }
    .gcx-bc-tab { opacity: .6; position: relative; background: none; border: 0; padding: 0; font: inherit; color: inherit; cursor: pointer; }
    .gcx-bc-tab:hover { opacity: 1; }
    .gcx-bc-tab.gcx-on { opacity: 1; }
    .gcx-bc-tab.gcx-on::after { content: ''; position: absolute; left: 0; right: 0; bottom: -10px; height: 3px; border-radius: 3px; background: currentColor; }
    .gcx-set-h { font-size: 13px; font-weight: 600; opacity: .6; margin: 18px 4px 8px; }
    .gcx-set-h:first-child { margin-top: 4px; }
    .gcx-set-card { border-radius: 16px; background: var(--gcx-card, #fff); border: 1px solid var(--gcx-border, #e4e4e7); overflow: hidden; }
    .gcx-set-row { display: flex; align-items: center; gap: 14px; padding: 12px 16px; cursor: pointer; margin: 0; font-weight: 400; }
    .gcx-set-row + .gcx-set-row, .gcx-set-sub + .gcx-set-row, .gcx-set-row + .gcx-set-sub { border-top: 1px solid var(--gcx-border, #e4e4e7); }
    .gcx-set-row:hover { background: var(--gcx-bg2, #f4f4f5); }
    .gcx-set-row > span:first-child { flex: 1; min-width: 0; }
    .gcx-set-row b { display: block; font-weight: 600; font-size: 14px; color: var(--gcx-text, #18181b); }
    .gcx-set-row small { display: block; font-size: 12px; color: var(--gcx-muted, #71717a); line-height: 1.35; margin-top: 1px; }
    .gcx-switch { appearance: none; -webkit-appearance: none; flex: none; position: relative; width: 36px !important; height: 20px !important; margin: 0 !important;
      border-radius: 10px; background: var(--gcx-border, #d4d4d8); cursor: pointer; transition: background-color .18s ease; border: 0 !important; }
    .gcx-switch::after { content: ''; position: absolute; left: 2px; top: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff;
      box-shadow: 0 1px 2px rgba(0,0,0,.25); transition: transform .18s cubic-bezier(.2,.7,.2,1.3); }
    .gcx-switch:checked { background: var(--gcx-link, #4f46e5); }
    .gcx-switch:checked::after { transform: translateX(16px); }
    .gcx-set-sub { padding: 4px 16px 14px; transition: opacity .15s ease; }
    .gcx-set-sub.off, .gcx-set-row.off, .gcx-set-need.off { opacity: .4; pointer-events: none; }
    .gcx-set-lbl { font-size: 12px; font-weight: 600; color: var(--gcx-muted, #71717a); margin: 8px 0 6px; }
    .gcx-set-tone { display: flex; gap: 4px; padding: 3px; border-radius: 10px; background: var(--gcx-bg2, #f4f4f5); }
    .gcx-set-tone button { flex: 1; height: 30px; border: 0; border-radius: 8px; background: none; color: var(--gcx-muted, #71717a); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
    .gcx-set-tone button[aria-checked="true"] { background: var(--gcx-card, #fff); color: var(--gcx-text, #18181b); box-shadow: 0 1px 2px rgba(0,0,0,.12); }
    .gcx-set-val { float: right; font-variant-numeric: tabular-nums; }
    .gcx-set-range { display: block; width: 100%; margin: 4px 0 0; accent-color: var(--gcx-link, #4f46e5); cursor: pointer; }
    .gcx-set-fonts { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; }
    .gcx-set-fonts button { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 2px 6px; border: 1px solid var(--gcx-border, #e4e4e7);
      border-radius: 10px; background: none; color: var(--gcx-text, #18181b); cursor: pointer; font: inherit; transition: border-color .15s ease, background-color .15s ease; }
    .gcx-set-fonts button:hover { background: var(--gcx-bg2, #f4f4f5); }
    .gcx-set-fonts button[aria-checked="true"] { border-color: var(--gcx-link, #4f46e5); background: color-mix(in srgb, var(--gcx-link, #4f46e5) 8%, transparent); }
    .gcx-set-fonts span { font-size: 22px; line-height: 1.1; }
    .gcx-set-themes { display: grid; grid-template-columns: repeat(auto-fill, minmax(48px, 1fr)); gap: 6px; margin-bottom: 4px; }
    .gcx-set-looks { display: grid; grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 8px; margin-bottom: 4px; }
    .gcx-set-looks button { display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 6px 4px; border: 1px solid transparent; border-radius: 12px;
      background: none; color: var(--gcx-text, #18181b); cursor: pointer; font: inherit; transition: border-color .15s ease, background-color .15s ease; }
    .gcx-set-looks button:hover { background: var(--gcx-bg2, #f4f4f5); }
    .gcx-set-looks button[aria-checked="true"] { border-color: var(--gcx-link, #4f46e5); }
    .gcx-set-looks small { font-size: 11px; color: var(--gcx-muted, #71717a); white-space: nowrap; }
    /* A tiny page: the rail, two cards. "None" is BetterCampus's own colors. */
    .gcx-lk { position: relative; display: block; width: 64px; height: 42px; border-radius: 8px; overflow: hidden; background: var(--lk-bg, conic-gradient(#f4f4f5 0 25%, #e4e4e7 0 50%, #f4f4f5 0 75%, #e4e4e7 0) 0 0 / 12px 12px);
      box-shadow: inset 0 0 0 1px rgba(0,0,0,.12); }
    .gcx-lk i { position: absolute; inset: 0 auto 0 0; width: 11px; background: var(--lk-bar, transparent); }
    .gcx-lk b { position: absolute; top: 9px; width: 20px; height: 24px; border-radius: 4px; background: var(--lk-card, transparent); box-shadow: 0 0 0 1px color-mix(in srgb, var(--lk-text, transparent) 14%, transparent); }
    .gcx-lk b:first-of-type { left: 17px; }
    .gcx-lk b:last-of-type { left: 40px; }
    .gcx-lk:not([style]) b, .gcx-lk:not([style]) i { display: none; }
    .gcx-set-uifonts { grid-template-columns: repeat(4, 1fr); }
    .gcx-ui-canvas { font-family: 'Lato Extended', Lato, sans-serif; font-weight: 700; }
    .gcx-ui-nunito { font-family: 'GCX Nunito', sans-serif; font-weight: 700; }
    .gcx-ui-lexend { font-family: 'GCX Lexend', sans-serif; font-weight: 600; }
    .gcx-ui-lora { font-family: 'GCX Lora', serif; font-weight: 700; }
    .gcx-set-arts { margin-bottom: 8px; }
    .gcx-set-bgmine { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 10px; }
    .gcx-set-bggen { display: flex; flex: 1 1 260px; gap: 8px; margin: 0; }
    .gcx-set-bggen input { flex: 1; min-width: 0; height: 30px; padding: 0 12px; border: 1px solid var(--gcx-border, #e4e4e7); border-radius: 15px; background: none; color: var(--gcx-text, #18181b); font: inherit; font-size: 13px; }
    .gcx-set-bggen button:disabled { opacity: .6; cursor: progress; }
    .gcx-set-themes button { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 2px 6px; border: 1px solid transparent; border-radius: 10px;
      background: none; color: var(--gcx-text, #18181b); cursor: pointer; font: inherit; transition: border-color .15s ease, background-color .15s ease; }
    .gcx-set-themes button:hover { background: var(--gcx-bg2, #f4f4f5); }
    .gcx-set-themes button[aria-checked="true"] { border-color: var(--gcx-link, #4f46e5); }
    .gcx-set-themes small { font-size: 10px; color: var(--gcx-muted, #71717a); white-space: nowrap; }
    .gcx-sw { width: 26px; height: 26px; border-radius: 50%; background: var(--sw); box-shadow: inset 0 0 0 1px rgba(0,0,0,.12); }
    .gcx-sw-default { background: linear-gradient(135deg, #fff 50%, #e8eaed 50%); }
    .gcx-sw-school { background: conic-gradient(var(--ic-brand-global-nav-bgd, #bf5700) 0 50%, var(--ic-brand-primary, #2b7abc) 0); }
    .gcx-set-fonts small { font-size: 10px; color: var(--gcx-muted, #71717a); }
    .gcx-font-fredoka { font-family: 'GCX Fredoka', sans-serif; font-weight: 700; }
    .gcx-font-poppins { font-family: 'GCX Poppins', sans-serif; font-weight: 800; }
    .gcx-font-playfair { font-family: 'GCX Playfair', serif; font-weight: 800; }
    .gcx-font-caveat { font-family: 'GCX Caveat', cursive; font-weight: 700; }
    .gcx-font-grotesk { font-family: 'GCX Grotesk', sans-serif; font-weight: 700; }
    .gcx-font-canvas { font-family: inherit; font-weight: 700; }
    .gcx-set-try-row { cursor: default; padding-top: 0; border-top: 0 !important; }
    .gcx-set-try-row:hover { background: none; }
    .gcx-set-try { height: 30px; padding: 0 14px; border: 1px solid var(--gcx-border, #e4e4e7); border-radius: 15px; background: none; color: var(--gcx-link, #4f46e5); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
    .gcx-set-try:hover { background: var(--gcx-bg2, #f4f4f5); }
    .gcx-set-soon { cursor: default; opacity: .7; }
    .gcx-set-soon:hover { background: none; }
    .gcx-soon { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px; background: var(--gcx-bg2, #f4f4f5); color: var(--gcx-muted, #71717a); }
    /* narrow (BetterCampus's settings column): after the base rules, so these win */
    @container (max-width: 520px) {
      .gcx-set-fonts { grid-template-columns: repeat(3, 1fr) !important; }
      .gcx-set-themes { grid-template-columns: repeat(4, 1fr) !important; }
      .gcx-set-row { padding: 12px 14px; }
      .gcx-set-sub { padding: 4px 14px 14px; }
    }
  `;

  // ----- Confetti when he submits something (seasonal on certain days)
  function confettiTheme() {
    const now = new Date();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    const tg = thanksgiving(now.getFullYear());
    if (m === 10 && d >= 15) return ['🎃', '👻', '🦇', '🍬', '🕷️'];
    if (m === 11 && d >= tg - 6 && d <= tg + 3) return ['🦃', '🍂', '🥧', '🌽'];
    if ((m === 12 && d === 31) || (m === 1 && d <= 2)) return ['🎉', '🥳', '✨', '🍾'];
    if (m === 12 && d <= 26) return ['🎅', '🎄', '❄️', '🎁', '⛄'];
    if (m === 2 && d >= 7 && d <= 14) return ['❤️', '💖', '💌', '🌹'];
    if (m === 3 && d === 17) return ['☘️', '🍀'];
    if (m === 7 && d === 4) return ['🎆', '🇺🇸', '✨'];
    return null;
  }
  // Each emoji and paper color is drawn once into a small sprite; every frame then only stamps
  // sprites with a transform (no text layout, no save/restore), so it stays smooth.
  function confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || document.querySelector('.gcx-confetti')) return;
    const emoji = confettiTheme();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const sprite = (w, h, paint) => {
      const c = document.createElement('canvas');
      c.width = Math.ceil(w * dpr);
      c.height = Math.ceil(h * dpr);
      const x = c.getContext('2d');
      x.scale(dpr, dpr);
      paint(x);
      return { c, w, h };
    };
    const colors = ['#1a73e8', '#d93025', '#f9ab00', '#188038', '#9334e6', '#e8710a', '#12a4af'];
    const paper = colors.map((col) => sprite(8, 12, (x) => ((x.fillStyle = col), x.fillRect(0, 0, 8, 12))));
    const pics = (emoji || []).map((e) =>
      sprite(40, 40, (x) => {
        x.font = '30px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillText(e, 20, 22);
      }),
    );
    const cv = document.createElement('canvas');
    cv.className = 'gcx-confetti';
    cv.width = Math.round(innerWidth * dpr);
    cv.height = Math.round(innerHeight * dpr);
    document.body.append(cv);
    const ctx = cv.getContext('2d');
    const parts = Array.from({ length: pics.length ? 56 : 90 }, (_, i) => {
      const fromLeft = i % 2 === 0;
      const isPic = pics.length && Math.random() < 0.7;
      return {
        x: fromLeft ? -10 : innerWidth + 10,
        y: innerHeight * (0.55 + Math.random() * 0.3),
        vx: (fromLeft ? 1 : -1) * (6 + Math.random() * 9),
        vy: -(11 + Math.random() * 9),
        r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        s: isPic ? 0.85 + Math.random() * 0.45 : 0.8 + Math.random() * 0.6,
        sp: isPic ? pics[i % pics.length] : paper[i % paper.length],
        flip: !isPic,
      };
    });
    const t0 = performance.now();
    let last = t0;
    const frame = (t) => {
      const age = t - t0;
      // Step physics by real elapsed time (60 fps units) so a slow frame doesn't slow the fall.
      const k = Math.min(3, (t - last) / 16.7);
      last = t;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.globalAlpha = Math.max(0, Math.min(1, (3200 - age) / 700));
      for (const p of parts) {
        p.vy += 0.38 * k;
        p.vx *= Math.pow(0.985, k);
        p.x += p.vx * k;
        p.y += p.vy * k;
        p.r += p.vr * k;
        if (p.y > innerHeight + 60) continue;
        const cos = Math.cos(p.r) * p.s * dpr;
        const sin = Math.sin(p.r) * p.s * dpr;
        // Paper pieces "flip" by squashing one axis as they spin.
        const sq = p.flip ? Math.abs(Math.cos(p.r * 2)) + 0.15 : 1;
        ctx.setTransform(cos, sin, -sin * sq, cos * sq, p.x * dpr, p.y * dpr);
        ctx.drawImage(p.sp.c, -p.sp.w / 2, -p.sp.h / 2, p.sp.w, p.sp.h);
      }
      if (age < 3200) requestAnimationFrame(frame);
      else cv.remove();
    };
    requestAnimationFrame(frame);
  }
  // Classic submissions reload the page, so leave a note (naming the assignment or quiz) and
  // celebrate when that same assignment or quiz loads. Newer Canvas pages submit in place, so a
  // click on a Submit button also watches briefly for Canvas's own "Submitted" message.
  function watchSubmissions() {
    const workPath = () => (location.pathname.match(/^\/courses\/\d+\/(?:assignments|quizzes)\/\d+/) || [])[0] || '';
    let celebrated = false;
    const celebrate = () => {
      if (celebrated || !prefs().confetti) return;
      celebrated = true;
      try {
        sessionStorage.removeItem('gcx:celebrate');
      } catch {}
      confetti();
    };
    try {
      const note = JSON.parse(sessionStorage.getItem('gcx:celebrate') || 'null');
      if (note && Date.now() - note.t < 60000 && note.path && location.pathname.startsWith(note.path)) setTimeout(celebrate, 600);
      else if (note && Date.now() - note.t >= 60000) sessionStorage.removeItem('gcx:celebrate');
    } catch {}

    // Only the real hand-in forms, and only if nothing (validation, a confirm) cancelled them.
    document.addEventListener(
      'submit',
      (e) => {
        const f = e.target;
        if (!f || !/^(submit_assignment_form|submit_quiz_form)$/.test(f.id) || !workPath()) return;
        setTimeout(() => {
          if (e.defaultPrevented) return;
          try {
            sessionStorage.setItem('gcx:celebrate', JSON.stringify({ t: Date.now(), path: workPath() }));
          } catch {}
        });
      },
      true,
    );

    // One shared watcher; each Submit click just extends its deadline.
    let watchUntil = 0;
    let watcher = null;
    const SUCCESS = /(?<!\bnot\s)\bsubmitted\b|\bsubmission (was )?successful\b/i;
    const check = debounce(() => {
      if (Date.now() > watchUntil) {
        watcher.disconnect();
        watcher = null;
        return;
      }
      const hit = [...document.querySelectorAll('[role="alert"], [role="status"], .flashalert-message, #flash_message_holder')].some((n) => SUCCESS.test(n.textContent));
      if (hit) {
        watcher.disconnect();
        watcher = null;
        celebrate();
      }
    }, 150);
    document.addEventListener(
      'click',
      (e) => {
        const b = e.target.closest && e.target.closest('button, input[type="submit"]');
        if (!b || !workPath() || !/^\s*(submit( assignment| quiz)?|turn in)\s*$/i.test(b.textContent || b.value || '')) return;
        watchUntil = Date.now() + 20000;
        if (!watcher) {
          watcher = new MutationObserver(check);
          watcher.observe(document.body, { childList: true, subtree: true, characterData: true });
        }
      },
      true,
    );
  }


  // BetterCampus's to-do items restyled like Google Classroom's to-do: flat rows, a round
  // course-colored icon, the title, the course in small grey text, the due date muted (urgent
  // ones keep their red pill). Only the look changes; BetterCampus's own checkboxes and menus still work.
  const maskIcon = (name) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='${ICONS[name]}'/></svg>`)}")`;
  const BC_CLASSROOM_CSS = `
    #bettercanvas-todo-list .group { border-radius: 10px !important; filter: none !important; overflow: visible !important; transition: background-color .15s ease !important; }
    #bettercanvas-todo-list .group:hover { background: var(--gcx-bg2, #f1f3f4); }
    #bettercanvas-todo-list .group > [class*="absolute"][class*="bg-theme-border"] { display: none !important; }
    #bettercanvas-todo-list .group > [aria-label][class*="pointer-events-none"] {
      top: 10px !important; bottom: auto !important; left: 6px !important; width: 32px !important; height: 32px !important;
      border-radius: 50% !important;
    }
    #bettercanvas-todo-list .group > [aria-label][class*="pointer-events-none"]::after {
      content: ''; width: 18px; height: 18px; background: #fff;
      -webkit-mask: ${maskIcon('assignment')} center / contain no-repeat; mask: ${maskIcon('assignment')} center / contain no-repeat;
    }
    #bettercanvas-todo-list .group > [aria-label="Quiz"][class*="pointer-events-none"]::after { -webkit-mask-image: ${maskIcon('quiz')}; mask-image: ${maskIcon('quiz')}; }
    #bettercanvas-todo-list .group > [aria-label="Discussion"][class*="pointer-events-none"]::after { -webkit-mask-image: ${maskIcon('discussion')}; mask-image: ${maskIcon('discussion')}; }
    #bettercanvas-todo-list .group > [class*="z-[1]"] {
      margin-left: 46px !important; border: 0 !important; background: transparent !important; border-radius: 0 !important;
    }
    #bettercanvas-todo-list .group > [class*="z-[1]"] > div { padding: 8px 6px 8px 0 !important; }
    #bettercanvas-todo-list .group p.text-course { color: var(--gcx-muted, #5f6368) !important; font-weight: 500 !important; font-size: 12px !important; }
    #bettercanvas-todo-list .group a[href] { font-size: 14px !important; font-weight: 500 !important; line-height: 1.3; }
    /* Urgent and past-due dates keep BetterCampus's red pill so they jump out. */
    #bettercanvas-todo-list > div > .bc-btn, #bettercanvas-todo-list > .bc-btn {
      height: 36px !important; border-radius: 18px !important; border: 1px solid var(--gcx-border, #dadce0) !important; box-shadow: none !important;
      background: transparent !important; color: var(--gcx-link, #1a73e8) !important; font-weight: 600 !important; font-size: 13px !important;
      transform: none !important; transition: background-color .15s ease !important;
    }
    #bettercanvas-todo-list > div > .bc-btn:hover, #bettercanvas-todo-list > .bc-btn:hover { background: color-mix(in srgb, var(--gcx-link, #1a73e8) 8%, transparent) !important; }
    #bettercanvas-todo-list [class*="py-1"][class*="overflow-hidden"] > [class*="z-1"] button span.uppercase {
      text-transform: none !important; font-size: 14px !important; font-weight: 600 !important; letter-spacing: 0 !important;
    }
  `;

  // BetterCampus's to-do sidebar lives in an open shadow root. Hide the streak, the
  // progress ring and the Day/Week/Month picker, and cut the list off at two weeks.
  const DUE_RE = /Due\s+(\d{1,2})\/(\d{1,2})/;
  let monthForced = false;
  function tweakBcTodo() {
    const host = document.querySelector('bettercampus-todo-list');
    const sr = host && host.shadowRoot;
    if (!sr) return false;
    if (!sr.getElementById('gcx-bc-style')) {
      const st = document.createElement('style');
      st.id = 'gcx-bc-style';
      st.textContent = `[data-gcx-hide],[data-gcx-cap]{display:none !important}
        #gcx-bc-more{display:flex;align-items:center;justify-content:center;gap:6px;width:calc(100% - 8px);margin:6px 4px 2px;height:34px;border-radius:17px;
          border:1px solid var(--bcborders,#dadce0);background:transparent;color:var(--bclinks,#1a73e8);font:inherit;font-size:13px;font-weight:600;cursor:pointer;
          transition:background-color .15s ease, transform .1s ease}
        #gcx-bc-more:hover{background:var(--bcbackground-1,#f1f3f4)}
        #gcx-bc-more:active{transform:scale(.97)}
        [data-gcx-new]{animation:gcx-bc-in .32s cubic-bezier(.2,.7,.2,1) both}
        @keyframes gcx-bc-in{from{opacity:0;transform:translateY(-4px)}}
        :host-context(html.gcx-uniform) .group{--bc-course-ring:var(--gcx-accent) !important;--bc-course-text:var(--gcx-accent) !important}
        :host-context(html.gcx-uniform) .group > [aria-label][class*="pointer-events-none"]{background-color:var(--gcx-accent) !important}
        ${BC_CLASSROOM_CSS}`;
      sr.append(st);
      let lastSig = '';
      new MutationObserver(
        debounce(() => {
          const list = sr.getElementById('bettercanvas-todo-list');
          const sig = list ? `${list.querySelectorAll('.group').length}|${list.textContent.length}|${list.childElementCount}` : '';
          if (sig === lastSig) return;
          lastSig = sig;
          applyBcTodo(sr);
        }, 60),
      ).observe(sr, { childList: true, subtree: true, characterData: true });
    }
    applyBcTodo(sr);
    return true;
  }
  const setHidden = (n, hide) => {
    if (!n) return;
    if (hide && !n.hasAttribute('data-gcx-hide')) n.setAttribute('data-gcx-hide', '');
    else if (!hide && n.hasAttribute('data-gcx-hide')) n.removeAttribute('data-gcx-hide');
  };
  const BC_CAP = 6;
  let bcExpanded = false;
  let bcTabTries = 0;
  function applyBcTodo(sr) {
    const list = sr.getElementById('bettercanvas-todo-list');
    if (!list) return;
    // The premium "Sync" button in the header.
    for (const b of list.querySelectorAll('button')) if ([...b.querySelectorAll('p')].some((p) => p.textContent.trim() === 'Sync')) setHidden(b, true);
    // Announcements / To-do / Completed tabs: keep him on To-do and hide the tabs.
    const bar = [...list.querySelectorAll('div')].find(
      (d) => d.children.length === 3 && [...d.children].every((b) => b.tagName === 'BUTTON' && b.dataset.slot === 'tooltip-trigger'),
    );
    let panel = null;
    if (bar) {
      setHidden(bar, true);
      const tabs = [...bar.children];
      const active = tabs.findIndex((b) => /rounded-t-xl/.test(b.className));
      if (active !== 1 && active !== -1 && bcTabTries++ < 5) tabs[1].click();
      panel = bar.nextElementSibling;
    }
    for (const ch of list.children) {
      const h3 = ch.querySelector('h3');
      const picker = ch.querySelector('button[aria-haspopup="menu"]');
      if (h3 && /streak/i.test(h3.textContent)) setHidden(ch, true);
      else if (picker) {
        setHidden(ch, true);
        forceMonth(picker);
      } else if (ch.matches('[data-todo-section]') && !ch.querySelector('a[href]') && /\d+%/.test(ch.textContent)) setHidden(ch, true);
    }
    // Two-week horizon: BetterCampus's free ranges are a day, a week or a month.
    const horizon = horizonEnd();
    const now = new Date();
    for (const p of list.querySelectorAll('p')) {
      const m = p.textContent.match(DUE_RE);
      if (!m || p.children.length > 3) continue;
      const item = p.closest('.group');
      if (!item) continue;
      let due = new Date(now.getFullYear(), Number(m[1]) - 1, Number(m[2]));
      if (due - now > 180 * DAY) due = new Date(now.getFullYear() - 1, Number(m[1]) - 1, Number(m[2]));
      else if (now - due > 180 * DAY) due = new Date(now.getFullYear() + 1, Number(m[1]) - 1, Number(m[2]));
      setHidden(item.parentElement, due >= horizon);
    }
    // Hide a "Due Later"-style section once every item in it is past the horizon.
    for (const btn of list.querySelectorAll('button[type="button"]')) {
      const section = btn.parentElement && btn.parentElement.parentElement;
      if (!section || !section.classList.contains('relative')) continue;
      const items = [...section.querySelectorAll('.group')];
      if (!items.length) continue;
      setHidden(section, items.every((g) => g.parentElement.hasAttribute('data-gcx-hide')));
    }
    if (panel) capBcTodo(panel);
    if (bcGhost && bcLive(sr)) releaseBcGhost();
    saveBcTodo(sr);
  }
  // Show the first few items; the rest sit behind "Show more".
  function capBcTodo(panel) {
    const items = [...panel.querySelectorAll('.group')].map((g) => g.parentElement).filter((n) => !n.hasAttribute('data-gcx-hide') && !n.closest('[data-gcx-hide]'));
    items.forEach((n, i) => {
      const cap = !bcExpanded && i >= BC_CAP;
      if (cap !== n.hasAttribute('data-gcx-cap')) cap ? n.setAttribute('data-gcx-cap', '') : n.removeAttribute('data-gcx-cap');
    });
    for (const sec of panel.children) {
      const its = [...sec.querySelectorAll('.group')].map((g) => g.parentElement);
      const cap = !bcExpanded && its.length > 0 && its.every((n) => n.hasAttribute('data-gcx-cap') || n.hasAttribute('data-gcx-hide'));
      if (cap !== sec.hasAttribute('data-gcx-cap')) cap ? sec.setAttribute('data-gcx-cap', '') : sec.removeAttribute('data-gcx-cap');
    }
    let btn = panel.parentElement.querySelector(':scope > #gcx-bc-more');
    const extra = items.length - BC_CAP;
    if (extra <= 0) {
      btn?.remove();
      return;
    }
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'gcx-bc-more';
      btn.type = 'button';
      btn.addEventListener('click', () => {
        // BetterCampus may have re-rendered since this button was made; work on the live list.
        const sr = btn.getRootNode();
        if (!sr || !sr.getElementById) return;
        const rows = () => [...sr.querySelectorAll('.group')].map((g) => g.parentElement);
        const wasCapped = new Set(rows().filter((n) => n.hasAttribute('data-gcx-cap')));
        bcExpanded = !bcExpanded;
        applyBcTodo(sr);
        // Fade in only the rows that just appeared.
        rows().forEach((n) => n.toggleAttribute('data-gcx-new', bcExpanded && wasCapped.has(n)));
      });
    }
    if (panel.nextElementSibling !== btn) panel.after(btn);
    const label = bcExpanded ? 'Show less' : `Show ${extra} more`;
    if (btn.textContent !== label) btn.textContent = label;
  }
  // The 2-week cutoff needs BetterCampus to fetch at least two weeks, so move Day/Week to Month once.
  function forceMonth(trigger) {
    if (monthForced) return;
    const label = trigger.textContent.trim();
    if (label !== 'Day' && label !== 'Week') return;
    monthForced = true;
    trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }));
    setTimeout(() => {
      const portal = document.querySelector('bettercanvas-portal');
      const root = (portal && portal.shadowRoot) || document;
      const month = [...root.querySelectorAll('[role="menuitem"]')].find((n) => n.textContent.trim() === 'Month');
      if (month) month.click();
    }, 250);
  }

  // ---------------------------------------------------------------- toast
  let toastEl = null;
  let toastTimer = 0;
  function toast(msg, actionLabel, action) {
    if (!toastEl) {
      toastEl = el('<div class="gcx-toast" role="status" aria-live="polite"></div>');
      document.body.append(toastEl);
    }
    toastEl.textContent = msg;
    if (actionLabel && action) {
      const b = el(`<button type="button" class="gcx-toast-btn">${esc(actionLabel)}</button>`);
      b.addEventListener('click', () => {
        toastEl.classList.remove('show');
        action();
      });
      toastEl.append(b);
    }
    toastEl.classList.remove('show');
    void toastEl.offsetWidth;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), actionLabel ? 5000 : 2600);
  }

  // ---------------------------------------------------------------- readable rich content in dark mode
  // Reads rgb(…) and Chrome's color(srgb 0-1 …) forms.
  const rgbOf = (str) => {
    const n = (String(str).match(/\d+(?:\.\d+)?/g) || []).slice(0, 3).map(Number);
    return /^color\(srgb/.test(String(str)) ? n.map((v) => v * 255) : n;
  };
  const lum = ([r, g, b]) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  // On (or inside) a highlight that's actually drawn (BetterCampus's dark theme clears most pasted
  // backgrounds; what's left is a real highlight): its color was picked for that highlight.
  const highlighted = (n, root, pageL) => {
    for (let x = n; x && x !== root; x = x.parentElement) {
      const bg = getComputedStyle(x).backgroundColor;
      const a = (String(bg).match(/rgba\([^)]*,\s*([\d.]+)\)/) || [])[1];
      if (/transparent/.test(bg) || (a != null && Number(a) < 0.3)) continue;
      const c = rgbOf(bg);
      if (c.length === 3 && Math.abs(lum(c) - pageL) > 0.08) return true;
    }
    return false;
  };
  // Only text the instructor colored themselves (an inline color), with no highlight of its own
  // behind it. The original color is kept, so switching back to light mode restores it.
  function fixInlineColors(root) {
    if (!root) return;
    const bodyBg = rgbOf(getComputedStyle(document.body).backgroundColor);
    const dark = bodyBg.length === 3 && lum(bodyBg) <= 0.25;
    for (const n of root.querySelectorAll('[style*="color"], font[color]')) {
      // A white background pasted in from another page (a bright bar on a dark page) goes in dark
      // mode; the original comes back in light mode.
      if (n.hasAttribute('data-gcx-bg')) {
        n.style.setProperty('background-color', n.getAttribute('data-gcx-bg'));
        n.removeAttribute('data-gcx-bg');
      }
      if (dark && n.style.backgroundColor) {
        const b = rgbOf(getComputedStyle(n).backgroundColor);
        if (b.length === 3 && lum(b) > 0.85) {
          n.setAttribute('data-gcx-bg', n.style.backgroundColor);
          n.style.setProperty('background-color', 'transparent', 'important');
        }
      }
      if (n.hasAttribute('data-gcx-color')) {
        // Put the original back first; it's re-checked below for the current theme.
        const orig = n.getAttribute('data-gcx-color');
        if (orig) n.style.setProperty('color', orig);
        else n.style.removeProperty('color');
      } else {
        n.setAttribute('data-gcx-color', n.style.color || '');
      }
      if (!dark) continue;
      if (highlighted(n, root, lum(bodyBg))) {
        // A highlight inside lightened text keeps the color the instructor chose for it.
        const up = n.parentElement && n.parentElement.closest('[data-gcx-color]');
        if (!n.style.color && n.tagName !== 'FONT' && up && root.contains(up) && up.getAttribute('data-gcx-color'))
          n.style.setProperty('color', up.getAttribute('data-gcx-color'), 'important');
        continue;
      }
      if (!n.style.color && n.tagName !== 'FONT') continue; // only a background: nothing to recolor
      const c = rgbOf(getComputedStyle(n).color);
      if (c.length < 3) continue;
      const contrast = (Math.max(lum(c), lum(bodyBg)) + 0.05) / (Math.min(lum(c), lum(bodyBg)) + 0.05);
      if (contrast < 4) n.style.setProperty('color', `color-mix(in srgb, rgb(${c.map(Math.round).join(',')}) 45%, #fff)`, 'important');
    }
  }
  // After a dark/light switch, re-check everything that was adjusted.
  const refreshInlineColors = () => document.querySelectorAll('.gcx-stream, .gcx-asg-body').forEach(fixInlineColors);

  // ---------------------------------------------------------------- news (the bell and the pet)
  // What's new for him: unread messages and announcements, recent grades and teacher comments, and
  // work due in the next few days. One fetch every few minutes, shared by every tab.
  const NEWS_TTL = 3 * 6e4;
  const NEWS_V = 2; // bump when the saved list's shape changes
  let newsJob = null;
  function news(fresh = false) {
    if (!PAGE_USER) return Promise.resolve(null);
    const saved = store.get('news', null);
    const mine = saved && saved.user === PAGE_USER && saved.v === NEWS_V ? saved : null;
    if (!fresh && mine && Date.now() - mine.at < NEWS_TTL) return Promise.resolve(mine);
    if (!newsJob)
      newsJob = loadNews()
        .then((n) => {
          store.set('news', n);
          // The rail's Inbox count too, while we're at it.
          if (n.unread !== unread) {
            unread = n.unread;
            store.set('unread', unread);
            store.set('unreadAt', Date.now());
            queueRail();
          }
          return n;
        })
        .catch(() => mine)
        .finally(() => (newsJob = null));
    return newsJob;
  }
  async function loadNews() {
    const now = Date.now();
    const week = now - 7 * DAY;
    const [count, convos, stream, work] = await Promise.all([
      api('/conversations/unread_count').then((r) => Number(r.unread_count) || 0, () => unread),
      api('/conversations?scope=unread&per_page=10').catch(() => []),
      // No .catch: if this fails (offline) the whole refresh fails and the last good copy stays,
      // rather than an empty list being cached and its grades counted as seen.
      api('/users/self/activity_stream?only_active_courses=true&per_page=50'),
      planner(-7, 4).catch(() => []),
    ]);
    const course = (id) => (COURSES || []).find((c) => c.id === Number(id));
    const cname = (id, fallback = '') => (course(id) ? prettyName(course(id)) : fallback);
    const msgs = (convos || []).slice(0, 10).map((c) => ({
      id: c.id,
      title: c.subject || 'No subject',
      text: String(c.last_message || '').slice(0, 140),
      // With two people it's the other one; in a group the sender isn't known, so no name.
      from: (c.participants || []).length === 2 ? ((c.participants || []).find((x) => String(x.id) !== String(PAGE_USER)) || {}).name || '' : '',
      at: Date.parse(c.last_message_at) || 0,
      course: c.context_name || '',
    }));
    const anns = (stream || [])
      .filter((x) => x.type === 'Announcement' && x.read_state === false && Date.parse(x.created_at) > week)
      .slice(0, 10)
      .map((x) => ({
        id: x.id,
        topicId: x.announcement_id || x.discussion_topic_id || Number((String(x.html_url || '').match(/\/(?:discussion_topics|announcements)\/(\d+)/) || [])[1]) || null,
        title: x.title || 'Announcement',
        courseId: x.course_id || null,
        course: cname(x.course_id),
        at: Date.parse(x.created_at) || 0,
        url: x.html_url || '/',
      }));
    const grades = [];
    for (const x of stream || []) {
      if (x.type !== 'Submission') continue;
      const a = x.assignment || {};
      const at = Date.parse(x.posted_at || x.graded_at || x.updated_at) || 0;
      // The newest comment from someone else (his teacher or a TA).
      const cm = (x.submission_comments || [])
        .filter((c) => String(c.author_id) !== String(PAGE_USER) && Date.parse(c.created_at) > week)
        .sort((u, v) => Date.parse(v.created_at) - Date.parse(u.created_at))[0];
      const graded = x.workflow_state === 'graded' && (x.score != null || x.grade) && at > week;
      if (!graded && !cm) continue;
      grades.push({
        id: x.assignment_id || a.id || x.id,
        title: a.name || x.title || 'Assignment',
        graded: !!graded,
        score: x.score != null ? Number(x.score) : null,
        grade: x.grade != null ? String(x.grade) : '',
        pts: a.points_possible != null ? Number(a.points_possible) : null,
        courseId: x.course_id || a.course_id || null,
        course: cname(x.course_id || a.course_id),
        at: Math.max(graded ? at : 0, cm ? Date.parse(cm.created_at) : 0),
        url: x.html_url || a.html_url || '/',
        comment: cm ? { who: cm.author_name || 'Your teacher', text: String(cm.comment || '').slice(0, 140), at: Date.parse(cm.created_at) || 0 } : null,
      });
    }
    grades.sort((u, v) => v.at - u.at);
    const slim = (i) => ({ key: i.key, type: i.type, title: i.title, due: i.due ? +i.due : 0, url: i.url, courseId: i.courseId, course: cname(i.courseId, i.courseName) });
    const due = work.filter((i) => !i.done && i.due && +i.due > now && +i.due < now + 4 * DAY).sort((u, v) => u.due - v.due).slice(0, 20).map(slim);
    const missing = work.filter((i) => i.flagged).slice(0, 10).map(slim);
    return { v: NEWS_V, user: PAGE_USER, at: now, unread: count, msgs, anns, grades: grades.slice(0, 12), due, missing };
  }

  // The bell on the dashboard, next to the AI button: unread messages and announcements, new grades
  // and comments (new = since he last opened it), and what's due next.
  const ago = (t) => {
    const m = Math.round((Date.now() - t) / 6e4);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    if (m < 24 * 60) return `${Math.round(m / 60)}h ago`;
    return `${Math.round(m / 1440)}d ago`;
  };
  const fmtPts = (x) => String(Math.round(x * 100) / 100);
  const gradeText = (g) => (!g.graded ? '' : g.score != null && g.pts ? `${fmtPts(g.score)}/${fmtPts(g.pts)}` : g.grade);
  // Grades and comments he cleared from the bell (by assignment and time, so a new one comes back).
  const gradeKey = (g) => `${g.id}:${g.at}`;
  const bellCleared = () => store.get('bellCleared', {}) || {};
  function bellCount(d) {
    if (!d) return 0;
    const seen = store.get('bellSeen', 0);
    const gone = bellCleared();
    return d.unread + d.anns.length + d.grades.filter((g) => g.at > seen && !gone[gradeKey(g)]).length;
  }
  function annReadPath(a) {
    const m = String(a.url || '').match(/\/(courses|groups)\/(\d+)\/(?:discussion_topics|announcements)\/(\d+)/);
    if (m) return `/${m[1]}/${m[2]}/discussion_topics/${m[3]}/read`;
    return a.courseId && a.topicId ? `/courses/${a.courseId}/discussion_topics/${a.topicId}/read` : '';
  }
  // Marking things read in Canvas (only when he clicks the check). Canvas checks X-CSRF-Token
  // against the _csrf_token cookie on anything that changes data.
  async function canvasPut(path, body = '') {
    const c = document.cookie.match(/(?:^|;\s*)_csrf_token=([^;]*)/);
    const r = await fetch(location.origin + '/api/v1' + path, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-CSRF-Token': c ? decodeURIComponent(c[1]) : '',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body,
    });
    if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? 'Canvas said no (are you still signed in?)' : `Canvas error ${r.status}`);
  }
  function mountBell(wel) {
    const btn = el(
      `<button type="button" class="gcx-bell" aria-haspopup="dialog" aria-expanded="false" title="Notifications" aria-label="Notifications">${svg('bell', 24)}<span class="gcx-bell-n" hidden></span></button>`,
    );
    wel.append(btn);
    let data = store.get('news', null);
    if (data && (data.user !== PAGE_USER || data.v !== NEWS_V)) data = null;
    const marked = { msg: new Map(), ann: new Map() }; // id -> when he marked it read
    const scrub = (d) => {
      if (!d) return d;
      const old = (kind, id) => marked[kind].has(String(id)) && d.at < marked[kind].get(String(id));
      const msgs = d.msgs.filter((m) => !old('msg', m.id));
      const anns = d.anns.filter((a) => !old('ann', a.id));
      if (msgs.length === d.msgs.length && anns.length === d.anns.length) return d;
      return { ...d, msgs, anns, unread: Math.max(0, d.unread - (d.msgs.length - msgs.length)) };
    };
    const paint = () => {
      const n = bellCount(data);
      const b = btn.querySelector('.gcx-bell-n');
      b.hidden = !n;
      b.textContent = n > 99 ? '99+' : String(n);
      btn.setAttribute('aria-label', n ? `Notifications, ${n} new` : 'Notifications');
    };
    paint();
    news().then((d) => {
      if (d) (data = scrub(d)), paint();
    });
    // What he has now seen stops counting as new (it stays marked in the list until next time):
    // everything up to when the list he's looking at was fetched.
    const seenUpTo = (d) => {
      if (!d || d.at <= store.get('bellSeen', 0)) return;
      store.set('bellSeen', d.at);
      paint();
    };
    // One row checked off: it folds away and the count drops; if Canvas says no, it comes back.
    async function check(done) {
      const item = done.closest('.gcx-bell-item');
      const { kind, id } = done.dataset;
      if (!item || !data || item.classList.contains('gcx-going')) return;
      item.classList.add('gcx-going');
      try {
        if (kind === 'msg') {
          await canvasPut(`/conversations/${encodeURIComponent(id)}`, 'conversation%5Bworkflow_state%5D=read');
          marked.msg.set(id, Date.now());
        } else if (kind === 'ann') {
          const a = data.anns.find((x) => String(x.id) === id);
          const path = a && annReadPath(a);
          if (!path) throw new Error("couldn't tell which announcement");
          await canvasPut(path);
          marked.ann.set(id, Date.now());
        } else {
          const gone = bellCleared();
          const cut = Date.now() - 30 * DAY;
          for (const k of Object.keys(gone)) if (gone[k] < cut) delete gone[k];
          gone[id] = Date.now();
          store.set('bellCleared', gone);
        }
      } catch (err) {
        item.classList.remove('gcx-going');
        toast(`Couldn't mark it read: ${err.message}`);
        return;
      }
      // Off the current list (whichever it is by now) and the saved copy.
      if (kind !== 'grade' && data) {
        data = scrub(data);
        store.set('news', data);
        if (data.unread !== unread) {
          unread = data.unread;
          store.set('unread', unread);
          store.set('unreadAt', Date.now());
          queueRail();
        }
      }
      paint();
      // Fold it away: from its height to nothing (the height is applied before the fold starts).
      item.style.height = item.offsetHeight + 'px';
      void item.offsetHeight;
      item.classList.add('gcx-gone');
      setTimeout(() => {
        const list = item.parentElement;
        const sec = item.previousElementSibling && item.previousElementSibling.classList.contains('gcx-bell-sec') ? item.previousElementSibling : null;
        item.remove();
        // The section's last row (the "more in Inbox" link counts): its heading goes too.
        const next = sec && sec.nextElementSibling;
        if (sec && !(next && (next.classList.contains('gcx-bell-item') || next.classList.contains('gcx-bell-more')))) sec.remove();
        if (list && !list.querySelector('.gcx-bell-item, .gcx-bell-more')) list.innerHTML = `<div class="gcx-bell-empty">You're all caught up.</div>`;
      }, 220);
    }
    btn.addEventListener('click', () => {
      if (closeBell) return closeBell();
      const shown = data;
      const pop = openBell(btn, shown);
      pop.addEventListener('click', (e) => {
        const done = e.target.closest('.gcx-bell-done');
        if (!done) return;
        e.preventDefault();
        e.stopPropagation();
        check(done);
      });
      // Older than a minute: fetch again and redraw it.
      if (!shown || Date.now() - shown.at > 6e4)
        news(true).then((d) => {
          const list = pop.isConnected && pop.querySelector('.gcx-bell-list');
          if (!d) {
            if (list && !shown) list.innerHTML = `<div class="gcx-bell-empty">Couldn't load your notifications.</div>`;
            else if (list) seenUpTo(shown);
            return;
          }
          data = scrub(d);
          paint();
          if (!list) return;
          list.innerHTML = bellList(data, store.get('bellSeen', 0));
          seenUpTo(data);
        });
      else setTimeout(() => seenUpTo(shown), 600);
    });
  }
  function bellList(d, seen) {
    if (!d) return `<div class="gcx-bell-empty">Loading…</div>`;
    const color = (id) => {
      const c = id && (COURSES || []).find((x) => x.id === Number(id));
      return c ? c.color : '';
    };
    // act: [kind, id, label] for the check that shows on hover (none for Due soon).
    const row = (icon, title, sub, url, isNew, c, act) =>
      `<div class="gcx-bell-item"><a class="gcx-bell-row${isNew ? ' new' : ''}" href="${esc(url)}"${c ? ` style="--c:${esc(c)}"` : ''}><span class="gcx-bell-ic">${svg(icon, 18)}</span><span class="gcx-bell-tx"><b>${esc(title)}</b><small>${esc(sub)}</small></span></a>${
        act
          ? `<button type="button" class="gcx-bell-done" data-kind="${act[0]}" data-id="${esc(act[1])}" title="${act[2]}" aria-label="${act[2]}: ${esc(title)}">${svg('check', 18)}</button>`
          : ''
      }</div>`;
    const gone = bellCleared();
    const sec = (label, rows) => (rows.length ? `<div class="gcx-bell-sec">${esc(label)}</div>${rows.join('')}` : '');
    const more = d.unread > d.msgs.length ? [`<a class="gcx-bell-more" href="/conversations">${d.unread - d.msgs.length} more in Inbox</a>`] : [];
    const html0 =
      sec('Messages', [
        ...d.msgs.map((m) => row('chat', m.title, [m.from, m.text].filter(Boolean).join(': ') || ago(m.at), '/conversations', true, '', ['msg', m.id, 'Mark as read'])),
        ...more,
      ]) +
      sec(
        'Announcements',
        d.anns.map((a) => row('announce', a.title, [a.course, ago(a.at)].filter(Boolean).join(' · '), a.url, true, color(a.courseId), annReadPath(a) ? ['ann', a.id, 'Mark as read'] : null)),
      ) +
      sec(
        'Grades and feedback',
        d.grades
          .filter((g) => !gone[gradeKey(g)])
          .slice(0, 8)
          .map((g) =>
            row(
              g.comment && (!g.graded || g.comment.at >= g.at) ? 'chat' : 'grade',
              g.title,
              g.comment && (!g.graded || g.comment.at >= g.at)
                ? `${g.comment.who}: ${g.comment.text}`
                : [g.course, gradeText(g) ? `Graded ${gradeText(g)}` : 'Graded', ago(g.at)].filter(Boolean).join(' · '),
              g.url,
              g.at > seen,
              color(g.courseId),
              ['grade', gradeKey(g), 'Clear'],
            ),
          ),
      ) +
      sec(
        'Due soon',
        d.due
          .filter((i) => i.due - Date.now() < 2 * DAY)
          .slice(0, 4)
          .map((i) => row(TYPE_ICON[i.type] || 'assignment', i.title, [i.course, dueText(new Date(i.due))].filter(Boolean).join(' · '), i.url, false, color(i.courseId))),
      );
    return html0 || `<div class="gcx-bell-empty">You're all caught up.</div>`;
  }
  let closeBell = null;
  function openBell(btn, d) {
    const pop = el(`<div class="gcx-bell-panel gcx-pop-panel" role="dialog" aria-label="Notifications">
      <div class="gcx-bell-h">Notifications</div>
      <div class="gcx-bell-list">${bellList(d, store.get('bellSeen', 0))}</div>
      <div class="gcx-bell-foot"><a href="/conversations">Inbox</a><a href="/?gcx=todo">To-do</a></div>
    </div>`);
    document.body.append(pop);
    const r = btn.getBoundingClientRect();
    pop.style.left = Math.max(12, Math.min(r.right - pop.offsetWidth, innerWidth - pop.offsetWidth - 12)) + 'px';
    pop.style.top = r.bottom + 8 + 'px';
    pop.style.transformOrigin = 'top right';
    btn.setAttribute('aria-expanded', 'true');
    const close = () => {
      closeBell = null;
      pop.classList.add('gcx-out');
      btn.setAttribute('aria-expanded', 'false');
      setTimeout(() => pop.remove(), 160);
      document.removeEventListener('mousedown', outside, true);
      document.removeEventListener('keydown', onKey, true);
    };
    closeBell = close;
    const outside = (e) => !pop.contains(e.target) && !btn.contains(e.target) && close();
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      close();
      btn.focus();
    };
    document.addEventListener('mousedown', outside, true);
    document.addEventListener('keydown', onKey, true);
    return pop;
  }

  // ---------------------------------------------------------------- shared with fileview.js and ai.js
  window.gcx = { api, esc, el, svg, fileTile, swr, store, user: PAGE_USER, confetti, coursesReady, prettyName, toast, COURSE_ID, VIEW, getMe: () => me, prefs, fixInlineColors, news };

  // ---------------------------------------------------------------- loading bar
  // A thin bar across the top of the page (not the rail): dark grey track, filled with the
  // course color. It runs from a click until the next page has drawn its content, and while a
  // view with nothing cached is still fetching.
  const bar = el('<div class="gcx-progress" aria-hidden="true"><div class="gcx-progress-fill"></div></div>');
  document.body.append(bar);
  let barTimer = 0;
  let barLevel = 0;
  function barColor() {
    const cbar = document.getElementById('gcx-cbar');
    return (cbar && cbar.style.getPropertyValue('--c')) || getComputedStyle(html).getPropertyValue('--gcx-link');
  }
  function barStart(color) {
    clearInterval(barTimer);
    bar.style.setProperty('--c', color || barColor());
    bar.classList.remove('done');
    bar.classList.add('on');
    barLevel = Math.max(barLevel, 0.08);
    bar.style.setProperty('--p', barLevel);
    // Ease toward 90% and wait there; the real finish comes from barDone().
    barTimer = setInterval(() => {
      barLevel += (0.9 - barLevel) * 0.08;
      bar.style.setProperty('--p', barLevel.toFixed(3));
    }, 120);
  }
  function barDone() {
    if (!bar.classList.contains('on')) return;
    clearInterval(barTimer);
    bar.style.setProperty('--p', 1);
    bar.classList.add('done');
    setTimeout(() => {
      bar.classList.remove('on', 'done');
      barLevel = 0;
      bar.style.setProperty('--p', 0);
    }, 450);
  }
  // Coming back with the Back button shows the old page from cache; don't leave a bar running.
  addEventListener('pageshow', (e) => e.persisted && barDone());

  // ---------------------------------------------------------------- motion
  // Which way the next page should slide in. Course tabs are ordered Home, Classwork, People.
  const tabIndexOf = (url) => {
    const m = url.pathname.match(/^\/courses\/(\d+)(\/.*)?$/);
    if (!m) return null;
    const rest = m[2] || '/';
    if (/^\/?$/.test(rest) && url.searchParams.get('gcx') === 'classwork') return { course: +m[1], i: 1 };
    if (/^\/?$/.test(rest) || /^\/announcements/.test(rest)) return { course: +m[1], i: 0 };
    if (/^\/(users|groups)/.test(rest)) return { course: +m[1], i: 2 };
    if (/^\/(modules|assignments|quizzes|files|grades|pages|wiki|discussion_topics)/.test(rest)) return { course: +m[1], i: 1 };
    return { course: +m[1], i: -1 };
  };
  // A course's own tab pages (Home, Classwork, People), as opposed to something opened from them.
  const isTabPage = (url) => /^\/courses\/\d+(\/(modules|users))?\/?$/.test(url.pathname);
  // What he clicked carries over into the next page: a class card grows into the class banner, a
  // row (an assignment in Classwork, Upcoming or a card's due list) into the assignment's header.
  let heroEls = [];
  const clearHero = () => {
    heroEls.forEach((n) => (n.style.viewTransitionName = ''));
    heroEls = [];
  };
  const markHero = (box) => {
    clearHero();
    box.style.viewTransitionName = 'gcx-hero';
    heroEls.push(box);
    // Left in place only for the navigation; if it never happens (or he comes back to this page
    // from the back/forward cache), the names come off again.
    setTimeout(clearHero, 15000);
  };
  addEventListener('pagereveal', clearHero);
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || (a.target && a.target !== '_self')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
    const to = tabIndexOf(url);
    const from = tabIndexOf(new URL(location.href));
    let dir = 'fade';
    if (to && (!from || from.course !== to.course)) dir = 'in';
    else if (to && !isTabPage(url)) dir = 'open';
    else if (to && from && to.i >= 0 && from.i >= 0 && to.i !== from.i) dir = to.i > from.i ? 'left' : 'right';
    else if (from && !to) dir = 'out';
    let hero = '';
    let heroTitle = '';
    if (!a.closest('#gcx-rail, #gcx-cbar')) {
      const row = a.closest('.gcx-row, .gcx-due-item, article');
      const card = !row && a.closest('.ic-DashboardCard');
      if (row && to && !isTabPage(url)) {
        hero = 'row';
        heroTitle = ((row.querySelector('.gcx-row-title, [class*="-title"]') || row).textContent || '').trim().slice(0, 200);
        markHero(row);
        // The row grows into the page's header; nothing else should move with it.
        dir = 'open';
      } else if (card) {
        // The whole card grows into the class page.
        hero = 'card';
        markHero(card);
      }
    }
    try {
      sessionStorage.setItem('gcx:nav', JSON.stringify({ dir, hero, title: heroTitle, t: Date.now(), from: from ? from.i : -1, course: from ? from.course : null }));
    } catch {}
    // Opening a course from outside it: use that course's color for the bar.
    const target = to && (COURSES || []).find((c) => c.id === to.course);
    barStart(to && to.course !== COURSE_ID && target ? target.color : undefined);
    setTimeout(barDone, 8000);
  });
  // The attribute only matters while the page transition runs.
  setTimeout(() => delete html.dataset.gcxNav, 2000);

  // Going back (the Back button or Esc): the page swipes away to show the one under it.
  addEventListener('pageswap', (e) => {
    const act = e.activation;
    let dir = '';
    if (act && act.navigationType === 'traverse' && window.navigation && navigation.currentEntry) {
      dir = act.entry.index < navigation.currentEntry.index ? 'back' : 'fade';
      try {
        sessionStorage.setItem('gcx:nav', JSON.stringify({ dir, t: Date.now() }));
      } catch {}
    } else {
      try {
        dir = (JSON.parse(sessionStorage.getItem('gcx:nav') || 'null') || {}).dir || '';
      } catch {}
    }
    // The old page's content is named here (its names are read from this page) so a tab switch or
    // going back moves it as one piece; see classroom.css.
    if (e.viewTransition && dir) html.dataset.gcxLeaving = dir;
  });
  addEventListener('pagereveal', () => delete html.dataset.gcxLeaving);
  // Esc goes back a page, unless it's closing something first (the file viewer, Ask, a picker,
  // a menu). Whether anything was open is read before those handlers close it.
  const escOpen = () =>
    [
      ...document.querySelectorAll(
        '.gcx-pop-panel, .gcx-fv-scrim, .gcx-ask:not([data-state="idle"]), dialog[open], [aria-modal="true"], [role="dialog"], [role="menu"], [role="listbox"], [popover]:popover-open, .ui-dialog, .ui-widget-overlay',
      ),
    ].some((n) => (n.checkVisibility ? n.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : n.getClientRects().length > 0));
  let escBusy = false;
  addEventListener('keydown', (e) => e.key === 'Escape' && (escBusy = escOpen()), true);
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || escBusy || e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    const t = document.activeElement;
    // Typing, inside a frame, or in another extension's panel (a custom element's shadow root).
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|IFRAME|EMBED|OBJECT)$/.test(t.tagName) || t.tagName.includes('-'))) return;
    // From a class's own Home, Classwork or People page, Esc goes up to the dashboard.
    if (isTabPage(location)) {
      e.preventDefault();
      try {
        sessionStorage.setItem('gcx:nav', JSON.stringify({ dir: 'back', t: Date.now() }));
      } catch {}
      barStart();
      location.href = '/';
      return;
    }
    if (!window.navigation || !navigation.canGoBack) return;
    const prev = navigation.entries()[navigation.currentEntry.index - 1];
    if (!prev || !prev.url || new URL(prev.url).origin !== location.origin) return;
    e.preventDefault();
    navigation.back();
  });

  // Dark/light switches: BetterCampus swaps its theme <style> text. Put the old text back for
  // one frame and let a view transition crossfade to the new one.
  const THEME_STYLE = /^(darkcss|bettercanvas-|bettercampus-)/;
  const themeSnap = new Map();
  const probe = (v) => {
    const n = document.createElement('i');
    n.style.cssText = `position:absolute;visibility:hidden;background:${v}`;
    document.body.append(n);
    const c = getComputedStyle(n).backgroundColor;
    n.remove();
    return c;
  };
  const checkFlatSurface = () => {
    const a = rgbOf(probe('var(--bcbackground-1, #f1f3f4)'));
    const b = rgbOf(probe('var(--bccards, #fff)'));
    const near = a.length === 3 && b.length === 3 && a.every((v, i) => Math.abs(v - b[i]) < 10);
    html.classList.toggle('gcx-flat2', near);
    // A picture behind the page: lists that sit straight on the page background get card surfaces.
    const img = getComputedStyle(html).getPropertyValue('--bcbackground-image').trim();
    html.classList.toggle('gcx-imgbg', !!img && img !== 'none');
  };
  // BetterCampus paints each page's first 1.5 s from a saved copy of the theme's background, and
  // only re-saves it 1.5 s after a page loads. Right after a dark/light switch, the next page
  // would open in the old mode's background, so save the new one as soon as the switch lands.
  const syncFirstPaint = () => {
    try {
      const KEY = '_bettercampus_theme_cache';
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!saved || typeof saved !== 'object') return;
      const c = probe('var(--bcbackground-0, #fff)');
      if (/(,|\/)\s*0(\.\d+)?\)$/.test(c)) return; // see-through: an image or gradient background
      const [r, g, b] = rgbOf(c);
      if (b === undefined) return;
      const dark = lum([r, g, b]) < 0.2;
      const bg = '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
      if (saved.dark_mode === dark && (!saved.theme_enabled || saved.bg === bg)) return;
      localStorage.setItem(KEY, JSON.stringify({ ...saved, dark_mode: dark, ...(saved.theme_enabled ? { bg } : {}) }));
    } catch {}
  };
  // The theme's colors, saved for early.js to paint the next page's very first frame with (so it
  // isn't Canvas white until BetterCampus catches up, and page transitions don't fade from white).
  const THEME_VARS = ['--bcbackground-0', '--bcbackground-1', '--bcbackground-2', '--bccards', '--bctext-0', '--bctext-1', '--bctext-2', '--bcborders', '--bclinks', '--bcbackground-image'];
  const saveThemeVars = () => {
    if (!document.getElementById('bettercanvas-theme-preset')) return; // BetterCampus hasn't drawn its theme yet
    // BetterCampus's own theme is up now; the stand-in from early.js has done its job (and must be
    // gone before reading, or its old values would be read back and saved again).
    document.getElementById('gcx-theme-early')?.remove();
    const cs = getComputedStyle(html);
    const v = {};
    for (const k of THEME_VARS) {
      const x = cs.getPropertyValue(k).trim();
      if (x && !/[{}<;]/.test(x)) v[k] = x;
    }
    try {
      if (v['--bcbackground-0']) localStorage.setItem('gcx:themevars', JSON.stringify(v));
      else localStorage.removeItem('gcx:themevars');
    } catch {}
    checkFlatSurface();
  };
  // BetterCampus off (or gone): stop painting pages with its last theme.
  // Quiz and assignment pages are an exception: BetterCampus's quiz safe mode skips its theme there.
  addEventListener('load', () =>
    setTimeout(() => {
      if (document.getElementById('bettercanvas-theme-preset')) return;
      // Safe mode (or dark mode without the preset): the saved colors are the only theme this page
      // gets, so keep them rather than flipping it to Canvas's light look.
      if (document.getElementById('darkcss') || /\/courses\/\d+\/(quizzes|assignments)\/\d+/.test(location.pathname)) return;
      document.getElementById('gcx-theme-early')?.remove();
      checkFlatSurface();
      try {
        localStorage.removeItem('gcx:themevars');
      } catch {}
    }, 5000),
  );
  const snapTheme = () => {
    checkFlatSurface();
    saveThemeVars();
    themeSnap.clear();
    for (const n of document.querySelectorAll('head style[id]')) if (THEME_STYLE.test(n.id)) themeSnap.set(n, n.textContent);
  };
  let themeBusy = false;
  const touchesTheme = (records) =>
    records.some((r) => {
      const t = r.type === 'characterData' ? r.target.parentNode : r.target;
      if (t && t.nodeName === 'STYLE' && THEME_STYLE.test(t.id || '')) return true;
      return [...r.addedNodes, ...r.removedNodes].some((n) => n.nodeName === 'STYLE' && THEME_STYLE.test(n.id || ''));
    });
  const themeObserver = new MutationObserver((records) => {
    if (themeBusy || !touchesTheme(records)) return;
    const changed = [...document.querySelectorAll('head style[id]')].filter((n) => THEME_STYLE.test(n.id) && themeSnap.get(n) !== n.textContent);
    const isTheme = changed.some((n) => n.id === 'darkcss' || n.id === 'bettercanvas-theme-preset');
    // BetterCampus drawing its theme for the first time on a new page isn't a switch: no crossfade
    // (it used to fade the whole page in from white on every load).
    const first = ![...themeSnap.keys()].some((n) => n.id === 'bettercanvas-theme-preset' && n.isConnected);
    if (first || !changed.length || !isTheme || !document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      snapTheme();
      if (isTheme) {
        refreshInlineColors();
        syncFirstPaint();
        applySchoolPref();
        applyArt();
      }
      return;
    }
    themeBusy = true;
    const next = changed.map((n) => [n, n.textContent]);
    for (const [n] of next) {
      if (themeSnap.has(n)) n.textContent = themeSnap.get(n);
      else n.media = 'not all';
    }
    html.classList.add('gcx-theme-vt');
    const done = () => {
      html.classList.remove('gcx-theme-vt');
      snapTheme();
      themeBusy = false;
      refreshInlineColors();
      syncFirstPaint();
      applySchoolPref();
      applyArt();
    };
    try {
      document
        .startViewTransition(() => {
          for (const [n, text] of next) {
            n.textContent = text;
            n.media = '';
          }
          checkFlatSurface();
        })
        .finished.finally(done);
    } catch {
      for (const [n, text] of next) n.textContent = text;
      done();
    }
  });
  snapTheme();
  themeObserver.observe(document.head, { childList: true, subtree: true, characterData: true });

  // Little press ripple on rows, chips and buttons we own.
  document.addEventListener('pointerdown', (e) => {
    // Whole class cards ripple too (a setting); a click on something inside that has its own
    // ripple (a due item, the mail button) uses that one instead.
    const own = e.target.closest && e.target.closest('.gcx-due-item, .gcx-iconbtn, .gcx-more-link');
    const card = !own && prefs().cardRipple && e.target.closest && e.target.closest('#DashboardCard_Container .ic-DashboardCard');
    const t = card || (e.target.closest && e.target.closest('.gcx-row, .gcx-chip, .gcx-ri, .gcx-tab, .gcx-due-item, .gcx-more-btn, .gcx-seg button, .gcx-link a, .gcx-iconbtn, .gcx-links-add'));
    if (!t || e.button) return;
    const r = t.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2;
    const dot = document.createElement('span');
    dot.className = 'gcx-ripple';
    dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    t.append(dot);
    setTimeout(() => dot.remove(), 600);
  });

  // ---------------------------------------------------------------- boot
  if (!VIEW) {
    if (document.readyState === 'complete') barDone();
    else addEventListener('load', barDone, { once: true });
  }
  applyFontPref();
  applyShadePref();
  applyLayoutPref();
  applySchoolPref();
  applyLook();
  html.classList.toggle('gcx-still', !prefs().motion);
  // Elements ease in one by one after a page change; stop once the page has settled so later
  // refreshes and redraws don't replay it.
  setTimeout(() => html.classList.remove('gcx-enter'), 1600);
  paintHidden();
  if (html.classList.contains('gcx-dash')) {
    mountWelcome();
    mountGhosts();
  }
  hookBcSettings();
  watchSubmissions();
  (window.requestIdleCallback || setTimeout)(() => cache.sweep(), { timeout: 5000 });
  prefetchCoursePages();
  setTimeout(() => (window.requestIdleCallback || setTimeout)(warmCourses, { timeout: 5000 }), 3000);
  if (COURSE_ID) {
    const cPromise = renderCourseBar();
    if (VIEW === 'home' || VIEW === 'classwork') {
      const view = mountView();
      if (view) (VIEW === 'home' ? renderHome : renderClasswork)(view, cPromise);
    } else if (VIEW === 'people') {
      // Drawn by people.js, which runs next.
      const view = mountView();
      if (view) window.gcx.people = { view, course: cPromise };
      // If people.js never draws (not loaded, or it failed), show Canvas's own page.
      setTimeout(() => {
        if (view && view.isConnected && !view.childElementCount) {
          view.remove();
          html.classList.remove('gcx-takeover');
        }
      }, 4000);
    }
    if (VIEW !== 'classwork') prefetchClasswork(COURSE_ID);
  } else if (VIEW === 'todo') {
    const view = mountView();
    if (view) renderTodo(view);
  }

  if (html.classList.contains('gcx-dash')) {
    swr(
      'dash:planner',
      () => planner(-HORIZON_DAYS, HORIZON_DAYS),
      (items, fromCache) => {
        dashItems = items;
        refreshCards();
        updateWelcome(items, fromCache);
        if (!fromCache) saveSnapshot();
      },
      reviveItems,
    ).catch((e) => {
      console.warn('[canvas-classroom] planner', e);
      dashItems = [];
      releaseGhosts();
      document.querySelectorAll('.gcx-card-due-wrap').forEach((w) => (w.innerHTML = `<div class="gcx-due-none">Couldn't load assignments.</div>`));
      updateWelcome([], false, true);
    });
    const run = debounce(enhanceCards, 80);
    run();
    new MutationObserver(run).observe(document.getElementById('content') || document.body, { childList: true, subtree: true });
  }

  // BetterCampus's to-do list fetches fresh on every page, so it used to pop in a second late.
  // Last visit's copy (its rows and its stylesheet, in a shadow root of our own) stands in where
  // the list goes, and fades out once the live list has drawn underneath.
  let bcGhost = null;
  let bcSavedHtml = '';
  let bcSaveTimer = 0;
  function bcLive(sr) {
    const list = sr && sr.getElementById('bettercanvas-todo-list');
    return !!(list && (list.querySelector('.group') || /all (done|caught up)|no (upcoming|assignments|items)|nothing (due|to do)/i.test(list.textContent)));
  }
  function saveBcTodo(sr) {
    clearTimeout(bcSaveTimer);
    bcSaveTimer = setTimeout(() => {
      const list = sr.getElementById('bettercanvas-todo-list');
      if (!list) return;
      if (!list.querySelector('.group')) {
        // Nothing left to do: don't bring back the old list next time.
        if (bcLive(sr) && bcSavedHtml) {
          bcSavedHtml = '';
          cache.set('bctodo', null);
        }
        return;
      }
      const copy = list.cloneNode(true);
      copy.querySelectorAll('[data-gcx-new]').forEach((n) => n.removeAttribute('data-gcx-new'));
      const markup = copy.outerHTML;
      if (markup.length > 400000 || markup === bcSavedHtml) return;
      bcSavedHtml = markup;
      const sheets = [...(sr.adoptedStyleSheets || [])].map((s) => {
        try {
          return [...s.cssRules].map((r) => r.cssText).join('\n');
        } catch {
          return '';
        }
      });
      const css = [...sr.querySelectorAll('style')].map((s) => s.textContent).concat(sheets).join('\n');
      cache.set('bctodo', { html: markup, css });
    }, 1500);
  }
  function releaseBcGhost() {
    const g = bcGhost;
    if (!g) return;
    bcGhost = null;
    // Lift the copy out of the flow where it sits, so the live list takes its place underneath
    // while the copy fades.
    const { offsetTop: top, offsetLeft: left, offsetWidth: width } = g;
    g.style.cssText = `position:absolute;top:${top}px;left:${left}px;width:${width}px`;
    html.classList.remove('gcx-bc-wait');
    g.classList.add('gcx-out');
    setTimeout(() => g.remove(), 260);
  }
  async function mountBcGhost() {
    const saved = await cache.get('bctodo');
    if (!saved || !saved.html) return;
    bcSavedHtml = saved.html;
    const tryMount = () => {
      const host = document.querySelector('bettercampus-todo-list');
      if (!host) return false;
      if (bcLive(host.shadowRoot) || document.querySelector('.gcx-bc-ghost')) return true;
      const ghost = document.createElement('div');
      ghost.className = 'gcx-bc-ghost';
      ghost.inert = true;
      ghost.setAttribute('aria-hidden', 'true');
      const gsr = ghost.attachShadow({ mode: 'open' });
      const st = document.createElement('style');
      st.textContent = saved.css || '';
      gsr.append(st);
      gsr.append(document.createRange().createContextualFragment(saved.html));
      gsr.querySelectorAll('script').forEach((n) => n.remove());
      host.before(ghost);
      html.classList.add('gcx-bc-wait');
      bcGhost = ghost;
      setTimeout(releaseBcGhost, 8000); // never hide the real list for long
      return true;
    };
    if (tryMount()) return;
    const mo = new MutationObserver(() => tryMount() && mo.disconnect());
    mo.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => mo.disconnect(), 5000);
  }
  mountBcGhost();

  // The BetterCampus sidebar can show up on any page; watch for it until it does.
  if (!tweakBcTodo()) {
    const mo = new MutationObserver(
      debounce(() => {
        if (tweakBcTodo()) mo.disconnect();
      }, 150),
    );
    mo.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => mo.disconnect(), 30000);
  }
})();
