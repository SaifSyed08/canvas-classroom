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
      url: it.html_url || (it.plannable_type === 'planner_note' ? '/calendar' : '#'),
      courseId: it.course_id || null,
      courseName: it.context_name || '',
      done,
      missing: !done && !!past,
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
      missing: !done && !!(due && due < new Date()),
      graded: s.workflow_state === 'graded',
      late: !!s.late,
      submitted: !!s.submitted_at,
    };
  }
  async function planner(fromDays, toDays, courseId) {
    const now = Date.now();
    let q = `/planner/items?start_date=${new Date(now + fromDays * DAY).toISOString()}&end_date=${new Date(now + toDays * DAY).toISOString()}&per_page=100`;
    if (courseId) q += `&context_codes[]=course_${courseId}`;
    const items = await api(q, true);
    return items.filter((it) => WORK_TYPES.has(it.plannable_type)).map(normPlanner);
  }

  // Missing first (newest first), then upcoming work inside the horizon, soonest first.
  function dueSoon(items) {
    const horizon = startOfDay(Date.now() + (HORIZON_DAYS + 1) * DAY);
    const missing = items.filter((i) => i.missing).sort((a, b) => b.due - a.due);
    const upcoming = items.filter((i) => !i.done && !i.missing && i.due && i.due < horizon).sort((a, b) => a.due - b.due);
    return [...missing, ...upcoming];
  }
  // Groups items under "Missing" / "Due Today" / "Due Tomorrow" / "Due Friday" / "Due Nov 4" labels.
  function dueGroupsHtml(items, limit, colorOf) {
    const groups = [];
    for (const it of items.slice(0, limit)) {
      const label = it.missing ? 'Missing' : `Due ${dayName(it.due)}`;
      const cls = it.missing ? 'missing' : dayDiff(it.due) <= 1 ? 'soon' : '';
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
    const courseItems = (courses || [])
      .map(
        (c) => `<a class="gcx-ri gcx-ri-course${COURSE_ID === c.id ? ' on' : ''}" href="/courses/${c.id}" title="${esc(prettyName(c))}" style="--c:${esc(c.color)}">
          <span class="gcx-av">${esc(initial(c))}</span>
          <span class="gcx-ri-tx"><span class="gcx-ri-name">${esc(prettyName(c))}</span><span class="gcx-ri-sub">${esc(c.code)}</span></span></a>`,
      )
      .join('');
    const avatar = me && me.avatar_url && !/avatar-50\.png/.test(me.avatar_url) ? `style="background-image:url('${esc(me.avatar_url)}')"` : '';
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
          <span class="gcx-me" ${avatar}>${avatar ? '' : esc((me && me.name ? me.name[0] : '?').toUpperCase())}</span>
          <span class="gcx-ri-tx"><span class="gcx-ri-name">${esc((me && me.name) || 'Account')}</span><span class="gcx-ri-sub">Account &amp; settings</span></span>
        </button>
      </div>`;
  }
  let unread = 0;
  renderRail(COURSES);
  coursesReady.then(renderRail);
  api('/users/self')
    .then((u) => {
      me = { name: u.short_name || u.name, avatar_url: u.avatar_url };
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
    if (e.target.closest('.gcx-burger')) {
      const on = !html.classList.contains('gcx-pinned');
      html.classList.toggle('gcx-pinned', on);
      store.set('pinned', on);
      renderRail(COURSES);
    } else if (e.target.closest('.gcx-account')) {
      // Canvas's own account tray (profile, settings, log out) still works with its nav hidden.
      const link = document.getElementById('global_nav_profile_link');
      if (link) link.click();
      else location.href = '/profile/settings';
    }
  });

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
    const others = tabs.filter((t) => {
      const r = t.href.replace(/^https?:\/\/[^/]+/, '').replace(base, '').split('?')[0];
      return !(CORE.home.test(r) || CORE.classwork.test(r) || CORE.people.test(r));
    });

    const active = CORE.home.test(rest) || /^\/announcements/.test(rest)
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
        <a class="gcx-tab${active === 'classwork' ? ' on' : ''}" href="${base}/modules">Classwork</a>
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
      { label: 'Canvas modules page', href: `${base}/modules?gcx-original=1`, icon: 'page' },
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
      const t = e.target;
      if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
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
        <aside class="gcx-card gcx-upc"><div class="gcx-upc-h">Upcoming</div><div class="gcx-upc-list">${skeleton(3)}</div>
          <div class="gcx-upc-foot"><a href="/courses/${id}/modules">View all</a></div></aside>
        <section class="gcx-stream">${`<div class="gcx-card gcx-ann">${skeleton(4)}</div>`.repeat(2)}</section>
      </div>`;

    cPromise.then((c) => {
      view.style.setProperty('--c', c.color);
      const banner = view.querySelector('.gcx-banner');
      if (c.image) banner.style.backgroundImage = `url("${c.image.replace(/"/g, '%22')}")`;
      banner.querySelector('.gcx-banner-tx').innerHTML = `<h1>${esc(prettyName(c))}</h1><div>${esc([c.code, c.term].filter(Boolean).join(' · '))}</div>${
        c.teachers.length ? `<div>${esc(teacherLine(c))}</div>` : ''
      }`;
      if (c.score != null) banner.append(el(`<a class="gcx-banner-grade" href="/courses/${id}/grades">${esc(c.letter ? c.letter + ' · ' : '')}${esc(+c.score.toFixed(2))}%</a>`));
    });

    planner(-HORIZON_DAYS, HORIZON_DAYS, id)
      .then(async (items) => {
        const c = await cPromise;
        const soon = dueSoon(items);
        view.querySelector('.gcx-upc-list').innerHTML = soon.length
          ? `<div class="gcx-due">${dueGroupsHtml(soon, 6, () => c.color)}</div>`
          : `<div class="gcx-due-none">Nothing due in the next two weeks.</div>`;
      })
      .catch((e) => showError(view.querySelector('.gcx-upc-list'), 'upcoming work', `/courses/${id}/assignments`, e));

    const stream = view.querySelector('.gcx-stream');
    try {
      const anns = await api(
        `/announcements?context_codes[]=course_${id}&start_date=2000-01-01&end_date=${new Date(Date.now() + DAY).toISOString()}&active_only=true&per_page=15`,
      );
      const c = await cPromise;
      if (!anns.length) {
        stream.innerHTML = `<div class="gcx-card gcx-empty">No announcements yet.</div>`;
        return;
      }
      stream.innerHTML = anns
        .map((a) => {
          const author = a.author || {};
          const when = a.posted_at ? new Date(a.posted_at) : null;
          const av = author.avatar_image_url && !/avatar-50\.png/.test(author.avatar_image_url) ? `style="background-image:url('${esc(author.avatar_image_url)}')"` : '';
          return `<article class="gcx-card gcx-ann">
            <div class="gcx-ann-head">
              <span class="gcx-ann-av" ${av}>${av ? '' : esc((author.display_name || '?')[0])}</span>
              <div class="gcx-ann-who"><b>${esc(author.display_name || 'Instructor')}</b><span>${when ? esc(shortDate(when) + ', ' + timeOf(when)) : ''}</span></div>
              ${a.read_state === 'unread' ? '<span class="gcx-ann-new">New</span>' : ''}
            </div>
            <a class="gcx-ann-title" href="${esc(a.html_url)}">${esc(a.title)}</a>
            <div class="gcx-ann-body">${cleanHtml(a.message)}</div>
            <div class="gcx-ann-foot">
              <button type="button" class="gcx-ann-toggle" hidden>Show more</button>
              <a href="${esc(a.html_url)}">${a.discussion_subentry_count ? `${a.discussion_subentry_count} ${a.discussion_subentry_count === 1 ? 'reply' : 'replies'}` : 'Open'}</a>
            </div>
          </article>`;
        })
        .join('');
      if (anns.length >= 15) stream.append(el(`<a class="gcx-chip" style="align-self:center" href="/courses/${id}/announcements">Older announcements</a>`));
      stream.style.setProperty('--c', c.color);
      for (const art of stream.querySelectorAll('.gcx-ann')) {
        const body = art.querySelector('.gcx-ann-body');
        const toggle = art.querySelector('.gcx-ann-toggle');
        if (body && body.scrollHeight > body.clientHeight + 4) {
          body.classList.add('clip');
          toggle.hidden = false;
          toggle.addEventListener('click', () => {
            const open = body.classList.toggle('open');
            toggle.textContent = open ? 'Show less' : 'Show more';
          });
        }
      }
    } catch (e) {
      showError(stream, 'announcements', `/courses/${id}/announcements`, e);
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

  function rowHtml(r) {
    const st = statusOf(r.a, r.details);
    const locked = r.details && r.details.locked_for_user;
    const sub = r.details && r.details.lock_explanation && locked ? r.details.lock_explanation.replace(/<[^>]+>/g, '') : '';
    return `<a class="gcx-row${st.done || r.kind === 'File' || r.kind === 'Page' ? ' done' : ''}${locked ? ' locked' : ''}" href="${esc(r.url)}" data-q="${esc(r.title.toLowerCase())}" style="${r.indent ? `padding-left:${16 + r.indent * 20}px` : ''}">
      <span class="gcx-row-ic">${svg(locked ? 'lock' : KIND_ICON[r.kind] || 'link', 20)}</span>
      <span class="gcx-row-main"><span class="gcx-row-title">${esc(r.title)}</span>${sub ? `<span class="gcx-row-sub">${esc(sub)}</span>` : ''}</span>
      <span class="gcx-row-meta ${st.cls}">${esc(st.text)}</span></a>`;
  }

  async function renderClasswork(view, cPromise) {
    const id = COURSE_ID;
    view.innerHTML = `<div class="gcx-cw-head">${skeleton(1)}</div><div class="gcx-card">${skeleton(6)}</div>`;
    let mods, groups;
    try {
      [mods, groups] = await Promise.all([
        api(`/courses/${id}/modules?include[]=items&include[]=content_details&per_page=50`, true).catch(() => null),
        api(`/courses/${id}/assignment_groups?include[]=assignments&include[]=submission&per_page=50`, true).catch(() => []),
      ]);
      // Big modules come back without inline items.
      await Promise.all(
        (mods || [])
          .filter((m) => !m.items && m.items_url)
          .map(async (m) => {
            m.items = await api(`${m.items_url}${m.items_url.includes('?') ? '&' : '?'}include[]=content_details&per_page=100`, true).catch(() => []);
          }),
      );
    } catch (e) {
      return showError(view, 'classwork', `/courses/${id}/modules?gcx-original=1`, e);
    }
    const c = await cPromise;
    view.style.setProperty('--c', c.color);

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
        rows.push({ kind: it.type, title: it.title, url: it.html_url || it.external_url || '#', indent: it.indent || 0, a, details: it.content_details });
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
    const hasFiles = [...document.querySelectorAll('#section-tabs a')].some((a) => /\/files\/?$/.test(a.getAttribute('href') || ''));
    if (hasFiles) topics.push({ name: 'All course files', rows: [], files: true });

    const missing = assigns.filter((a) => a.submission && a.submission.missing).length;
    const weekEnd = weekStart(1);
    const dueThisWeek = assigns.filter((a) => {
      const s = a.submission || {};
      const d = a.due_at && new Date(a.due_at);
      return d && d >= new Date() && d < weekEnd && !s.submitted_at && !s.excused;
    }).length;

    view.innerHTML = `
      <div class="gcx-cw-head">
        <a class="gcx-chip" href="/courses/${id}/grades">${svg('grade', 20)}${c.score != null ? `Grade · ${esc(c.letter ? c.letter + ' · ' : '')}${esc(+c.score.toFixed(2))}%` : 'Grades'}</a>
        ${missing ? `<span class="gcx-chip warn">${missing} missing</span>` : ''}
        ${dueThisWeek ? `<span class="gcx-chip">${dueThisWeek} due this week</span>` : ''}
        <label class="gcx-filter">${svg('search', 18)}<input type="text" placeholder="Filter classwork" aria-label="Filter classwork"></label>
      </div>
      <div class="gcx-cw">
        <nav class="gcx-toc" aria-label="Topics">${topics.map((t, i) => `<a href="#gcx-t${i}">${esc(t.name)}</a>`).join('')}</nav>
        <div class="gcx-topics">${
          topics.length
            ? topics
                .map(
                  (t, i) => `<section class="gcx-topic${t.files ? ' closed' : ''}" id="gcx-t${i}">
            <button class="gcx-topic-h" type="button"><h2>${esc(t.name)}</h2>${t.tag ? `<span class="gcx-topic-tag">${esc(t.tag)}</span>` : ''}<span class="gcx-count">${
              t.files ? '' : t.rows.filter((r) => !r.header).length || ''
            }</span>${svg('chevron')}</button>
            <div class="gcx-topic-rows">${
              t.files
                ? '<div class="gcx-topic-more gcx-files-slot">Loading files…</div>'
                : t.rows.map((r) => (r.header ? `<div class="gcx-row-sh">${esc(r.header)}</div>` : rowHtml(r))).join('') || '<div class="gcx-empty">Nothing here yet.</div>'
            }</div></section>`,
                )
                .join('')
            : '<div class="gcx-card gcx-empty">This course has no modules or assignments yet.</div>'
        }</div>
      </div>`;

    view.querySelectorAll('.gcx-topic-h').forEach((h) =>
      h.addEventListener('click', () => {
        const sec = h.parentElement;
        sec.classList.toggle('closed');
        const slot = sec.querySelector('.gcx-files-slot');
        if (slot && !sec.classList.contains('closed') && !slot.dataset.loaded) loadFiles(slot);
      }),
    );
    async function loadFiles(slot) {
      slot.dataset.loaded = '1';
      try {
        const files = await api(`/courses/${id}/files?per_page=100&sort=updated_at&order=desc`, true);
        const rows = files.map((f) => ({
          kind: 'File',
          title: f.display_name,
          url: `/courses/${id}/files/${f.id}`,
          details: { locked_for_user: f.locked_for_user },
        }));
        const wrap = slot.parentElement;
        wrap.innerHTML = rows.length ? rows.map(rowHtml).join('') : '<div class="gcx-empty">No files.</div>';
        wrap.querySelectorAll('.gcx-row').forEach((r, i) => {
          r.querySelector('.gcx-row-meta').textContent = shortDate(new Date(files[i].updated_at));
        });
      } catch (e) {
        slot.innerHTML = `Files aren't available here. <a href="/courses/${id}/files" style="color:var(--gcx-link)">Open the Files page</a>`;
      }
    }

    // Filter rows by title; topics with nothing left disappear.
    const filter = view.querySelector('.gcx-filter input');
    filter.addEventListener('input', () => {
      const q = filter.value.trim().toLowerCase();
      view.querySelectorAll('.gcx-topic').forEach((sec, i) => {
        let any = !q;
        sec.querySelectorAll('.gcx-row').forEach((r) => {
          const hit = !q || (r.dataset.q || '').includes(q);
          r.style.display = hit ? '' : 'none';
          any = any || hit;
        });
        sec.querySelectorAll('.gcx-row-sh').forEach((s) => (s.style.display = q ? 'none' : ''));
        if (q) sec.classList.remove('closed');
        sec.style.display = any ? '' : 'none';
        const tocLink = view.querySelector(`.gcx-toc a[href="#gcx-t${i}"]`);
        if (tocLink) tocLink.style.display = any ? '' : 'none';
      });
    });

    // Highlight the topic in view.
    const tocLinks = [...view.querySelectorAll('.gcx-toc a')];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          tocLinks.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
        }
      },
      { rootMargin: '-90px 0px -70% 0px' },
    );
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

  // ----- To-do: every course's work in Assigned / Missing / Done
  async function renderTodo(view) {
    const params = new URLSearchParams(location.search);
    let tab = ['assigned', 'missing', 'done'].includes(params.get('tab')) ? params.get('tab') : 'assigned';
    let courseFilter = params.get('course') || '';
    view.innerHTML = `
      <div class="gcx-todo-head"><h1>To-do</h1><select class="gcx-select" aria-label="Class"><option value="">All classes</option></select></div>
      <div class="gcx-seg" role="tablist">
        <button type="button" data-tab="assigned">Assigned<span class="gcx-n"></span></button>
        <button type="button" data-tab="missing">Missing<span class="gcx-n"></span></button>
        <button type="button" data-tab="done">Done<span class="gcx-n"></span></button>
      </div>
      <div class="gcx-todo-body"><div class="gcx-card">${skeleton(6)}</div></div>`;
    document.title = 'To-do';

    const courses = await coursesReady;
    const colorOf = new Map(courses.map((c) => [c.id, c.color]));
    const nameOf = new Map(courses.map((c) => [c.id, prettyName(c)]));
    const select = view.querySelector('select');
    select.insertAdjacentHTML('beforeend', courses.map((c) => `<option value="${c.id}">${esc(prettyName(c))}</option>`).join(''));
    select.value = courseFilter;

    let items;
    try {
      const [dated, undated] = await Promise.all([
        planner(-120, 120),
        Promise.all(
          courses.map((c) =>
            api(`/courses/${c.id}/assignments?bucket=undated&include[]=submission&per_page=50`)
              // Undated tools, polls and grade placeholders aren't work; keep things you can hand in.
              .then((list) =>
                list
                  .filter((a) => (a.submission_types || []).some((t) => /^online_|^discussion_topic$/.test(t)))
                  .map((a) => normAssignment(a, c)),
              )
              .catch(() => []),
          ),
        ).then((x) => x.flat()),
      ]);
      const seen = new Set();
      items = [...dated, ...undated].filter((i) => !seen.has(i.key) && seen.add(i.key));
    } catch (e) {
      return showError(view.querySelector('.gcx-todo-body'), 'your to-do list', '/', e);
    }

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
        ['This week', (i) => i.due >= thisWeek],
        ['Last week', (i) => i.due >= lastWeek && i.due < thisWeek],
        ['Earlier', (i) => i.due < lastWeek],
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
      if (tab === 'missing') return { text: `Due ${shortDate(i.due)}`, cls: 'missing' };
      if (tab === 'done') return { text: i.graded ? 'Graded' : i.submitted ? (i.late ? 'Turned in late' : 'Turned in') : 'Done', cls: i.graded ? 'graded' : '' };
      if (!i.due) return { text: '', cls: '' };
      return { text: dueText(i.due), cls: dayDiff(i.due) <= 1 ? 'soon' : '' };
    };

    const draw = () => {
      const pool = items.filter((i) => !courseFilter || String(i.courseId) === courseFilter);
      view.querySelectorAll('.gcx-seg button').forEach((b) => {
        b.classList.toggle('on', b.dataset.tab === tab);
        b.querySelector('.gcx-n').textContent = pool.filter(inTab[b.dataset.tab]).length || '';
      });
      const list = pool.filter(inTab[tab]);
      const order = tab === 'assigned' ? 1 : -1;
      list.sort((a, b) => order * ((a.due ? +a.due : order * Infinity) - (b.due ? +b.due : order * Infinity)));
      const groups = bucketsFor[tab].map(([label, fn]) => [label, list.filter(fn)]).filter(([, l]) => l.length);
      const body = view.querySelector('.gcx-todo-body');
      if (!groups.length) {
        body.innerHTML = `<div class="gcx-card gcx-empty">${
          tab === 'missing' ? 'Nothing missing. Nice.' : tab === 'done' ? 'Nothing turned in yet.' : 'No work assigned right now.'
        }</div>`;
        return;
      }
      body.innerHTML = groups
        .map(
          ([label, l], gi) => `<section class="gcx-card gcx-grp${tab === 'done' && gi > 1 ? ' closed' : ''}">
          <button class="gcx-grp-h" type="button">${esc(label)}<span class="gcx-count">${l.length}</span>${svg('chevron')}</button>
          <div class="gcx-grp-rows">${l
            .map((i) => {
              const m = meta(i);
              return `<a class="gcx-row${i.done ? ' done' : ''}" href="${esc(i.url)}" style="--c:${esc(colorOf.get(i.courseId) || '#5f6368')}">
                <span class="gcx-row-ic">${svg(TYPE_ICON[i.type] || 'assignment', 20)}</span>
                <span class="gcx-row-main"><span class="gcx-row-title">${esc(i.title)}</span><span class="gcx-row-sub">${esc(nameOf.get(i.courseId) || i.courseName || 'Personal to-do')}</span></span>
                <span class="gcx-row-meta ${m.cls}">${esc(m.text)}</span></a>`;
            })
            .join('')}</div></section>`,
        )
        .join('');
      body.querySelectorAll('.gcx-grp-h').forEach((h) => h.addEventListener('click', () => h.parentElement.classList.toggle('closed')));
    };
    const syncUrl = () => {
      const p = new URLSearchParams({ gcx: 'todo' });
      if (tab !== 'assigned') p.set('tab', tab);
      if (courseFilter) p.set('course', courseFilter);
      history.replaceState(null, '', '/?' + p);
    };
    view.querySelector('.gcx-seg').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      tab = b.dataset.tab;
      syncUrl();
      draw();
    });
    select.addEventListener('change', () => {
      courseFilter = select.value;
      syncUrl();
      draw();
    });
    draw();
  }

  // ---------------------------------------------------------------- dashboard
  let dashPlanner = null;
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
        el(`<a class="gcx-card-ov" href="/courses/${id}"><div class="gcx-card-title">${esc(prettyName({ name: fallbackTitle }))}</div><div class="gcx-card-sub"></div><div class="gcx-card-teacher"></div></a>`),
      );
      card.append(
        el(`<div class="gcx-card-body" data-course="${id}"><div class="gcx-card-due-wrap">${skeleton(2)}</div><div class="gcx-card-foot"><span></span></div></div>`),
      );
      fillCard(card, id);
    }
  }
  async function fillCard(card, id) {
    const c = (await coursesReady).find((x) => x.id === id) || (await courseById(id));
    const ov = card.querySelector('.gcx-card-ov');
    const body = card.querySelector('.gcx-card-body');
    if (!ov || !body) return;
    body.style.setProperty('--c', c.color);
    if (c.name) ov.querySelector('.gcx-card-title').textContent = prettyName(c);
    ov.querySelector('.gcx-card-sub').textContent = c.code || '';
    ov.querySelector('.gcx-card-teacher').textContent = teacherLine(c);
    const foot = body.querySelector('.gcx-card-foot');
    if (c.teachers.length && !foot.querySelector('.gcx-iconbtn')) {
      const who = c.teachers.length <= 2 ? c.teachers[0].name : 'the instructors';
      foot.append(el(`<a class="gcx-iconbtn" href="${esc(emailHref(c))}" title="Email ${esc(who)}" aria-label="Email ${esc(who)}">${svg('mail', 22)}</a>`));
    }
    try {
      const items = (await dashPlanner).filter((i) => i.courseId === id);
      const soon = dueSoon(items);
      const wrap = body.querySelector('.gcx-card-due-wrap');
      wrap.innerHTML = soon.length
        ? `<div class="gcx-due">${dueGroupsHtml(soon, 4, () => c.color)}</div>`
        : `<div class="gcx-due-none">Nothing due in the next two weeks.</div>`;
      if (soon.length > 4) foot.firstElementChild.outerHTML = `<a class="gcx-more-link" href="/?gcx=todo&course=${id}">${soon.length - 4} more</a>`;
    } catch (e) {
      body.querySelector('.gcx-card-due-wrap').innerHTML = `<div class="gcx-due-none">Couldn't load assignments.</div>`;
    }
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
      st.textContent = '[data-gcx-hide]{display:none !important}';
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
  function applyBcTodo(sr) {
    const list = sr.getElementById('bettercanvas-todo-list');
    if (!list) return;
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
    const horizon = startOfDay(Date.now() + (HORIZON_DAYS + 1) * DAY);
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

  // ---------------------------------------------------------------- boot
  if (COURSE_ID) {
    const cPromise = renderCourseBar();
    if (VIEW === 'home' || VIEW === 'classwork') {
      const view = mountView();
      if (view) (VIEW === 'home' ? renderHome : renderClasswork)(view, cPromise);
    }
  } else if (VIEW === 'todo') {
    const view = mountView();
    if (view) renderTodo(view);
  }

  if (html.classList.contains('gcx-dash')) {
    dashPlanner = planner(-HORIZON_DAYS, HORIZON_DAYS).catch((e) => {
      console.warn('[canvas-classroom] planner', e);
      return [];
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
