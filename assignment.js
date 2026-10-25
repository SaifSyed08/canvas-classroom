// Assignment pages (/courses/:cid/assignments/:aid), laid out like Google Classroom: the
// assignment on the left (icon, title, teacher and dates, points and due date, instructions,
// attachments) and a "Your work" card on the right (status, what he turned in, private
// comments, one button into Canvas's own submission flow).
//
// Canvas renders this page with its React "Assignments 2" view. Its nodes aren't moved or
// rebuilt (that would break its event handling); our layout goes above it, and only the
// pieces we reproduce (its header and its Details section) are hidden. Its attempt row,
// rubric, submission tabs and sticky Submit footer stay as they are. Anything unexpected and
// the page is left alone. `?gcx-original=1` shows the stock page.
(() => {
  'use strict';
  const gcx = window.gcx;
  if (!gcx || window.top !== window) return;
  const html = document.documentElement;
  const m = location.pathname.match(/^\/courses\/(\d+)\/assignments\/(\d+)\/?$/);
  if (!m || new URLSearchParams(location.search).has('gcx-original')) return;
  const [, cid, aid] = m;
  const { api, esc, el } = gcx;

  const ICON = {
    assignment: 'M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z',
    quiz: 'M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z',
    discussion: 'M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z',
    tool: 'M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z',
    file: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
    comment: 'M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z',
    open: 'M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z',
    link: 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z',
  };
  const svg = (name, size = 20) => `<svg class="gcx-svg" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="${ICON[name]}"/></svg>`;

  const fmtDue = (d) =>
    d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const fmtDay = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
  const fmtNum = (n) => (Number.isInteger(n) ? String(n) : String(+Number(n).toFixed(2)));

  // Instructions come from Canvas (sanitized server-side); still drop anything active.
  function cleanHtml(markup) {
    const doc = new DOMParser().parseFromString(markup || '', 'text/html');
    doc.querySelectorAll('script, style, link, meta, form, object, embed, base').forEach((n) => n.remove());
    doc.querySelectorAll('*').forEach((n) => {
      for (const a of [...n.attributes]) {
        if (/^on/i.test(a.name)) n.removeAttribute(a.name);
        else if (/^(href|src|action|formaction)$/i.test(a.name) && /^\s*javascript:/i.test(a.value)) n.removeAttribute(a.name);
      }
    });
    // Files linked from the instructions open in the in-page viewer (fileview.js) whatever shape
    // their link has: ?wrap=1, /download?verifier=…, download_frd=1, the Files app's ?preview=,
    // or an RCE link known only by its data-api-endpoint. Tagging them here means the viewer
    // doesn't have to guess from the href.
    doc.querySelectorAll('a[href]').forEach((a) => {
      const f = !a.hasAttribute('download') && gcx.fileLink ? gcx.fileLink(a) : null;
      if (f) {
        a.dataset.gcxFile = f.fid;
        // A user's or group's file has no course; the viewer then looks it up without one.
        if (f.cid) a.dataset.gcxCourse = f.cid;
        if (f.verifier) a.dataset.gcxVerifier = f.verifier;
      } else if (!/\/files\/\d+/.test(a.getAttribute('href'))) a.setAttribute('target', '_blank');
    });
    return doc.body;
  }

  // Course files linked from the instructions, shown again as chips (Classroom's attachments).
  function attachmentsFrom(body) {
    const seen = new Set();
    const out = [];
    for (const a of body.querySelectorAll('a[data-gcx-file]')) {
      const id = a.dataset.gcxFile;
      if (seen.has(id)) continue;
      seen.add(id);
      const course = a.dataset.gcxCourse || '';
      const verifier = a.dataset.gcxVerifier || '';
      const name = (a.getAttribute('title') || a.textContent || '').replace(/\s+/g, ' ').trim() || 'File';
      const href = `${course ? `/courses/${course}` : ''}/files/${id}${verifier ? `?verifier=${encodeURIComponent(verifier)}` : ''}`;
      out.push({ id, course, verifier, name, href });
    }
    return out;
  }

  // ---------------------------------------------------------------- status of his work
  function workState(a, s) {
    const types = a.submission_types || [];
    const online = types.some((t) => /^online_(upload|text_entry|url|media_recording)$|^student_annotation$/.test(t));
    const due = a.due_at ? new Date(a.due_at) : null;
    const pts = a.points_possible;
    if (s.excused) return { label: 'Excused', cls: 'muted', online };
    if (s.workflow_state === 'graded' && s.score != null)
      return { label: pts ? `${fmtNum(s.score)}/${fmtNum(pts)}` : `${fmtNum(s.score)} pts`, cls: 'graded', graded: true, online };
    if (s.missing) return { label: 'Missing', cls: 'missing', online };
    if (s.submitted_at) return { label: s.late ? 'Turned in late' : 'Turned in', cls: s.late ? 'late' : 'done', online };
    if (due && due < new Date() && online) return { label: 'Past due', cls: 'missing', online };
    return { label: online || types.includes('external_tool') || types.includes('online_quiz') ? 'Assigned' : 'No online turn-in', cls: online ? 'assigned' : 'muted', online };
  }

  // ---------------------------------------------------------------- Canvas's own pieces
  const q = (id) => document.querySelector(`[data-testid="${id}"]`);
  // Bring Canvas's submission area into view and point at it.
  function goToSubmission() {
    const target =
      q('assignment-2-student-content-tabs') ||
      document.querySelector('#assignment_external_tools iframe')?.closest('div') ||
      q('student-content-flex-container') ||
      q('student-footer');
    if (!target) return;
    target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    target.classList.remove('gcx-asg-pulse');
    void target.offsetWidth;
    target.classList.add('gcx-asg-pulse');
  }

  // ---------------------------------------------------------------- render
  const content = document.getElementById('content');
  if (!content) return;
  const view = el(`<section id="gcx-asg" aria-busy="true">
    <div class="gcx-asg-main">
      <div class="gcx-asg-head"><span class="gcx-asg-ic">${svg('assignment', 24)}</span>
        <div class="gcx-asg-titles"><h1 class="gcx-asg-title"><span class="gcx-skel w60"></span></h1><div class="gcx-asg-by"><span class="gcx-skel w40"></span></div></div></div>
      <div class="gcx-asg-facts"><span class="gcx-asg-pts"></span><span class="gcx-asg-due"></span></div>
      <div class="gcx-asg-body"><div class="gcx-skel w80"></div><div class="gcx-skel w60"></div><div class="gcx-skel w80"></div></div>
      <div class="gcx-asg-files"></div>
    </div>
    <aside class="gcx-asg-side">
      <div class="gcx-asg-work">
        <div class="gcx-asg-work-h"><h2>Your work</h2><span class="gcx-asg-status"></span></div>
        <div class="gcx-asg-work-body"><div class="gcx-skel w80"></div></div>
      </div>
      <div class="gcx-asg-comments">
        <div class="gcx-asg-work-h"><h2>${svg('comment', 18)}Private comments</h2></div>
        <div class="gcx-asg-comments-body"></div>
      </div>
      <a class="gcx-asg-original" href="?gcx-original=1">View in Canvas</a>
    </aside>
  </section>`);
  content.prepend(view);
  html.classList.add('gcx-asg');
  // The course bar already knows the course color (from cache); use it until the data arrives.
  const barColor = document.getElementById('gcx-cbar')?.style.getPropertyValue('--c');
  if (barColor) view.style.setProperty('--c', barColor);

  const giveUp = () => {
    view.remove();
    html.classList.remove('gcx-asg');
  };
  // The classic (pre-"Assignments 2") page is already rendered by now: leave it as is.
  if (document.querySelector('#assignment_show, .student-assignment-overview, #submit_assignment')) {
    giveUp();
    return;
  }
  // Not the Assignments 2 view after all (or it never showed): leave Canvas's page alone.
  const check = setInterval(() => {
    if (q('assignments-2-student-view')) {
      clearInterval(check);
      clearTimeout(bail);
    }
  }, 150);
  const bail = setTimeout(() => {
    clearInterval(check);
    if (!q('assignments-2-student-view')) giveUp();
  }, 12000);

  Promise.all([
    api(`/courses/${cid}/assignments/${aid}?include[]=submission`),
    api(`/courses/${cid}/assignments/${aid}/submissions/self?include[]=submission_comments`).catch(() => null),
    gcx.coursesReady.catch(() => []),
  ])
    .then(([a, sub, courses]) => fill(a, sub || a.submission || {}, (courses || []).find((c) => String(c.id) === cid)))
    .catch((e) => {
      console.warn('[canvas-classroom] assignment page', e);
      giveUp();
    });

  function fill(a, s, c) {
    if (c && c.color) view.style.setProperty('--c', c.color);
    const types = a.submission_types || [];
    const kind = a.quiz_id || types.includes('online_quiz') ? 'quiz' : a.discussion_topic || types.includes('discussion_topic') ? 'discussion' : types.includes('external_tool') ? 'tool' : 'assignment';
    view.querySelector('.gcx-asg-ic').innerHTML = svg(kind, 24);
    view.querySelector('.gcx-asg-title').textContent = a.name;
    document.title = a.name;

    // "Goheun Kim · Oct 3 (Edited Oct 5)"
    const teacher = c && c.teachers && c.teachers.length ? c.teachers[0].name : '';
    const posted = a.created_at ? new Date(a.created_at) : null;
    const edited = a.updated_at ? new Date(a.updated_at) : null;
    const when = posted
      ? `${fmtDay(posted)}${edited && edited - posted > 36e5 && fmtDay(edited) !== fmtDay(posted) ? ` (Edited ${fmtDay(edited)})` : ''}`
      : '';
    view.querySelector('.gcx-asg-by').textContent = [teacher, when].filter(Boolean).join(' · ');

    view.querySelector('.gcx-asg-pts').textContent = a.points_possible ? `${fmtNum(a.points_possible)} point${a.points_possible === 1 ? '' : 's'}` : 'Ungraded';
    const due = a.due_at ? new Date(a.due_at) : null;
    const dueEl = view.querySelector('.gcx-asg-due');
    dueEl.textContent = due ? `Due ${fmtDue(due)}` : 'No due date';
    if (a.lock_at && new Date(a.lock_at) > new Date()) dueEl.title = `Available until ${fmtDue(new Date(a.lock_at))}`;

    // Instructions + attachment chips
    const bodyEl = view.querySelector('.gcx-asg-body');
    const lockNote =
      a.locked_for_user && a.lock_explanation
        ? `<p class="gcx-asg-locked">${esc(new DOMParser().parseFromString(a.lock_explanation, 'text/html').body.textContent.trim())}</p>`
        : '';
    if (a.description && a.description.trim()) {
      const body = cleanHtml(a.description);
      bodyEl.replaceChildren(...body.childNodes);
      if (gcx.fixInlineColors) gcx.fixInlineColors(bodyEl);
      // Inline images that don't load (Canvas's own little download icons, expired links) go,
      // instead of leaving a broken-image box in the text.
      bodyEl.querySelectorAll('img').forEach((img) => img.addEventListener('error', () => img.remove(), { once: true }));
      if (lockNote) bodyEl.prepend(el(lockNote));
      const files = attachmentsFrom(bodyEl);
      if (files.length)
        view.querySelector('.gcx-asg-files').innerHTML = files
          .map(
            (f) => `<a class="gcx-asg-chip" href="${esc(f.href)}" data-gcx-file="${esc(f.id)}" data-gcx-course="${esc(f.course)}"${
              f.verifier ? ` data-gcx-verifier="${esc(f.verifier)}"` : ''
            } data-gcx-name="${esc(f.name)}" title="${esc(f.name)}">
              <span class="gcx-asg-chip-ic">${svg('file', 22)}</span><span class="gcx-asg-chip-tx"><b>${esc(f.name)}</b><small>File</small></span></a>`,
          )
          .join('');
    } else bodyEl.innerHTML = lockNote || '<p class="gcx-asg-empty">No instructions.</p>';

    // Your work
    const st = workState(a, s);
    const status = view.querySelector('.gcx-asg-status');
    status.textContent = st.label;
    status.className = `gcx-asg-status ${st.cls}`;
    const work = view.querySelector('.gcx-asg-work-body');
    const parts = [];
    if (st.graded && s.grade && String(s.grade) !== String(s.score)) parts.push(`<div class="gcx-asg-grade">Grade: ${esc(s.grade)}</div>`);
    if (s.submitted_at) {
      parts.push(`<div class="gcx-asg-when">Turned in ${esc(fmtDue(new Date(s.submitted_at)))}${s.attempt > 1 ? ` · attempt ${esc(s.attempt)}` : ''}</div>`);
      for (const f of s.attachments || [])
        parts.push(`<a class="gcx-asg-chip small" href="${esc(f.url || f.preview_url || '#')}" data-gcx-file="${esc(f.id)}" data-gcx-name="${esc(f.display_name)}" title="${esc(f.display_name)}">
          <span class="gcx-asg-chip-ic">${svg('file', 18)}</span><span class="gcx-asg-chip-tx"><b>${esc(f.display_name)}</b></span></a>`);
      if (s.url) parts.push(`<a class="gcx-asg-chip small" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer"><span class="gcx-asg-chip-ic">${svg('link', 18)}</span><span class="gcx-asg-chip-tx"><b>${esc(s.url)}</b></span></a>`);
      if (s.body && !(s.attachments || []).length)
        parts.push(`<div class="gcx-asg-text">${esc(new DOMParser().parseFromString(s.body, 'text/html').body.textContent.trim().slice(0, 280))}</div>`);
    } else if (due && due > new Date() && !st.graded && !s.excused) {
      const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const days = Math.round((midnight(due) - midnight(new Date())) / 864e5);
      parts.push(`<div class="gcx-asg-when">${days <= 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `Due in ${days} days`}</div>`);
    }

    // One button into Canvas's own flow, worded for where he is.
    let btn = '';
    if (kind === 'quiz' && a.quiz_id) btn = `<a class="gcx-asg-btn" href="/courses/${esc(cid)}/quizzes/${esc(a.quiz_id)}">${s.submitted_at ? 'View quiz' : 'Open quiz'}</a>`;
    else if (kind === 'discussion' && a.discussion_topic && a.discussion_topic.html_url) btn = `<a class="gcx-asg-btn" href="${esc(a.discussion_topic.html_url)}">Open discussion</a>`;
    else if (kind === 'tool') btn = `<button type="button" class="gcx-asg-btn" data-go>Open ${esc(a.name)}</button>`;
    else if (st.online && !a.locked_for_user) {
      // Graded work points at what he turned in; otherwise offer another attempt if there is one.
      const again = s.submitted_at && !st.graded && (a.allowed_attempts == null || a.allowed_attempts < 0 || (s.attempt || 0) < a.allowed_attempts);
      btn = `<button type="button" class="gcx-asg-btn" data-go>${s.submitted_at ? (again ? 'Submit again' : 'View submission') : 'Add or create'}</button>`;
    } else if (!st.online && kind === 'assignment') parts.push('<div class="gcx-asg-note">Nothing to turn in online for this one.</div>');
    work.innerHTML = parts.join('') + btn;
    work.querySelector('[data-go]')?.addEventListener('click', goToSubmission);

    // Private comments (oldest first, like Classroom), and a way into Canvas's comment tray.
    const comments = (s.submission_comments || []).slice().sort((x, y) => Date.parse(x.created_at) - Date.parse(y.created_at));
    const cbox = view.querySelector('.gcx-asg-comments-body');
    cbox.innerHTML =
      comments
        .map(
          (k) => `<div class="gcx-asg-cmt"><div class="gcx-asg-cmt-h"><b>${esc(k.author_name || (k.author && k.author.display_name) || 'Someone')}</b><span>${esc(fmtDay(new Date(k.created_at)))}</span></div>
            <div class="gcx-asg-cmt-tx">${esc(k.comment || '')}</div></div>`,
        )
        .join('') + `<button type="button" class="gcx-asg-link" data-comment>${comments.length ? 'Reply' : 'Add a private comment'}</button>`;
    cbox.querySelector('[data-comment]').addEventListener('click', () => {
      const b = q('view_feedback_button');
      if (b) b.click();
      else goToSubmission();
    });

    view.removeAttribute('aria-busy');
    view.classList.add('ready');
  }
})();
