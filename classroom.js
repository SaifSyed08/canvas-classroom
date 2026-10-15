// Canvas Classroom: Google Classroom-style layout on top of Canvas + BetterCampus.
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
    html.classList.remove('gcx', 'gcx-pinned', 'gcx-course', 'gcx-dash', 'gcx-takeover');
    return;
  }

  const VIEW = html.dataset.gcxView || '';
  const COURSE_ID = html.dataset.gcxCourse ? Number(html.dataset.gcxCourse) : null;
  const DAY = 864e5;
  const HORIZON_DAYS = 14;

  // ---------------------------------------------------------------- helpers
  const ICONS = {
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
    grade: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z',
    announce: 'M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61zM20.4 5.6c-.4-.53-.8-1.07-1.2-1.6-.99.74-2.24 1.68-3.2 2.4.4.53.8 1.07 1.2 1.6.96-.72 2.21-1.65 3.2-2.4zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1v4h2v-4h1l5 3V6L8 9H4zm11.5 3c0-1.33-.58-2.53-1.5-3.35v6.69c.92-.81 1.5-2.01 1.5-3.34z',
    people: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
    lock: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
    chevron: 'M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z',
    list: 'M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z',
    check: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
    sync: 'M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z',
    more: 'M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
    add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
    close: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
    folder: 'M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z',
    open: 'M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z',
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

  // Canvas REST call with the page's own session. all=true follows Link: rel="next".
  async function api(path, all = false) {
    let url = path.startsWith('http') ? path : location.origin + '/api/v1' + path;
    const out = [];
    for (let page = 0; url && page < 30; page++) {
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
  const cacheKey = (k) => `c:${location.origin}|${(store.get('me', null) || {}).id || 'anon'}|${k}`;
  const cache = {
    async get(k) {
      try {
        const r = await chrome.storage.local.get(cacheKey(k));
        const v = r[cacheKey(k)];
        return v && v.v === CACHE_VERSION && Date.now() - v.t < CACHE_DAYS * 864e5 ? v.d : null;
      } catch {
        return store.get('c:' + k, null);
      }
    },
    set(k, d) {
      try {
        chrome.storage.local.set({ [cacheKey(k)]: { v: CACHE_VERSION, t: Date.now(), d } }).catch(() => {});
      } catch {
        store.set('c:' + k, d);
      }
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
  // Stale-while-revalidate: draw the cached copy at once, fetch, redraw only if it changed.
  // onData(data, fromCache). Throws only when there was no cached copy to fall back on.
  async function swr(key, fetcher, onData, revive = (x) => x) {
    const cached = await cache.get(key);
    let shown = null;
    if (cached != null) {
      shown = JSON.stringify(cached);
      onData(revive(cached), true);
    }
    let fresh;
    try {
      fresh = JSON.parse(JSON.stringify(await fetcher()));
    } catch (e) {
      if (shown == null) throw e;
      console.warn('[canvas-classroom] refresh failed, showing saved copy', key, e);
      return null;
    }
    cache.set(key, fresh);
    if (JSON.stringify(fresh) !== shown) onData(revive(fresh), false);
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
  const dueText = (d) => {
    const n = dayDiff(d);
    return `Due ${dayName(d)}${n >= 0 && n <= 1 ? ', ' + timeOf(d) : ''}`;
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
    if (n && n === n.toUpperCase() && /[A-Z]{3}/.test(n)) {
      n = n
        .split(' ')
        .map((word, wi) =>
          word.replace(/[A-Za-z]+/g, (seg, at) => {
            if (KEEP_UPPER.test(seg)) return seg;
            const lower = seg.toLowerCase();
            if (wi > 0 && at === 0 && SMALL_WORDS.has(lower)) return lower;
            return lower[0].toUpperCase() + lower.slice(1);
          }),
        )
        .join(' ');
    }
    return n || c.code || '';
  }
  const initial = (c) => (String(c.code || c.name || '?').trim()[0] || '?').toUpperCase();
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

  async function fetchCourses() {
    const [cards, colors, full] = await Promise.all([
      api('/dashboard/dashboard_cards'),
      api('/users/self/colors').catch(() => ({})),
      api('/courses?enrollment_state=active&include[]=teachers&include[]=total_scores&per_page=100', true).catch(() => []),
    ]);
    const custom = colors.custom_colors || {};
    const byId = new Map(full.map((c) => [c.id, c]));
    return cards.map((d) => {
      const f = byId.get(d.id) || {};
      const enr = (f.enrollments || []).find((e) => e.type === 'student') || {};
      return {
        id: d.id,
        name: d.shortName,
        nick: !!d.originalName && d.shortName !== d.originalName,
        code: d.courseCode,
        term: d.term,
        image: d.image || '',
        color: custom[d.assetString] || d.color || '#1a73e8',
        teachers: (f.teachers || []).map((t) => ({ id: t.id, name: t.display_name })),
        score: enr.computed_current_score ?? null,
        letter: enr.computed_current_grade ?? null,
      };
    });
  }

  let COURSES = store.get('courses', null);
  const coursesReady = fetchCourses()
    .then((c) => {
      COURSES = c;
      store.set('courses', c);
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
    try {
      const [f, colors] = await Promise.all([
        api(`/courses/${id}?include[]=teachers&include[]=total_scores&include[]=term&include[]=course_image`),
        api('/users/self/colors').catch(() => ({})),
      ]);
      const enr = (f.enrollments || []).find((e) => e.type === 'student') || {};
      return {
        id,
        name: f.name,
        nick: false,
        code: f.course_code,
        term: f.term ? f.term.name : '',
        image: f.image_download_url || '',
        color: (colors.custom_colors || {})['course_' + id] || '#1a73e8',
        teachers: (f.teachers || []).map((t) => ({ id: t.id, name: t.display_name })),
        score: enr.computed_current_score ?? null,
        letter: enr.computed_current_grade ?? null,
      };
    } catch {
      return { id, name: '', code: '', term: '', image: '', color: '#1a73e8', teachers: [], score: null };
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
      const label = it.flagged ? 'Missing' : it.missing ? 'Past due' : `Due ${dayName(it.due)}`;
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
  const rail = el('<nav id="gcx-rail" aria-label="Main"></nav>');
  document.body.append(rail);
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
          <span class="gcx-me">${avatarUrl ? '' : esc((me && me.name ? me.name[0] : '?').toUpperCase())}</span>
          <span class="gcx-ri-tx"><span class="gcx-ri-name">${esc((me && me.name) || 'Account')}</span><span class="gcx-ri-sub">Account &amp; settings</span></span>
        </button>
      </div>`;
    if (avatarUrl) rail.querySelector('.gcx-me').style.backgroundImage = `url(${JSON.stringify(avatarUrl)})`;
  }
  const avatarInner = (c, look) => (look.icon && ICONS[look.icon] ? svg(look.icon, 18) : `<span class="gcx-av-l">${esc(initial(c))}</span>`);
  let unread = 0;
  renderRail(COURSES);
  coursesReady.then(renderRail);
  api('/users/self')
    .then((u) => {
      me = { id: u.id, name: u.short_name || u.name, avatar_url: u.avatar_url };
      store.set('me', me);
      renderRail(COURSES);
    })
    .catch(() => {});
  api('/conversations/unread_count')
    .then((r) => {
      unread = Number(r.unread_count) || 0;
      renderRail(COURSES);
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

  // Icon + color for a course's rail avatar, picked from a little panel next to the cursor.
  const LOOK_ICONS = ['', 'science', 'biotech', 'psych', 'calc', 'chart', 'code', 'book', 'pen', 'globe', 'palette', 'music', 'sport', 'leaf', 'bolt', 'star', 'heart', 'school', 'people', 'quiz'];
  const LOOK_COLORS = ['', '#d93025', '#e8710a', '#f9ab00', '#188038', '#12a4af', '#1a73e8', '#4f46e5', '#9334e6', '#c2185b', '#5f6368', '#202124'];
  function openLookPicker(item, ev) {
    document.querySelector('.gcx-look')?.remove();
    const id = Number(item.dataset.id);
    const c = (COURSES || []).find((x) => x.id === id);
    if (!c) return;
    const looks = store.get('looks', {});
    const look = { ...(looks[id] || {}) };
    const pop = el(`<div class="gcx-look gcx-pop-panel" role="dialog" aria-label="Customize ${esc(prettyName(c))}">
      <div class="gcx-look-h"><span class="gcx-look-prev"></span><div><b>${esc(prettyName(c))}</b><span>Icon and color in the menu</span></div></div>
      <div class="gcx-look-lbl">Icon</div>
      <div class="gcx-look-icons">${LOOK_ICONS.map((k) => `<button type="button" data-icon="${k}" title="${k || 'Letter'}">${k ? svg(k, 20) : `<span>${esc(initial(c))}</span>`}</button>`).join('')}</div>
      <div class="gcx-look-lbl">Color</div>
      <div class="gcx-look-colors">${LOOK_COLORS.map((k) => `<button type="button" data-color="${k}" title="${k || 'Course color'}" style="--sw:${k || c.color}">${k ? '' : svg('sync', 14)}</button>`).join('')}</div>
      <button type="button" class="gcx-look-reset">Reset</button>
    </div>`);
    document.body.append(pop);
    html.classList.add('gcx-rail-hold');
    const W = 280;
    const H = pop.offsetHeight;
    pop.style.left = Math.min(ev.clientX + 14, window.innerWidth - W - 12) + 'px';
    pop.style.top = Math.max(12, Math.min(ev.clientY - 40, window.innerHeight - H - 12)) + 'px';
    const paint = () => {
      const color = look.color || c.color;
      for (const n of [pop.querySelector('.gcx-look-prev'), ...rail.querySelectorAll(`.gcx-ri-course[data-id="${id}"] .gcx-av`)]) {
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
      else if (b.classList.contains('gcx-look-reset')) {
        delete look.icon;
        delete look.color;
      }
      b.classList.remove('gcx-bump');
      void b.offsetWidth;
      b.classList.add('gcx-bump');
      paint();
      save();
    });
    const close = () => {
      pop.classList.add('gcx-out');
      html.classList.remove('gcx-rail-hold');
      setTimeout(() => pop.remove(), 160);
      document.removeEventListener('mousedown', outside, true);
      document.removeEventListener('keydown', onKey, true);
    };
    const outside = (e) => {
      if (!pop.contains(e.target) && !e.target.closest?.('.gcx-ri-dots')) close();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', outside, true);
    document.addEventListener('keydown', onKey, true);
    pop.querySelector('.gcx-look-icons button.on, .gcx-look-icons button')?.focus({ preventScroll: true });
  }

  // ---------------------------------------------------------------- course top bar
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

  async function renderCourseBar() {
    const id = COURSE_ID;
    const base = `/courses/${id}`;
    const rest = location.pathname.slice(base.length);
    const tabs = [...document.querySelectorAll('#section-tabs a')]
      .map((a) => ({ label: tabLabel(a), href: a.getAttribute('href') || '' }))
      .filter((t) => t.href && t.label);
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

    const bar = el(`<div id="gcx-cbar">
      <a class="gcx-cbar-title" href="${base}"><span class="gcx-cbar-name">&nbsp;</span><span class="gcx-cbar-sub">&nbsp;</span></a>
      <nav class="gcx-tabs" aria-label="Course">
        <a class="gcx-tab${active === 'home' ? ' on' : ''}" href="${base}">Home</a>
        <a class="gcx-tab${active === 'classwork' ? ' on' : ''}" href="${classworkHref}">Classwork</a>
        ${hasPeople ? `<a class="gcx-tab${active === 'people' ? ' on' : ''}" href="${base}/users">People</a>` : ''}
      </nav>
      <div class="gcx-cbar-actions">
        <button class="gcx-more-btn" type="button" aria-expanded="false" aria-haspopup="true" title="Search everything else in this course (/)">
          ${svg('search', 20)}<span>More</span><kbd>/</kbd>
        </button>
        <div class="gcx-more" hidden>
          <div class="gcx-more-search">${svg('search', 20)}<input type="text" placeholder="Search course tools" aria-label="Search course tools" autocomplete="off"></div>
          <div class="gcx-more-list" role="listbox"></div>
        </div>
      </div>
    </div>`);
    document.getElementById('wrapper').prepend(bar);

    const panel = bar.querySelector('.gcx-more');
    const btn = bar.querySelector('.gcx-more-btn');
    const input = panel.querySelector('input');
    const list = panel.querySelector('.gcx-more-list');
    const extras = [
      { label: 'Canvas home page', href: `${base}?gcx-original=1`, icon: 'home' },
      ...(hasModules ? [{ label: 'Canvas modules page', href: `${base}/modules?gcx-original=1`, icon: 'page' }] : []),
    ];
    let sel = 0;
    const drawList = () => {
      const q = input.value.trim().toLowerCase();
      const match = (t) => !q || t.label.toLowerCase().includes(q);
      const a = others.filter(match);
      const b = extras.filter(match);
      const row = (t, i) =>
        `<a class="gcx-more-item${i === sel ? ' sel' : ''}" href="${esc(t.href)}" role="option">${svg(t.icon || tabIcon(t.href), 20)}<span>${esc(t.label)}</span></a>`;
      list.innerHTML =
        (a.length ? a.map(row).join('') : '') +
        (b.length ? `<div class="gcx-more-h">Original Canvas pages</div>` + b.map((t, i) => row(t, i + a.length)).join('') : '') ||
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
        location.href = items[sel].href;
      } else if (e.key === 'Escape') {
        open(false);
        btn.focus();
      }
    });
    document.addEventListener('click', (e) => {
      if (!panel.hidden && !e.target.closest('.gcx-cbar-actions')) open(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.composedPath()[0] || e.target;
      if (!t.tagName || t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      e.preventDefault();
      open(true);
    });

    const c = await courseById(id);
    bar.style.setProperty('--c', c.color);
    bar.querySelector('.gcx-cbar-name').textContent = prettyName(c) || c.code || 'Course';
    bar.querySelector('.gcx-cbar-sub').textContent = [c.code, teacherLine(c)].filter(Boolean).join(' · ');
    document.querySelector('#gcx-rail .gcx-ri-course.on')?.style.setProperty('--c', c.color);
    return c;
  }

  // ---------------------------------------------------------------- replacement views
  function mountView() {
    const content = document.getElementById('content');
    if (!content) return null;
    const view = el('<div id="gcx-view"></div>');
    content.prepend(view);
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
  const swapIn = (box, markup) => {
    box.innerHTML = markup;
    reveal(box);
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

  // ----- Home: banner, Upcoming, announcements stream
  async function renderHome(view, cPromise) {
    const id = COURSE_ID;
    view.innerHTML = `
      <div class="gcx-banner"><div class="gcx-banner-tx"><h1>&nbsp;</h1><div>&nbsp;</div></div></div>
      <div class="gcx-home-cols">
        <div class="gcx-home-side">
          <aside class="gcx-card gcx-upc"><div class="gcx-upc-h">Upcoming</div><div class="gcx-upc-list">${skeleton(3)}</div>
            <div class="gcx-upc-foot"><a class="gcx-upc-all" href="/courses/${id}/modules">View all</a></div></aside>
          <aside class="gcx-card gcx-links"></aside>
        </div>
        <section class="gcx-stream">${`<div class="gcx-card gcx-ann">${skeleton(4)}</div>`.repeat(2)}</section>
      </div>`;

    const classworkTab = document.querySelector('#gcx-cbar .gcx-tabs a:nth-child(2)');
    if (classworkTab) view.querySelector('.gcx-upc-all').href = classworkTab.href;
    const paintBanner = (c) => {
      view.style.setProperty('--c', c.color);
      const banner = view.querySelector('.gcx-banner');
      if (c.image) banner.style.backgroundImage = `url("${c.image.replace(/"/g, '%22')}")`;
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
    const fetchAnns = async () =>
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
    const drawAnns = (anns) => {
      if (!anns.length) {
        swapIn(stream, `<div class="gcx-card gcx-empty">No announcements yet.</div>`);
        return;
      }
      swapIn(
        stream,
        anns
          .map((a, i) => {
            const author = a.author || {};
            const when = a.posted_at ? new Date(a.posted_at) : null;
            const av = author.avatar && !/avatar-50\.png/.test(author.avatar) ? `data-av="${esc(author.avatar)}"` : '';
            return `<article class="gcx-card gcx-ann" style="--i:${Math.min(i, 8)}">
            <div class="gcx-ann-head">
              <span class="gcx-ann-av" ${av}>${av ? '' : esc((author.name || '?')[0])}</span>
              <div class="gcx-ann-who"><b>${esc(author.name || 'Instructor')}</b><span>${when ? esc(shortDate(when) + ', ' + timeOf(when)) : ''}</span></div>
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
      stream.classList.add('gcx-stagger');
      if (anns.length >= 15) stream.append(el(`<a class="gcx-chip" style="align-self:center" href="/courses/${id}/announcements">Older announcements</a>`));
      stream.querySelectorAll('[data-av]').forEach((n) => (n.style.backgroundImage = `url(${JSON.stringify(n.dataset.av)})`));
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
    swr('home:ann:' + id, fetchAnns, drawAnns).catch((e) => showError(stream, 'announcements', `/courses/${id}/announcements`, e));
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
        const list = links();
        const [gone] = list.splice(Number(x.dataset.i), 1);
        store.set(key, list);
        x.parentElement.classList.add('gcx-out');
        clearTimeout(box.gcxRedraw);
        box.gcxRedraw = setTimeout(() => draw(), 180);
        toast(`Removed ${gone.label}`);
        return;
      }
      if (e.target.closest('.gcx-links-add')) openPicker(e.target.closest('.gcx-links-add'));
    });

    function openPicker(btn) {
      document.querySelector('.gcx-picker')?.remove();
      const base = `/courses/${id}`;
      const pinned = new Set(links().map((l) => l.href));
      const options = [
        ...[...document.querySelectorAll('#section-tabs a')].map((a) => ({ label: tabLabel(a), href: a.getAttribute('href') || '' })),
        { label: 'Original Canvas home page', href: `${base}?gcx-original=1`, icon: 'home' },
        { label: 'Original modules page', href: `${base}/modules?gcx-original=1`, icon: 'page' },
      ].filter((o) => o.href && o.label && !pinned.has(o.href));
      const pop = el(`<div class="gcx-picker gcx-pop-panel" role="dialog" aria-label="Pin a link">
        <div class="gcx-more-search">${svg('search', 20)}<input type="text" placeholder="Search course tools" aria-label="Search course tools" autocomplete="off"></div>
        <div class="gcx-more-list"></div>
        <form class="gcx-picker-custom">
          <div class="gcx-more-h">Or any link</div>
          <input type="text" name="label" placeholder="Name" aria-label="Link name" required>
          <input type="text" name="href" placeholder="https://… or /courses/…" aria-label="Link address" required>
          <button type="submit">Pin link</button>
        </form>
      </div>`);
      document.body.append(pop);
      const r = btn.getBoundingClientRect();
      pop.style.left = Math.min(r.left, window.innerWidth - 356) + 'px';
      pop.style.top = Math.max(12, Math.min(r.bottom + 8, window.innerHeight - pop.offsetHeight - 12)) + 'px';
      btn.setAttribute('aria-expanded', 'true');
      const input = pop.querySelector('input');
      const list = pop.querySelector('.gcx-more-list');
      const drawList = () => {
        const q = input.value.trim().toLowerCase();
        const hits = options.filter((o) => !q || o.label.toLowerCase().includes(q));
        list.innerHTML = hits.length
          ? hits.map((o, i) => `<button type="button" class="gcx-more-item${i === 0 ? ' sel' : ''}" data-i="${options.indexOf(o)}">${svg(o.icon || tabIcon(o.href), 20)}<span>${esc(o.label)}</span></button>`).join('')
          : `<div class="gcx-more-empty">Nothing matches "${esc(input.value)}"</div>`;
      };
      drawList();
      input.focus();
      const add = (o) => {
        const l = links();
        l.push({ label: o.label, href: o.href, icon: o.icon });
        store.set(key, l);
        close();
        draw(l.length - 1);
        toast(`Pinned ${o.label}`);
      };
      const close = () => {
        pop.classList.add('gcx-out');
        btn.setAttribute('aria-expanded', 'false');
        setTimeout(() => pop.remove(), 160);
        document.removeEventListener('mousedown', outside, true);
      };
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
  }


  // ----- Classwork: modules as topics, each item with its grade or due status
  function statusOf(a, details) {
    if (a) {
      const s = a.submission || {};
      const pts = a.points_possible;
      const fmt = (n) => (Number.isInteger(n) ? n : +Number(n).toFixed(2));
      if (s.excused) return { text: 'Excused', cls: 'graded', done: true };
      if (s.workflow_state === 'graded' && s.score != null) return { text: pts ? `${fmt(s.score)}/${fmt(pts)}` : `${fmt(s.score)} pts`, cls: 'graded', done: true };
      if (s.missing) return { text: 'Missing', cls: 'missing', done: false };
      if (s.submitted_at) return { text: s.late ? 'Turned in late' : 'Turned in', cls: '', done: true };
      if (a.due_at) {
        const d = new Date(a.due_at);
        if (d < new Date()) return { text: `Was due ${shortDate(d)}`, cls: '', done: false };
        return { text: dueText(d), cls: dayDiff(d) <= 1 ? 'soon' : '', done: false };
      }
      return { text: pts ? `${fmt(pts)} pts` : '', cls: '', done: false };
    }
    if (details && details.due_at) {
      const d = new Date(details.due_at);
      return { text: d < new Date() ? `Was due ${shortDate(d)}` : dueText(d), cls: '', done: false };
    }
    return { text: '', cls: '', done: false };
  }
  const KIND_ICON = { Assignment: 'assignment', Quiz: 'quiz', Discussion: 'discussion', File: 'file', Page: 'page', ExternalUrl: 'link', ExternalTool: 'tool' };

  function rowHtml(r, i = 0) {
    const st = statusOf(r.a, r.details);
    const locked = r.details && r.details.locked_for_user;
    const sub = r.details && r.details.lock_explanation && locked ? r.details.lock_explanation.replace(/<[^>]+>/g, '') : '';
    const pad = r.indent ? `padding-left:${16 + r.indent * 20}px;` : '';
    return `<a class="gcx-row${st.done || r.kind === 'File' || r.kind === 'Page' ? ' done' : ''}${locked ? ' locked' : ''}" href="${esc(r.url)}"${
      r.fileId ? ` data-gcx-file="${esc(r.fileId)}" data-gcx-course="${COURSE_ID}"` : ''
    } data-q="${esc(r.title.toLowerCase())}" style="${pad}--i:${Math.min(i, 12)}">
      <span class="gcx-row-ic">${svg(locked ? 'lock' : KIND_ICON[r.kind] || 'link', 20)}</span>
      <span class="gcx-row-main"><span class="gcx-row-title">${esc(r.title)}</span>${sub ? `<span class="gcx-row-sub">${esc(sub)}</span>` : ''}</span>
      <span class="gcx-row-meta ${st.cls}">${esc(r.meta != null ? r.meta : st.text)}</span></a>`;
  }
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
  async function fetchClasswork(id) {
    const [mods, groups] = await Promise.all([
      api(`/courses/${id}/modules?include[]=items&include[]=content_details&per_page=50`, true).catch(() => null),
      api(`/courses/${id}/assignment_groups?include[]=assignments&include[]=submission&include[]=discussion_topic&per_page=50`, true).catch(() => null),
    ]);
    if (!mods && !groups) throw new Error('Canvas returned nothing');
    // Big modules come back without inline items.
    await Promise.all(
      (mods || [])
        .filter((m) => !m.items && m.items_url)
        .map(async (m) => {
          m.items = await api(`${m.items_url}${m.items_url.includes('?') ? '&' : '?'}include[]=content_details&per_page=100`, true).catch(() => []);
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
          discussion_topic: a.discussion_topic ? { id: a.discussion_topic.id } : null,
          submission: sub(a.submission),
        })),
      })),
    };
  }
  async function fetchFiles(id) {
    const [files, folders] = await Promise.all([
      api(`/courses/${id}/files?per_page=100&sort=updated_at&order=desc`, true),
      api(`/courses/${id}/folders?per_page=100`, true).catch(() => []),
    ]);
    return {
      folders: folders.map((f) => ({ id: f.id, path: f.full_name })),
      files: files.map((f) => ({ id: f.id, name: f.display_name, folder: f.folder_id, updated: f.updated_at, locked: !!f.locked_for_user })),
    };
  }
  const hasTab = (re) => [...document.querySelectorAll('#section-tabs a')].some((a) => re.test(a.getAttribute('href') || ''));

  // Warm the Classwork cache while he's on any other page of the course.
  function prefetchClasswork(id) {
    const go = () => {
      fetchClasswork(id)
        .then((d) => cache.set('cw:' + id, JSON.parse(JSON.stringify(d))))
        .catch(() => {});
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
          url: it.html_url || it.external_url || '#',
          indent: it.indent || 0,
          a,
          details: it.content_details,
          fileId: it.type === 'File' ? it.content_id : null,
        });
      }
      topics.push({ name: m.name, rows, tag: m.state === 'locked' ? 'Locked' : '' });
    }
    const kindOf = (a) => (a.quiz_id ? 'Quiz' : a.discussion_topic ? 'Discussion' : 'Assignment');
    for (const g of groups) {
      const rows = (g.assignments || [])
        .filter((a) => !used.has(a.id))
        .sort((x, y) => (x.due_at ? Date.parse(x.due_at) : Infinity) - (y.due_at ? Date.parse(y.due_at) : Infinity))
        .map((a) => ({ kind: kindOf(a), title: a.name, url: a.html_url, a }));
      if (rows.length) topics.push({ name: g.name, rows, tag: mods && mods.length ? 'Not in a module' : '' });
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

    const draw = (data, fromCache) => {
      const { topics, missing, dueThisWeek } = buildTopics(data);
      const scrollY = window.scrollY;
      const oldInput = drawn ? view.querySelector('.gcx-filter input') : null;
      const q = oldInput ? oldInput.value : '';
      const typing = oldInput && document.activeElement === oldInput ? [oldInput.selectionStart, oldInput.selectionEnd] : null;
      view.innerHTML = `
      <div class="gcx-cw-head">
        <a class="gcx-chip" href="/courses/${id}/grades">${svg('grade', 20)}${c && c.score != null ? `Grade · ${esc(c.letter ? c.letter + ' · ' : '')}${esc(+c.score.toFixed(2))}%` : 'Grades'}</a>
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
                  const closed = t.files ? !closedSet.has('open:files') : closedSet.has(t.name);
                  return `<section class="gcx-topic${closed ? ' closed' : ''}${t.files ? ' gcx-files-topic' : ''}" id="gcx-t${i}" data-k="${esc(t.files ? 'files' : t.name)}" style="--i:${Math.min(i, 8)}">
            <button class="gcx-topic-h" type="button" aria-expanded="${!closed}"><h2>${esc(t.name)}</h2>${t.tag ? `<span class="gcx-topic-tag">${esc(t.tag)}</span>` : ''}<span class="gcx-count">${
              t.files ? '' : t.rows.filter((r) => !r.header).length || ''
            }</span>${svg('chevron')}</button>
            <div class="gcx-topic-rows gcx-collapse"><div class="gcx-collapse-in">${
              t.files
                ? `<div class="gcx-files-slot">${filesData ? filesTreeHtml(id, filesData, closedSet) : `<div class="gcx-pad">${skeleton(3)}</div>`}</div>`
                : topicRowsHtml(t.rows, t.name, closedSet) || '<div class="gcx-empty">Nothing here yet.</div>'
            }</div></div></section>`;
                })
                .join('')
            : '<div class="gcx-card gcx-empty">This course has no modules or assignments yet.</div>'
        }</div>
      </div>`;
      if (!drawn) view.querySelector('.gcx-cw').classList.add('gcx-stagger');
      else window.scrollTo(0, scrollY);
      drawn = true;
      wire();
      if (q) {
        const input = view.querySelector('.gcx-filter input');
        input.value = q;
        input.dispatchEvent(new Event('input'));
      }
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
        () => fetchFiles(id),
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

    function wire() {
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
    });
    if (c) view.style.setProperty('--c', c.color);
    try {
      await swr('cw:' + id, () => fetchClasswork(id), (d, fromCache) => {
        draw(d, fromCache);
        if (!fromCache) reveal(view.querySelector('.gcx-cw-head'));
      });
      const badge = view.querySelector('.gcx-sync');
      if (badge) badge.hidden = true;
    } catch (e) {
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
        <button type="button" data-tab="assigned">Assigned<span class="gcx-n"></span></button>
        <button type="button" data-tab="missing">Missing<span class="gcx-n"></span></button>
        <button type="button" data-tab="done">Done<span class="gcx-n"></span></button>
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

    const fetchItems = async () => {
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
              .catch(() => []),
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
        b.querySelector('.gcx-n').textContent = pool.filter(inTab[b.dataset.tab]).length || '';
      });
      moveInk();
      const list = pool.filter(inTab[tab]);
      const order = tab === 'assigned' ? 1 : -1;
      list.sort((a, b) => order * ((a.due ? +a.due : order * Infinity) - (b.due ? +b.due : order * Infinity)));
      const groups = bucketsFor[tab].map(([label, fn]) => [label, list.filter(fn)]).filter(([, l]) => l.length);
      const body = view.querySelector('.gcx-todo-body');
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
    try {
      await swr(
        'todo:items',
        fetchItems,
        (data, fromCache) => {
          const first = !items;
          items = data;
          draw(first ? 'fade' : '');
          if (!fromCache && !first) reveal(view.querySelector('.gcx-seg'));
        },
        reviveItems,
      );
    } catch (e) {
      showError(view.querySelector('.gcx-todo-body'), 'your to-do list', '/', e);
    } finally {
      syncBadge.hidden = true;
    }
  }

  // ---------------------------------------------------------------- dashboard
  let dashItems = null; // planner items for the next two weeks (cached copy first, then fresh)
  function enhanceCards() {
    const cards = document.querySelectorAll('.ic-DashboardCard');
    for (const card of cards) {
      if (card.querySelector(':scope > .gcx-card-body')) continue;
      const link = card.querySelector('a.ic-DashboardCard__link, a[href^="/courses/"]');
      const id = Number(((link && link.getAttribute('href')) || '').match(/\/courses\/(\d+)/)?.[1]);
      const header = card.querySelector('.ic-DashboardCard__header');
      if (!id || !header) continue;
      const fallbackTitle = card.querySelector('.ic-DashboardCard__header-title')?.textContent.trim() || '';
      header.append(
        el(`<a class="gcx-card-ov" href="/courses/${id}"><div class="gcx-card-title">${esc(prettyName({ name: fallbackTitle }))}</div><div class="gcx-card-teacher"></div></a>`),
      );
      card.append(
        el(`<div class="gcx-card-body" data-course="${id}"><div class="gcx-card-due-wrap">${skeleton(2)}</div><div class="gcx-card-foot"><span></span></div></div>`),
      );
      fillCard(card, id);
    }
  }
  async function fillCard(card, id) {
    const c = (COURSES || []).find((x) => x.id === id) || (await coursesReady).find((x) => x.id === id) || (await courseById(id));
    const ov = card.querySelector('.gcx-card-ov');
    const body = card.querySelector('.gcx-card-body');
    if (!ov || !body) return;
    body.dataset.color = c.color;
    body.style.setProperty('--c', c.color);
    if (c.name) ov.querySelector('.gcx-card-title').textContent = prettyName(c);
    ov.querySelector('.gcx-card-teacher').textContent = teacherLine(c);
    const foot = body.querySelector('.gcx-card-foot');
    if (c.teachers.length && !foot.querySelector('.gcx-iconbtn')) {
      const who = c.teachers.length <= 2 ? c.teachers[0].name : 'the instructors';
      foot.append(el(`<a class="gcx-iconbtn" href="${esc(emailHref(c))}" title="Email ${esc(who)}" aria-label="Email ${esc(who)}">${svg('mail', 22)}</a>`));
    }
    if (dashItems) fillCardDue(body);
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
    document.querySelectorAll('.gcx-card-body[data-color]').forEach(fillCardDue);
  }

  // ----- "Welcome back, Saif!" with a line that knows what's going on
  function mountWelcome() {
    const anchor = document.getElementById('dashboard_header_container');
    if (!anchor || document.querySelector('.gcx-welcome')) return;
    const name = (me && me.name ? me.name.split(' ')[0] : '') || 'there';
    const wel = el(`<div class="gcx-welcome"><div class="gcx-welcome-tx"><h1 class="gcx-hello"></h1><div class="gcx-welcome-sub">&nbsp;</div></div><div class="gcx-ask-slot"></div></div>`);
    anchor.before(wel);
    const lastVisit = store.get('lastVisit', 0);
    store.set('lastVisit', Date.now());
    welcomeCtx = { name, lastVisit, wel, titled: false, fromCache: false };
    // Wait briefly for the cached work list so the greeting is picked once, not twice.
    setTimeout(() => {
      if (welcomeCtx.titled) return;
      welcomeCtx.titled = true;
      wel.querySelector('.gcx-hello').textContent = greeting(name, null, lastVisit);
    }, 350);
  }
  let welcomeCtx = null;
  function updateWelcome(items, fromCache) {
    if (!welcomeCtx) return;
    const { wel, name } = welcomeCtx;
    // The title is picked once (from cached work when there is some) so it doesn't jump.
    const hello = wel.querySelector('.gcx-hello');
    if (!welcomeCtx.titled) {
      welcomeCtx.titled = true;
      welcomeCtx.fromCache = fromCache;
      hello.textContent = greeting(name, items, welcomeCtx.lastVisit);
      welcomeCtx.refs = greetRefs;
    } else if (!fromCache && welcomeCtx.fromCache && welcomeCtx.refs.length) {
      // The greeting came from the saved list. If the work it mentions is no longer open
      // (handed in since, or now missing), pick again from the fresh list.
      welcomeCtx.fromCache = false;
      const open = new Set(items.filter((i) => !i.done && !i.missing).map((i) => i.key));
      const flagged = items.some((i) => i.flagged);
      if (welcomeCtx.refs.some((k) => (k === 'flagged' ? !flagged : !open.has(k)))) {
        hello.textContent = greeting(name, items, welcomeCtx.lastVisit);
        welcomeCtx.refs = greetRefs;
        reveal(hello);
      }
    }
    const sub = wel.querySelector('.gcx-welcome-sub');
    const text = welcomeSub(items);
    if (sub.textContent !== text) {
      sub.textContent = text;
      if (!fromCache) reveal(sub);
    }
  }
  function welcomeSub(items) {
    const now = new Date();
    const open = items.filter((i) => !i.done && !i.missing && i.due && i.due >= now);
    const flagged = items.filter((i) => i.flagged).length;
    const today = open.filter((i) => dayDiff(i.due) === 0).length;
    const week = open.filter((i) => i.due < weekStart(1)).length;
    const next = open.sort((a, b) => a.due - b.due)[0];
    const bits = [];
    if (today) bits.push(`${today} due today`);
    else if (week) bits.push(`${week} due this week`);
    if (flagged) bits.push(`${flagged} missing`);
    if (next) {
      const day = dayName(next.due).replace(/^(Today|Tomorrow)$/, (w) => w.toLowerCase());
      bits.push(`next up: ${next.title}, ${day} at ${timeOf(next.due)}`);
    }
    if (!bits.length) return 'Nothing due in the next two weeks. Enjoy it.';
    const s = bits.join(' · ');
    return s[0].toUpperCase() + s.slice(1);
  }

  // Lots of ways to say hello. Most specific wins: something due within hours, a holiday,
  // something due today, a long absence, late night. Otherwise a random pick from time of day,
  // weekday and season, never the same one twice in a row.
  let greetRefs = []; // keys of the work items (or 'flagged') the last greeting talked about
  function greeting(n, items, lastVisit = 0) {
    greetRefs = [];
    const now = new Date();
    const h = now.getHours();
    const wd = now.getDay();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const open = (items || []).filter((i) => !i.done && !i.missing && i.due && i.due >= now).sort((a, b) => a.due - b.due);
    const next = open[0];
    const hoursLeft = next ? (next.due - now) / 36e5 : Infinity;
    const short = (t) => (t.length > 34 ? t.slice(0, 32).trim() + '…' : t);

    if (next && hoursLeft < 6) {
      greetRefs = [next.key];
      const left = hoursLeft < 1 ? `${Math.max(1, Math.round(hoursLeft * 60))} minutes` : `${Math.round(hoursLeft)} hour${Math.round(hoursLeft) === 1 ? '' : 's'}`;
      return pick([`${short(next.title)} is due in ${left}, ${n}.`, `Clock's ticking, ${n}: ${short(next.title)} in ${left}.`, `${n}, heads up: ${short(next.title)} is due in ${left}.`]);
    }

    // Fixed and floating holidays.
    const nthWeekday = (month, weekday, nth) => {
      const x = new Date(now.getFullYear(), month - 1, 1);
      const first = (weekday - x.getDay() + 7) % 7 + 1;
      return first + (nth - 1) * 7;
    };
    const thanksgiving = nthWeekday(11, 4, 4);
    const holiday =
      (m === 1 && d === 1 && [`Happy New Year, ${n}!`, `New year, new semester, ${n}.`]) ||
      (m === 1 && d <= 7 && [`Happy New Year, ${n}! Welcome back.`]) ||
      (m === 2 && d === 14 && [`Happy Valentine's Day, ${n}!`]) ||
      (m === 3 && d === 17 && [`Happy St. Patrick's Day, ${n}!`]) ||
      (m === 3 && d >= 9 && d <= 20 && wd >= 1 && wd <= 5 && h < 4 && [`Spring break soon, ${n}?`]) ||
      (m === 4 && d === 1 && [`Welcome back, ${n}! (No pranks here.)`]) ||
      (m === 7 && d === 4 && [`Happy Fourth of July, ${n}!`]) ||
      (m === 10 && d === 31 && [`Happy Halloween, ${n}!`, `Trick or treat, ${n}!`]) ||
      (m === 10 && d >= 24 && [`Spooky season, ${n}.`, `Halloween's almost here, ${n}!`, `Boo! Welcome back, ${n}.`]) ||
      (m === 11 && d === thanksgiving && [`Happy Thanksgiving, ${n}!`]) ||
      (m === 11 && d > thanksgiving - 5 && d < thanksgiving && [`Thanksgiving break is close, ${n}.`, `Almost turkey time, ${n}!`]) ||
      (m === 11 && d > thanksgiving && d <= thanksgiving + 3 && [`Hope the break was good, ${n}!`]) ||
      (m === 12 && d >= 24 && d <= 25 && [`Merry Christmas, ${n}!`, `Happy holidays, ${n}!`]) ||
      (m === 12 && d === 31 && [`Last day of the year, ${n}!`]) ||
      (((m === 12 && d <= 16) || (m === 5 && d <= 14)) && [`Finals season, ${n}. You've got this.`, `Home stretch, ${n}!`, `Deep breaths, ${n}. Finals are almost done.`]) ||
      (((m === 8 && d >= 24) || (m === 1 && d >= 12 && d <= 20)) && [`Welcome to the new semester, ${n}!`, `Fresh semester, ${n}. Let's go.`]) ||
      null;
    if (holiday) return pick(holiday);

    const dueToday = open.filter((i) => dayDiff(i.due) === 0);
    if (dueToday.length) greetRefs = dueToday.map((i) => i.key);
    if (dueToday.length)
      return pick(
        dueToday.length === 1
          ? [`${short(dueToday[0].title)} is due today, ${n}.`, `One thing due today, ${n}. You've got it.`]
          : [`${dueToday.length} things due today, ${n}.`, `Busy day, ${n}: ${dueToday.length} due today.`],
      );
    const flagged = (items || []).filter((i) => i.flagged).length;
    if (flagged && Math.random() < 0.5) greetRefs = ['flagged'];
    if (greetRefs[0] === 'flagged') return pick([`Let's catch up, ${n}.`, `A little catching up to do, ${n}.`]);

    const away = lastVisit ? (Date.now() - lastVisit) / 864e5 : 0;
    if (away > 7) return pick([`Long time no see, ${n}!`, `It's been a minute, ${n}. Welcome back!`]);
    if (away > 2) return pick([`Good to see you again, ${n}!`, `Welcome back, ${n}! Here's what you missed.`]);
    if (lastVisit && Date.now() - lastVisit < 10 * 6e4) {
      if (Math.random() < 0.5) return pick([`Back already, ${n}?`, `Hi again, ${n}!`, `Welcome back, ${n}!`]);
    }
    if (h >= 0 && h < 4) return pick([`Burning the midnight oil, ${n}?`, `Up late, ${n}?`, `Night owl mode, ${n}.`, `Still up, ${n}? Don't forget to sleep.`]);
    if (items && !open.some((i) => i.due < horizonEnd()) && !flagged && Math.random() < 0.6) return pick([`All clear, ${n}!`, `Nothing due for two weeks, ${n}. Nice.`]);
    if (next && dayDiff(next.due) === 1 && Math.random() < 0.5) {
      greetRefs = [next.key];
      return `${short(next.title)} is due tomorrow, ${n}.`;
    }

    const pool = [`Welcome back, ${n}!`, `Hey ${n}!`, `Hi ${n}, ready to learn?`, `Let's get to it, ${n}.`];
    if (h >= 4 && h < 12) pool.push(`Good morning, ${n}!`, `Morning, ${n}!`, `Rise and shine, ${n}!`, `Fresh start, ${n}.`);
    else if (h < 17) pool.push(`Good afternoon, ${n}!`, `Afternoon, ${n}!`, `How's the day going, ${n}?`);
    else if (h < 21) pool.push(`Good evening, ${n}!`, `Evening, ${n}!`, `Winding down, ${n}?`);
    else pool.push(`Late night session, ${n}?`, `Good evening, ${n}!`, `One more thing before bed, ${n}?`);
    if (wd === 1) pool.push(`Happy Monday, ${n}!`, `New week, ${n}. Let's go.`);
    if (wd === 3) pool.push(`Halfway through the week, ${n}!`);
    if (wd === 5) pool.push(`Happy Friday, ${n}!`, `Almost the weekend, ${n}!`);
    if (wd === 0 || wd === 6) pool.push(`Happy ${now.toLocaleDateString(undefined, { weekday: 'long' })}, ${n}!`, `Weekend study session, ${n}?`);
    if (m >= 9 && m <= 11) pool.push(`Cozy fall vibes, ${n}.`, `Happy fall, ${n}!`);
    if (m === 12 || m <= 2) pool.push(`Stay warm, ${n}!`);
    if (m >= 3 && m <= 5) pool.push(`Happy spring, ${n}!`);
    if (m >= 6 && m <= 8) pool.push(`Summer session, ${n}?`);
    const last = store.get('lastHello', '');
    const choices = pool.filter((p) => p !== last);
    const out = pick(choices.length ? choices : pool);
    store.set('lastHello', out);
    return out;
  }

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
        @keyframes gcx-bc-in{from{opacity:0;transform:translateY(-4px)}}`;
      sr.append(st);
      new MutationObserver(debounce(() => applyBcTodo(sr), 60)).observe(sr, { childList: true, subtree: true, characterData: true });
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
        bcExpanded = !bcExpanded;
        // BetterCampus may have re-rendered since this button was made; work on the live list.
        const sr = btn.getRootNode();
        if (sr && sr.getElementById) applyBcTodo(sr);
        const live = sr && sr.getElementById ? [...sr.querySelectorAll('.group')].map((g) => g.parentElement) : [];
        live.forEach((n) => n.toggleAttribute('data-gcx-new', bcExpanded));
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
  function toast(msg) {
    if (!toastEl) {
      toastEl = el('<div class="gcx-toast" role="status" aria-live="polite"></div>');
      document.body.append(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.remove('show');
    void toastEl.offsetWidth;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  // ---------------------------------------------------------------- shared with fileview.js and ai.js
  window.gcx = {
    api, esc, el, svg, ICONS, store, debounce, coursesReady, courseById, prettyName, planner, toast,
    COURSE_ID, VIEW, getMe: () => me,
  };

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
    else if (to && from && to.i >= 0 && from.i >= 0 && to.i !== from.i) dir = to.i > from.i ? 'left' : 'right';
    else if (from && !to) dir = 'out';
    try {
      sessionStorage.setItem('gcx:nav', JSON.stringify({ dir, t: Date.now() }));
    } catch {}
  });
  // The attribute only matters while the page transition runs.
  setTimeout(() => delete html.dataset.gcxNav, 2000);

  // Dark/light switches: BetterCampus swaps its theme <style> text. Put the old text back for
  // one frame and let a view transition crossfade to the new one.
  const THEME_STYLE = /^(darkcss|bettercanvas-|bettercampus-)/;
  const themeSnap = new Map();
  const snapTheme = () => {
    themeSnap.clear();
    for (const n of document.querySelectorAll('head style[id]')) if (THEME_STYLE.test(n.id)) themeSnap.set(n, n.textContent);
  };
  let themeBusy = false;
  const themeObserver = new MutationObserver(() => {
    if (themeBusy) return;
    const changed = [...document.querySelectorAll('head style[id]')].filter((n) => THEME_STYLE.test(n.id) && themeSnap.get(n) !== n.textContent);
    const isTheme = changed.some((n) => n.id === 'darkcss' || n.id === 'bettercanvas-theme-preset');
    if (!changed.length || !isTheme || !document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      snapTheme();
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
    };
    try {
      document
        .startViewTransition(() => {
          for (const [n, text] of next) {
            n.textContent = text;
            n.media = '';
          }
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
    const t = e.target.closest && e.target.closest('.gcx-row, .gcx-chip, .gcx-ri, .gcx-tab, .gcx-due-item, .gcx-more-btn, .gcx-seg button, .gcx-link a, .gcx-iconbtn, .gcx-links-add');
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
  if (html.classList.contains('gcx-dash')) mountWelcome();
  (window.requestIdleCallback || setTimeout)(() => cache.sweep(), { timeout: 5000 });
  if (COURSE_ID) {
    const cPromise = renderCourseBar();
    if (VIEW === 'home' || VIEW === 'classwork') {
      const view = mountView();
      if (view) (VIEW === 'home' ? renderHome : renderClasswork)(view, cPromise);
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
      },
      reviveItems,
    ).catch((e) => {
      console.warn('[canvas-classroom] planner', e);
      dashItems = [];
      document.querySelectorAll('.gcx-card-due-wrap').forEach((w) => (w.innerHTML = `<div class="gcx-due-none">Couldn't load assignments.</div>`));
      updateWelcome([], false);
    });
    const run = debounce(enhanceCards, 80);
    run();
    new MutationObserver(run).observe(document.getElementById('content') || document.body, { childList: true, subtree: true });
  }

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
