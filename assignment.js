// Assignment pages (/courses/:cid/assignments/:aid), laid out like Google Classroom: the
// assignment on the left (icon, title, teacher and dates, points and attempt rules, due date,
// instructions, attachments) and on the right a "Your work" card (status, the attempt he's
// looking at, adding work and turning it in) and a Private comments card (the thread, and a box
// to post to it).
//
// Canvas renders this page with its React "Assignments 2" view. Its nodes aren't moved or
// rebuilt (that would break its event handling); our layout goes above it, and only the
// pieces we reproduce are hidden. When we can turn in every kind of work the assignment takes
// (text, link, files), Canvas's own submission block is hidden too, all but its sticky
// Previous/Next footer; it comes back for anything else (media, annotation, Drive and other
// upload sources) and for the rubric. Anything unexpected and the page is left alone.
// `?gcx-original=1` shows the stock page.
(() => {
  'use strict';
  const gcx = window.gcx;
  if (!gcx || window.top !== window) return;
  const html = document.documentElement;
  const m = location.pathname.match(/^\/courses\/(\d+)\/assignments\/(\d+)\/?$/);
  const qs = new URLSearchParams(location.search);
  // Peer reviews open on this same URL with the classmate in the query: that page is about their
  // work, not his, so it stays Canvas's own.
  if (!m || qs.has('gcx-original') || qs.has('reviewee_id') || qs.has('anonymous_asset_id')) return;
  const [, cid, aid] = m;
  const { api, esc, el } = gcx;

  const ICON = {
    chevron: 'M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z',
    assignment: 'M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z',
    quiz: 'M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z',
    discussion: 'M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z',
    tool: 'M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z',
    file: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
    comment: 'M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z',
    open: 'M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z',
    link: 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z',
    add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
    upload: 'M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z',
    text: 'M14 17H4v2h10v-2zm6-8H4v2h16V9zM4 15h16v-2H4v2zM4 5v2h16V5H4z',
    close: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
    send: 'M2.01 21 23 12 2.01 3 2 10l15 2-15 2z',
    mic: 'M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z',
    annotate: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
    more: 'M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
  };
  const svg = (name, size = 20) => `<svg class="gcx-svg" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="${ICON[name]}"/></svg>`;

  const fmtDue = (d) =>
    d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const fmtDay = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
  const fmtUntil = (d) =>
    d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
  const fmtNum = (n) => (Number.isInteger(n) ? String(n) : String(+Number(n).toFixed(2)));
  const fmtSize = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : b >= 1024 ? `${Math.round(b / 1024)} KB` : `${b} B`);
  const plainText = (markup) => new DOMParser().parseFromString(markup || '', 'text/html').body.textContent.trim();
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

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
      const f = gcx.fileLink ? gcx.fileLink(a) : null;
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
  const pulse = (target) => {
    if (!target) return;
    target.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
    target.classList.remove('gcx-asg-pulse');
    void target.offsetWidth;
    target.classList.add('gcx-asg-pulse');
  };
  // Bring Canvas's submission area into view and point at it.
  function goToSubmission() {
    pulse(
      q('assignment-2-student-content-tabs') ||
        document.querySelector('#assignment_external_tools iframe')?.closest('div') ||
        q('student-content-flex-container') ||
        q('student-footer'),
    );
  }

  // A value from Canvas's inline ENV script (content scripts can't read the page's window.ENV).
  function pageEnv(key) {
    for (const sc of document.scripts) {
      if (sc.src) continue;
      const t = sc.textContent;
      const i = t.indexOf(`"${key}":`);
      if (i < 0) continue;
      let j = i + key.length + 3;
      while (t[j] === ' ') j++;
      if (t[j] !== '{') return null;
      let depth = 0;
      let str = false;
      for (let k = j; k < t.length; k++) {
        const ch = t[k];
        if (str) {
          if (ch === '\\') k++;
          else if (ch === '"') str = false;
        } else if (ch === '"') str = true;
        else if (ch === '{') depth++;
        else if (ch === '}' && --depth === 0) {
          try {
            return JSON.parse(t.slice(j, k + 1));
          } catch {
            return null;
          }
        }
      }
    }
    return null;
  }

  // ---------------------------------------------------------------- writes (his own work only)
  // Canvas checks X-CSRF-Token against the _csrf_token cookie on anything that changes data.
  const csrf = () => {
    const c = document.cookie.match(/(?:^|;\s*)_csrf_token=([^;]*)/);
    return c ? decodeURIComponent(c[1]) : '';
  };
  const parseJson = (t) => {
    try {
      return JSON.parse(String(t || '').replace(/^while\(1\);/, ''));
    } catch {
      return null;
    }
  };
  // Canvas's error bodies come in several shapes: {errors:[{message}]}, {errors:{field:[…]}},
  // {message}, {error}.
  function errText(d, status) {
    const e = d && (d.errors || d.message || d.error);
    let msg = '';
    if (typeof e === 'string') msg = e;
    else if (Array.isArray(e)) msg = e.map((x) => (x && (x.message || x)) || '').join(' ');
    else if (e && typeof e === 'object')
      msg = Object.values(e)
        .flat()
        .map((x) => (x && (x.message || x.type || (typeof x === 'string' ? x : ''))) || '')
        .join(' ');
    msg = String(msg).trim();
    if (msg) return msg.slice(0, 160);
    if (status === 401 || status === 403) return 'Canvas said no (are you still signed in?)';
    return status ? `Canvas error ${status}` : 'network error';
  }
  async function send(method, path, params) {
    let r;
    try {
      r = await fetch(location.origin + '/api/v1' + path, {
        method,
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-CSRF-Token': csrf(),
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: params.toString(),
      });
    } catch {
      throw new Error('network error');
    }
    const data = parseJson(await r.text());
    if (!r.ok) throw Object.assign(new Error(errText(data, r.status)), { status: r.status });
    return data;
  }
  // XHR (not fetch) so the upload can report progress.
  function xhrPost(url, body, onProgress) {
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open('POST', url);
      x.setRequestHeader('Accept', 'application/json');
      // His Canvas session only goes to Canvas; the file store trusts the signed upload_params.
      if (new URL(url, location.href).origin === location.origin) x.setRequestHeader('X-CSRF-Token', csrf());
      x.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
      x.onload = () => {
        let loc = null;
        try {
          loc = x.getResponseHeader('Location');
        } catch {}
        resolve({ status: x.status, text: x.responseText, location: loc });
      };
      x.onerror = () => reject(new Error('upload failed (network)'));
      x.send(body);
    });
  }
  // Canvas's file upload: ask Canvas for an upload slot, send the bytes to the file store, then
  // find out the new file's id (local storage answers with the file itself, inst-fs with where
  // it lives, S3 needs Canvas told the upload finished).
  async function uploadFile(file, onProgress) {
    const p = new URLSearchParams({ name: file.name, size: String(file.size) });
    if (file.type) p.set('content_type', file.type);
    const pre = await send('POST', `/courses/${cid}/assignments/${aid}/submissions/self/files`, p);
    if (!pre || !pre.upload_url) throw new Error(errText(pre) || "Canvas didn't give an upload address");
    const fd = new FormData();
    for (const [k, v] of Object.entries(pre.upload_params || {})) fd.append(k, v);
    fd.append(pre.file_param || 'file', file, file.name);
    const up = await xhrPost(pre.upload_url, fd, onProgress);
    if (!up.status || up.status >= 400) throw new Error(`${file.name}: ${errText(parseJson(up.text), up.status)}`);
    const d = parseJson(up.text);
    if (d && d.id && d.display_name && !d.location) return d.id;
    if (pre.success_url) {
      const xml = new DOMParser().parseFromString(up.text || '', 'application/xml');
      const tag = (n) => (xml.getElementsByTagName(n)[0] || {}).textContent || '';
      const u = new URL(pre.success_url, location.href);
      if (tag('Bucket')) u.searchParams.set('bucket', tag('Bucket'));
      if (tag('Key')) u.searchParams.set('key', tag('Key'));
      if (tag('ETag')) u.searchParams.set('etag', tag('ETag'));
      const f = await api(u.href);
      if (f && f.id) return f.id;
    }
    const loc = (d && d.location) || up.location;
    if (loc) {
      try {
        const f = await api(new URL(loc, location.href).href);
        if (f && f.id) return f.id;
      } catch {}
      const id = loc.match(/\/files\/(\d+)/);
      if (id) return id[1];
    }
    if (d && d.id) return d.id;
    throw new Error(`${file.name}: the upload didn't finish`);
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
      <div class="gcx-asg-links"><button type="button" class="gcx-asg-original gcx-asg-rubric" hidden>Rubric</button><a class="gcx-asg-original" href="?gcx-original=1">View in Canvas</a></div>
    </aside>
  </section>`);
  // early.js may have put a stand-in header in for the page transition (the row he clicked grows
  // into it); keep that element and drop the rest of the stand-in.
  const earlyAsg = document.getElementById('gcx-asg');
  if (earlyAsg && earlyAsg !== view) {
    const head = earlyAsg.querySelector('.gcx-asg-head');
    if (head) {
      head.replaceChildren(...view.querySelector('.gcx-asg-head').childNodes);
      view.querySelector('.gcx-asg-head').replaceWith(head);
    }
    earlyAsg.remove();
  }
  content.prepend(view);
  html.classList.add('gcx-asg');
  // The course bar already knows the course color (from cache); use it until the data arrives.
  const barColor = document.getElementById('gcx-cbar')?.style.getPropertyValue('--c');
  if (barColor) view.style.setProperty('--c', barColor);

  const giveUp = () => {
    view.remove();
    html.classList.remove('gcx-asg', 'gcx-asg-split', 'gcx-asg-own', 'gcx-asg-reveal', 'gcx-asg-cmts');
  };
  // The classic (pre-"Assignments 2") page is already rendered by now: leave it as is.
  if (document.querySelector('#assignment_show, .student-assignment-overview, #submit_assignment')) {
    giveUp();
    return;
  }
  // Not the Assignments 2 view after all (or it never showed): leave Canvas's page alone.
  // Canvas's submission area moves into the right column (assignment.css) once it's there: the
  // child of #content that holds it is marked, and the page switches to the two-column grid.
  const placeCanvas = () => {
    const sv = q('assignments-2-student-view');
    if (!sv) return false;
    let box = sv;
    while (box.parentElement && box.parentElement !== content) box = box.parentElement;
    if (box.parentElement !== content || box === view) return true;
    box.classList.add('gcx-asg-canvas');
    html.classList.add('gcx-asg-split');
    return true;
  };
  const check = setInterval(() => {
    if (placeCanvas()) {
      clearInterval(check);
      clearTimeout(bail);
    }
  }, 150);
  const bail = setTimeout(() => {
    clearInterval(check);
    if (!q('assignments-2-student-view')) giveUp();
  }, 12000);

  const SUB_PATH = `/courses/${cid}/assignments/${aid}/submissions/self`;
  const SUB_INCLUDE = '?include[]=submission_history&include[]=submission_comments&include[]=rubric_assessment';
  Promise.all([
    api(`/courses/${cid}/assignments/${aid}?include[]=submission`),
    api(SUB_PATH + SUB_INCLUDE).catch(() => null),
    gcx.coursesReady.catch(() => []),
  ])
    .then(([a, sub, courses]) => fill(a, sub || a.submission || {}, (courses || []).find((c) => String(c.id) === cid)))
    .catch((e) => {
      console.warn('[canvas-classroom] assignment page', e);
      giveUp();
    });

  // ---------------------------------------------------------------- Your work: state
  // What we can turn in ourselves, and what only Canvas's own block can do.
  const OURS = { online_upload: 'file', online_text_entry: 'text', online_url: 'url' };
  const ELSEWHERE = { media_recording: ['Record media in Canvas', 'mic'], student_annotation: ['Annotate in Canvas', 'annotate'] };
  const S = {
    a: null,
    s: {},
    kind: 'assignment',
    own: false, // our turn-in flow handles this assignment
    ours: [], // 'file' | 'text' | 'url', in the assignment's order
    elsewhere: [], // submission types only Canvas's block handles
    viewing: 0, // attempt number shown
    composing: false,
    draft: { type: '', text: '', url: '', files: [] }, // files: [{ file, id }]
    pledge: null, // Canvas's similarity pledge (ENV.SIMILARITY_PLEDGE), if the school has one
    pledged: false,
    busy: false,
    pending: [], // comments on their way
  };
  const DRAFT_KEY = `asgDraft:${location.host}:${gcx.user || 'anon'}:${aid}`;
  const saveDraft = () => {
    const { type, text, url } = S.draft;
    if (gcx.store) gcx.store.set(DRAFT_KEY, type === 'text' || type === 'url' ? { type, text, url } : null);
  };

  // Submitted attempts, oldest first.
  function history() {
    const h = (S.s.submission_history || []).filter((x) => x && x.submitted_at);
    if (!h.length && S.s.submitted_at) h.push(S.s);
    return h.sort((x, y) => (x.attempt || 0) - (y.attempt || 0));
  }
  const allowedAttempts = () => (S.a.allowed_attempts > 0 ? S.a.allowed_attempts + (S.s.extra_attempts || 0) : null);
  const usedAttempts = () => Math.max(S.s.attempt || 0, ...history().map((h) => h.attempt || 0), history().length);
  // Whether he can turn something in now, and if not, why (shown in the card).
  function openState() {
    const { a, s } = S;
    const now = new Date();
    if (s.excused) return { open: false, why: '' };
    if (a.unlock_at && new Date(a.unlock_at) > now) return { open: false, why: `Opens ${fmtDue(new Date(a.unlock_at))}` };
    if (a.lock_at && new Date(a.lock_at) <= now) return { open: false, why: `Closed ${fmtDue(new Date(a.lock_at))}` };
    if (a.locked_for_user) return { open: false, why: plainText(a.lock_explanation) || 'Locked' };
    const max = allowedAttempts();
    if (max != null && usedAttempts() >= max) return { open: false, why: '' };
    return { open: true, why: '' };
  }
  const validUrl = (u) => /^https?:\/\/[^\s/$.?#][^\s]*\.[^\s]+$/i.test(normUrl(u));
  const normUrl = (u) => {
    const t = String(u || '').trim();
    return t && !/^[a-z][a-z0-9+.-]*:/i.test(t) ? `https://${t}` : t;
  };
  const ready = () => {
    const d = S.draft;
    const has = d.type === 'text' ? !!d.text.trim() : d.type === 'url' ? validUrl(d.url) : d.type === 'file' ? d.files.length > 0 : false;
    return has && !S.busy && (!S.pledge || S.pledged);
  };
  const extsOf = () => (S.a.allowed_extensions || []).map((x) => String(x).toLowerCase().replace(/^\./, '')).filter(Boolean);

  // ---------------------------------------------------------------- fill
  function fill(a, s, c) {
    if (c && c.color) view.style.setProperty('--c', c.color);
    const types = a.submission_types || [];
    const kind = a.quiz_id || types.includes('online_quiz') ? 'quiz' : a.discussion_topic || types.includes('discussion_topic') ? 'discussion' : types.includes('external_tool') ? 'tool' : 'assignment';
    Object.assign(S, { a, s, kind });
    S.ours = types.map((t) => OURS[t]).filter(Boolean);
    S.elsewhere = types.filter((t) => ELSEWHERE[t]);
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

    // "100 points | Unlimited attempts until Nov 3, 11:59 PM" on the left, the due date on the right.
    const st0 = workState(a, s);
    const facts = [];
    if (a.points_possible) facts.push(`${fmtNum(a.points_possible)} point${a.points_possible === 1 ? '' : 's'}`);
    if (st0.online && kind === 'assignment') {
      const max = allowedAttempts();
      const rule = max == null ? 'Unlimited attempts' : `${max} attempt${max === 1 ? '' : 's'}`;
      facts.push(a.lock_at ? `${rule} until ${fmtUntil(new Date(a.lock_at))}` : rule);
    }
    if (!facts.length) facts.push(a.points_possible ? '' : 'Ungraded');
    view.querySelector('.gcx-asg-pts').innerHTML = facts
      .filter(Boolean)
      .map(esc)
      .join('<span class="gcx-asg-sep" aria-hidden="true"></span>');
    const due = a.due_at ? new Date(a.due_at) : null;
    const dueEl = view.querySelector('.gcx-asg-due');
    dueEl.textContent = due ? `Due ${fmtDue(due)}` : 'No due date';
    if (a.lock_at && new Date(a.lock_at) > new Date()) dueEl.title = `Available until ${fmtDue(new Date(a.lock_at))}`;

    // Instructions + attachment chips
    const bodyEl = view.querySelector('.gcx-asg-body');
    const lockNote = a.locked_for_user && a.lock_explanation ? `<p class="gcx-asg-locked">${esc(plainText(a.lock_explanation))}</p>` : '';
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
              <span class="gcx-asg-chip-ic">${gcx.fileTile ? gcx.fileTile(f.name, 30) : svg('file', 22)}</span><span class="gcx-asg-chip-tx"><b>${esc(f.name)}</b><small>File</small></span></a>`,
          )
          .join('');
    } else bodyEl.innerHTML = lockNote || '<p class="gcx-asg-empty">No instructions.</p>';

    // Our own turn-in flow covers this assignment: Canvas's block steps aside (its Previous/Next
    // footer stays). Media and annotation stay one click away in the Add or create menu.
    // Nothing to turn in online: Canvas's block would only hold the comment button ours replaces.
    const own = kind === 'assignment' && S.ours.length > 0;
    S.own = own;
    const tuck = own || (kind === 'assignment' && !st0.online);
    html.classList.toggle('gcx-asg-own', tuck);
    if (own) {
      S.pledge = pageEnv('SIMILARITY_PLEDGE');
      if (S.pledge && !S.pledge.PLEDGE_TEXT && !S.pledge.EULA_URL) S.pledge = null;
      const saved = gcx.store ? gcx.store.get(DRAFT_KEY, null) : null;
      if (saved && openState().open && S.ours.includes(saved.type)) {
        Object.assign(S.draft, { type: saved.type, text: saved.text || '', url: saved.url || '' });
        S.composing = true;
      }
    }
    S.composing = S.composing || (own && !history().length);
    renderRubric(a, s);
    const rubricBtn = view.querySelector('.gcx-asg-rubric');
    // With the rubric drawn on the page, Canvas's block isn't needed to see it.
    rubricBtn.hidden = !(tuck && !Array.isArray(a.rubric) && a.rubric_settings);
    rubricBtn.addEventListener('click', () => {
      const on = !html.classList.contains('gcx-asg-reveal');
      reveal(on);
      if (on) requestAnimationFrame(() => pulse(q('rubric-tab') || q('fill-out-rubric-toggle') || q('assignments-2-student-view')));
    });

    renderWork();
    setupComments();

    view.removeAttribute('aria-busy');
    view.classList.add('ready');
  }

  // Show (or tuck away again) Canvas's own block under ours.
  // Canvas's block, opened for something only it can do, gets a close button of ours.
  function closeBar() {
    const box = document.querySelector('.gcx-asg-canvas');
    if (!box || box.querySelector(':scope > .gcx-asg-canvas-bar')) return;
    const bar = el(`<div class="gcx-asg-canvas-bar"><span>In Canvas</span><button type="button" class="gcx-asg-a gcx-asg-canvas-fresh" hidden>Refresh</button><button type="button" class="gcx-asg-canvas-x" aria-label="Close" title="Close">${svg('close', 18)}</button></div>`);
    // After a turn-in from our card, Canvas's block still shows the page as it was (its Submit could
    // spend another attempt). Say so, and let him refresh when he's ready rather than reloading on him.
    bar.querySelector('.gcx-asg-canvas-fresh').addEventListener('click', () => location.reload());
    bar.querySelector('.gcx-asg-canvas-x').addEventListener('click', () => {
      reveal(false);
      view.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    });
    box.prepend(bar);
  }
  function reveal(on) {
    html.classList.toggle('gcx-asg-reveal', on);
    if (on) closeBar();
    const cb = document.querySelector('.gcx-asg-canvas-bar');
    if (cb) {
      cb.querySelector('span').textContent = S.turnedInHere ? 'In Canvas · from before your turn-in' : 'In Canvas';
      cb.querySelector('.gcx-asg-canvas-fresh').hidden = !S.turnedInHere;
    }
    const b = view.querySelector('.gcx-asg-rubric');
    b.textContent = on ? 'Hide rubric' : 'Rubric';
    b.setAttribute('aria-expanded', String(on));
  }
  // ---------------------------------------------------------------- rubric
  // The grading rubric in the assignment itself, Classroom style: each criterion with its levels and
  // points, and once it's graded, the level he got (highlighted), his points and the grader's note.
  function renderRubric(a, s) {
    view.querySelector('.gcx-asg-rb')?.remove();
    const crit = Array.isArray(a.rubric) ? a.rubric : [];
    if (!crit.length) return;
    const set = a.rubric_settings || {};
    const hidePts = !!set.hide_points;
    const got = s.rubric_assessment || {};
    const graded = Object.keys(got).length > 0;
    // Totals as Canvas counts them: criteria marked ignore_for_scoring (outcome-only) don't add up.
    const scored = crit.filter((c) => !c.ignore_for_scoring);
    const total = set.points_possible != null ? +set.points_possible : scored.reduce((t, c) => t + (+c.points || 0), 0);
    const earned = graded ? scored.reduce((t, c) => t + (got[c.id] && got[c.id].points != null ? +got[c.id].points : 0), 0) : null;
    const pts = (n) => `${fmtNum(n)} pt${n === 1 ? '' : 's'}`;
    const rows = crit
      .map((c) => {
        const g = got[c.id] || {};
        const levels = (c.ratings || [])
          .map((r) => {
            const on = graded && (g.rating_id ? g.rating_id === r.id : g.points != null && +g.points === +r.points);
            return `<div class="gcx-rb-lv${on ? ' on' : ''}" title="${esc(plainText(r.long_description || ''))}">${hidePts ? '' : `<b>${esc(fmtNum(+r.points || 0))}</b>`}<span>${esc(r.description || '')}</span></div>`;
          })
          .join('');
        const score = hidePts ? '' : graded && g.points != null ? `${esc(fmtNum(+g.points))} / ${esc(pts(+c.points || 0))}` : esc(pts(+c.points || 0));
        return `<div class="gcx-rb-crit">
          <div class="gcx-rb-top"><b>${esc(c.description || 'Criterion')}</b><span>${score}</span></div>
          ${c.long_description ? `<div class="gcx-rb-long">${esc(plainText(c.long_description))}</div>` : ''}
          ${levels ? `<div class="gcx-rb-levels">${levels}</div>` : ''}
          ${g.comments ? `<div class="gcx-rb-note">${esc(g.comments)}</div>` : ''}
        </div>`;
      })
      .join('');
    const nCrit = `${crit.length} ${crit.length === 1 ? 'criterion' : 'criteria'}`;
    const sum = hidePts ? nCrit : graded && !set.hide_score_total ? `${fmtNum(earned)} / ${pts(total)}` : `${nCrit} · ${pts(total)}`;
    const box = el(`<section class="gcx-asg-rb${graded ? ' open' : ''}">
      <button type="button" class="gcx-asg-rb-h" aria-expanded="${graded}"><h2>Rubric</h2><span class="gcx-asg-rb-sum">${esc(sum)}</span>${svg('chevron', 20)}</button>
      <div class="gcx-asg-rb-body"><div class="gcx-asg-rb-in">${rows}</div></div>
    </section>`);
    box.querySelector('.gcx-asg-rb-h').addEventListener('click', () => {
      const open = box.classList.toggle('open');
      box.querySelector('.gcx-asg-rb-h').setAttribute('aria-expanded', String(open));
    });
    view.querySelector('.gcx-asg-files').after(box);
  }

  // An item from the Add or create menu that only Canvas's block can do.
  function useCanvas() {
    reveal(true);
    requestAnimationFrame(goToSubmission);
  }

  // ---------------------------------------------------------------- Your work: render
  const work = view.querySelector('.gcx-asg-work-body');
  function renderWork() {
    const { a, s, kind } = S;
    const st = workState(a, s);
    const status = view.querySelector('.gcx-asg-status');
    status.textContent = st.label;
    status.className = `gcx-asg-status ${st.cls}`;
    const parts = [];
    if (st.graded && s.grade && String(s.grade) !== String(s.score)) parts.push(`<div class="gcx-asg-grade">Grade: ${esc(s.grade)}</div>`);
    const hist = history();
    const own = S.own;
    const due = a.due_at ? new Date(a.due_at) : null;

    if (hist.length) {
      const cur = hist.find((h) => h.attempt === S.viewing) || hist[hist.length - 1];
      S.viewing = cur.attempt || 0;
      const max = allowedAttempts();
      const count = max != null ? `<span class="gcx-asg-used">${esc(usedAttempts())} of ${esc(max)} used</span>` : '';
      const pick =
        hist.length > 1
          ? `<label class="gcx-asg-attsel"><span class="gcx-asg-vh">Show attempt</span><select data-attempt>${hist
              .map((h) => `<option value="${esc(h.attempt)}"${h === cur ? ' selected' : ''}>Attempt ${esc(h.attempt)}</option>`)
              .join('')}</select></label>`
          : `<span class="gcx-asg-att-n">Attempt ${esc(cur.attempt || 1)}</span>`;
      parts.push(`<div class="gcx-asg-att">${pick}${count}</div>`);
      parts.push(`<div class="gcx-asg-when">Turned in ${esc(fmtDue(new Date(cur.submitted_at)))}${cur.late ? ' <span class="gcx-asg-late">· Late</span>' : ''}</div>`);
      parts.push(attemptContent(cur));
    } else if (due && due > new Date() && !st.graded && !s.excused) {
      const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const days = Math.round((midnight(due) - midnight(new Date())) / 864e5);
      parts.push(`<div class="gcx-asg-when">${days <= 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `Due in ${days} days`}</div>`);
    }

    let tail = '';
    if (kind === 'quiz' && a.quiz_id) tail = `<a class="gcx-asg-btn" href="/courses/${esc(cid)}/quizzes/${esc(a.quiz_id)}">${s.submitted_at ? 'View quiz' : 'Open quiz'}</a>`;
    else if (kind === 'discussion' && a.discussion_topic && a.discussion_topic.html_url) tail = `<a class="gcx-asg-btn" href="${esc(a.discussion_topic.html_url)}">Open discussion</a>`;
    else if (kind === 'tool') tail = `<button type="button" class="gcx-asg-btn" data-go>Open ${esc(a.name)}</button>`;
    else if (own) {
      const os = openState();
      if (!os.open) {
        if (os.why) tail = `<div class="gcx-asg-note">${esc(os.why)}</div>`;
      } else if (S.composing) tail = composeHtml(hist.length > 0);
      // Another attempt whenever Canvas allows one (attempts left, still open), graded or not.
      else tail = '<button type="button" class="gcx-asg-btn" data-again>Submit again</button>';
    } else if (st.online && !a.locked_for_user) {
      // Only kinds of work Canvas's own block can take (media, annotation): one button into it.
      const again = s.submitted_at && !st.graded && openState().open;
      tail = `<button type="button" class="gcx-asg-btn" data-go>${s.submitted_at ? (again ? 'Submit again' : 'View submission') : 'Add or create'}</button>`;
    } else if (!st.online && kind === 'assignment') parts.push('<div class="gcx-asg-note">Nothing to turn in online for this one.</div>');

    const hadFocus = work.contains(document.activeElement) && document.activeElement.matches('[data-turnin], [data-add]') ? document.activeElement.dataset : null;
    work.innerHTML = parts.join('') + tail;
    wireWork();
    if (hadFocus) work.querySelector(hadFocus.turnin != null ? '[data-turnin]' : '[data-add]')?.focus();
  }

  // What he turned in for one attempt.
  function attemptContent(h) {
    const out = [];
    const type = h.submission_type;
    if (type === 'online_url' && h.url)
      out.push(`<a class="gcx-asg-chip small" href="${esc(h.url)}" target="_blank" rel="noopener noreferrer"><span class="gcx-asg-chip-ic">${svg('link', 18)}</span><span class="gcx-asg-chip-tx"><b>${esc(h.url)}</b><small>Link</small></span></a>`);
    else if (type === 'online_text_entry' && h.body) out.push(`<div class="gcx-asg-text" tabindex="0">${esc(plainText(h.body))}</div>`);
    else
      for (const f of h.attachments || [])
        out.push(`<a class="gcx-asg-chip small" href="${esc(f.url || f.preview_url || '#')}" data-gcx-file="${esc(f.id)}" data-gcx-name="${esc(f.display_name)}" title="${esc(f.display_name)}">
          <span class="gcx-asg-chip-ic">${gcx.fileTile ? gcx.fileTile(f.display_name, 24) : svg('file', 18)}</span><span class="gcx-asg-chip-tx"><b>${esc(f.display_name)}</b>${f.size ? `<small>${esc(fmtSize(f.size))}</small>` : ''}</span></a>`);
    if (!out.length) {
      const href = h.preview_url || S.s.preview_url;
      const label = { media_recording: 'Media recording', student_annotation: 'Annotated document', basic_lti_launch: 'Turned in through an app' }[type] || 'Turned in';
      out.push(`<div class="gcx-asg-note">${esc(label)}${href ? ` · <a class="gcx-asg-a" href="${esc(href)}" target="_blank" rel="noopener">Open in Canvas</a>` : ''}</div>`);
    }
    return out.join('');
  }

  // Adding work, the pledge, and the Turn in button.
  function composeHtml(resubmit) {
    const d = S.draft;
    const items = [];
    if (d.type === 'text')
      items.push(`<div class="gcx-asg-item"><div class="gcx-asg-item-h">${svg('text', 18)}<b>Text entry</b><button type="button" class="gcx-asg-x" data-rm="text" aria-label="Remove text entry"${S.busy ? ' disabled' : ''}>${svg('close', 18)}</button></div>
        <textarea class="gcx-asg-ta" data-text rows="6" placeholder="Type or paste your work" aria-label="Your text entry"></textarea></div>`);
    if (d.type === 'url')
      items.push(`<div class="gcx-asg-item"><div class="gcx-asg-item-h">${svg('link', 18)}<b>Link</b><button type="button" class="gcx-asg-x" data-rm="url" aria-label="Remove link"${S.busy ? ' disabled' : ''}>${svg('close', 18)}</button></div>
        <input class="gcx-asg-in" data-url type="url" inputmode="url" placeholder="https://" aria-label="Link to your work" autocomplete="off" spellcheck="false"></div>`);
    if (d.type === 'file')
      d.files.forEach((f, i) =>
        items.push(`<div class="gcx-asg-chip small draft" title="${esc(f.file.name)}"><span class="gcx-asg-chip-ic">${gcx.fileTile ? gcx.fileTile(f.file.name, 24) : svg('file', 18)}</span><span class="gcx-asg-chip-tx"><b>${esc(f.file.name)}</b><small>${esc(fmtSize(f.file.size))}${f.id ? ' · uploaded' : ''}</small></span>
          <button type="button" class="gcx-asg-x" data-rm-file="${i}" aria-label="Remove ${esc(f.file.name)}"${S.busy ? ' disabled' : ''}>${svg('close', 18)}</button></div>`),
      );

    // One kind of work per turn-in (Canvas keeps one type per attempt); more files are fine.
    const exts = extsOf();
    const menu = [];
    const mi = (attrs, icon, label, hint, off) =>
      `<button type="button" role="menuitem" class="gcx-asg-mi" ${attrs}${off ? ` aria-disabled="true" title="${esc(off)}"` : ''}>${svg(icon, 20)}<span>${esc(label)}${hint ? `<small>${esc(hint)}</small>` : ''}</span></button>`;
    const other = d.type && 'Remove what you added to turn in a different kind of work';
    for (const t of S.ours) {
      if (t === 'file')
        menu.push(mi('data-pick="file"', 'upload', d.files.length ? 'Add another file' : 'File', exts.length ? exts.map((x) => x.toUpperCase()).join(', ') : 'From your computer', d.type && d.type !== 'file' ? other : ''));
      if (t === 'text') menu.push(mi('data-pick="text"', 'text', 'Text', 'Type it here', d.type === 'text' ? 'Already added' : d.type ? other : ''));
      if (t === 'url') menu.push(mi('data-pick="url"', 'link', 'Link', 'A website address', d.type === 'url' ? 'Already added' : d.type ? other : ''));
    }
    const extra = S.elsewhere.map((t) => mi('data-canvas', ELSEWHERE[t][1], ELSEWHERE[t][0], '', ''));
    extra.push(mi('data-canvas', 'more', 'More options in Canvas', S.ours.includes('file') ? 'Google Drive, OneDrive, apps' : '', ''));
    const accept = exts.length ? ` accept="${esc(exts.map((x) => '.' + x).join(','))}"` : '';

    const pledge = S.pledge
      ? `<label class="gcx-asg-pledge"><input type="checkbox" data-pledge${S.pledged ? ' checked' : ''}${S.busy ? ' disabled' : ''}><span>${S.pledge.PLEDGE_TEXT ? 'I agree to the plagiarism pledge.' : 'I agree to the end-user license agreement.'} <button type="button" class="gcx-asg-a" data-pledge-read aria-expanded="false">Read it</button></span></label>
         <div class="gcx-asg-pledge-tx" hidden>${esc(S.pledge.PLEDGE_TEXT || '')}${S.pledge.COMMENTS ? `\n\n${esc(plainText(S.pledge.COMMENTS))}` : ''}${
           S.pledge.EULA_URL ? `\n\n<a class="gcx-asg-a" href="${esc(S.pledge.EULA_URL)}" target="_blank" rel="noopener noreferrer">End-user license agreement</a>` : ''
         }</div>`
      : '';
    return `<div class="gcx-asg-compose">${items.join('')}
      <div class="gcx-asg-add-wrap">
        <button type="button" class="gcx-asg-add" data-add aria-haspopup="menu" aria-expanded="false"${S.busy ? ' disabled' : ''}>${svg('add', 20)}Add or create</button>
        <div class="gcx-asg-menu" role="menu" aria-label="Add or create" hidden>${menu.join('')}${menu.length ? '<hr>' : ''}${extra.join('')}</div>
        <input type="file" data-files multiple hidden${accept}>
      </div>
      ${pledge}
      <button type="button" class="gcx-asg-btn gcx-asg-turnin${S.busy ? ' busy' : ''}" data-turnin${ready() ? '' : ' disabled'}><span>${
        S.busy ? 'Turning in…' : 'Turn in'
      }</span><span class="gcx-asg-vh"> your work</span></button>
      ${resubmit && !S.busy ? '<button type="button" class="gcx-asg-a gcx-asg-cancel" data-cancel>Cancel</button>' : ''}</div>`;
  }

  // Turn in's look follows what's attached without redrawing the card (keeps focus in the box).
  const syncTurnIn = () => {
    const b = work.querySelector('[data-turnin]');
    if (b && !S.busy) b.disabled = !ready();
  };

  function wireWork() {
    work.querySelector('[data-go]')?.addEventListener('click', goToSubmission);
    work.querySelector('[data-attempt]')?.addEventListener('change', (e) => {
      S.viewing = +e.target.value;
      renderWork();
      work.querySelector('[data-attempt]')?.focus();
    });
    work.querySelector('[data-again]')?.addEventListener('click', () => {
      S.composing = true;
      renderWork();
      work.querySelector('[data-add]')?.focus();
    });
    work.querySelector('[data-cancel]')?.addEventListener('click', () => {
      S.composing = false;
      S.draft = { type: '', text: '', url: '', files: [] };
      saveDraft();
      renderWork();
    });

    const ta = work.querySelector('[data-text]');
    if (ta) {
      ta.value = S.draft.text;
      ta.disabled = S.busy;
      ta.addEventListener('input', () => {
        S.draft.text = ta.value;
        saveDraft();
        syncTurnIn();
      });
    }
    const url = work.querySelector('[data-url]');
    if (url) {
      url.value = S.draft.url;
      url.disabled = S.busy;
      url.addEventListener('input', () => {
        S.draft.url = url.value;
        saveDraft();
        syncTurnIn();
      });
    }
    work.querySelectorAll('[data-rm]').forEach((b) =>
      b.addEventListener('click', () => {
        if (S.busy) return;
        S.draft = { type: '', text: '', url: '', files: [] };
        saveDraft();
        renderWork();
        work.querySelector('[data-add]')?.focus();
      }),
    );
    work.querySelectorAll('[data-rm-file]').forEach((b) =>
      b.addEventListener('click', () => {
        S.draft.files.splice(+b.dataset.rmFile, 1);
        if (!S.draft.files.length) S.draft.type = '';
        renderWork();
        work.querySelector('[data-add]')?.focus();
      }),
    );
    const pl = work.querySelector('[data-pledge]');
    pl?.addEventListener('change', () => {
      S.pledged = pl.checked;
      syncTurnIn();
    });
    const plRead = work.querySelector('[data-pledge-read]');
    plRead?.addEventListener('click', (e) => {
      e.preventDefault();
      const tx = work.querySelector('.gcx-asg-pledge-tx');
      tx.hidden = !tx.hidden;
      plRead.setAttribute('aria-expanded', String(!tx.hidden));
      plRead.textContent = tx.hidden ? 'Read it' : 'Hide it';
    });
    work.querySelector('[data-turnin]')?.addEventListener('click', turnIn);

    // Add or create menu
    const add = work.querySelector('[data-add]');
    const menu = work.querySelector('.gcx-asg-menu');
    const input = work.querySelector('[data-files]');
    if (!add) return;
    const items = () => [...menu.querySelectorAll('.gcx-asg-mi:not([aria-disabled="true"])')];
    const close = (focus) => {
      menu.hidden = true;
      add.setAttribute('aria-expanded', 'false');
      if (focus) add.focus();
    };
    add.addEventListener('click', () => {
      if (!menu.hidden) return close();
      menu.hidden = false;
      add.setAttribute('aria-expanded', 'true');
      items()[0]?.focus();
    });
    menu.addEventListener('keydown', (e) => {
      const list = items();
      const i = list.indexOf(document.activeElement);
      if (e.key === 'Escape') {
        e.preventDefault();
        close(true);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus();
      } else if (e.key === 'Tab') close();
    });
    menu.addEventListener('click', (e) => {
      const b = e.target.closest('.gcx-asg-mi');
      if (!b || b.getAttribute('aria-disabled') === 'true') return;
      close();
      if (b.hasAttribute('data-canvas')) return useCanvas();
      const pick = b.dataset.pick;
      if (pick === 'file') return input.click();
      S.draft.type = pick;
      renderWork();
      work.querySelector(pick === 'text' ? '[data-text]' : '[data-url]')?.focus();
    });
    input.addEventListener('change', () => {
      const exts = extsOf();
      const picked = [...input.files];
      const ok = picked.filter((f) => !exts.length || exts.includes((f.name.match(/\.([^.]+)$/) || [])[1]?.toLowerCase()));
      if (ok.length < picked.length) gcx.toast(`Only ${exts.map((x) => x.toUpperCase()).join(', ')} files can be turned in here`);
      if (ok.length) {
        S.draft.type = 'file';
        S.draft.files.push(...ok.map((file) => ({ file, id: null })));
        saveDraft();
      }
      input.value = '';
      renderWork();
      work.querySelector('[data-turnin]:not([disabled])')?.focus();
    });
  }
  // A click anywhere else closes the menu.
  document.addEventListener('pointerdown', (e) => {
    const menu = work.querySelector('.gcx-asg-menu');
    if (!menu || menu.hidden || e.target.closest?.('.gcx-asg-add-wrap')) return;
    menu.hidden = true;
    work.querySelector('[data-add]')?.setAttribute('aria-expanded', 'false');
  });
  // Don't let him navigate away mid-upload without a warning.
  window.addEventListener('beforeunload', (e) => {
    if (S.busy) e.preventDefault();
  });

  // ---------------------------------------------------------------- turning in
  // We celebrate our own turn-in below. The button's full text ("Turn in your work") keeps
  // classroom.js's watchSubmissions(), which listens for clicks on Canvas's "Turn in"/"Submit"
  // buttons, from also arming on it (no double confetti).
  function setProgress(label, frac) {
    const b = work.querySelector('[data-turnin]');
    if (!b) return;
    b.firstElementChild.textContent = label;
    b.style.setProperty('--p', frac == null ? '100%' : `${Math.round(frac * 100)}%`);
  }
  async function turnIn() {
    if (!ready()) return;
    const d = S.draft;
    S.busy = true;
    renderWork();
    try {
      const p = new URLSearchParams();
      if (d.type === 'text') {
        p.set('submission[submission_type]', 'online_text_entry');
        const htmlBody = d.text
          .trim()
          .split(/\n{2,}/)
          .map((para) => `<p>${esc(para).replace(/\n/g, '<br>')}</p>`)
          .join('');
        p.set('submission[body]', htmlBody);
      } else if (d.type === 'url') {
        p.set('submission[submission_type]', 'online_url');
        p.set('submission[url]', normUrl(d.url));
      } else {
        // Files already uploaded on an earlier try aren't sent again.
        const total = d.files.reduce((n, f) => n + (f.id ? 0 : f.file.size), 0) || 1;
        let done = 0;
        for (const f of d.files) {
          if (f.id) continue;
          setProgress(`Uploading ${Math.round((done / total) * 100)}%`, done / total);
          f.id = await uploadFile(f.file, (frac) => {
            const all = (done + frac * f.file.size) / total;
            setProgress(`Uploading ${Math.round(all * 100)}%`, all);
          });
          done += f.file.size;
        }
        p.set('submission[submission_type]', 'online_upload');
        for (const f of d.files) p.append('submission[file_ids][]', f.id);
      }
      if (S.pledge && S.pledge.EULA_URL) p.set('submission[eula_agreement_timestamp]', String(Date.now()));
      setProgress('Turning in…', null);
      await send('POST', `/courses/${cid}/assignments/${aid}/submissions`, p);
      S.turnedInHere = true;
      // Canvas's block, if it was open, is out of date now; tuck it away.
      if (html.classList.contains('gcx-asg-reveal')) reveal(false);

      S.busy = false;
      S.composing = false;
      S.draft = { type: '', text: '', url: '', files: [] };
      S.pledged = false;
      saveDraft();
      try {
        if (!gcx.prefs || gcx.prefs().confetti !== false) gcx.confetti?.();
      } catch {}
      gcx.toast('Turned in');
      const fresh = await api(SUB_PATH + SUB_INCLUDE).catch(() => null);
      if (fresh) S.s = fresh;
      else Object.assign(S.s, { submitted_at: new Date().toISOString(), workflow_state: 'submitted', attempt: (S.s.attempt || 0) + 1 });
      S.viewing = 0;
      renderWork();
      renderComments();
      work.querySelector('.gcx-asg-btn, [data-attempt]')?.focus();
    } catch (e) {
      console.warn('[canvas-classroom] turn in', e);
      S.busy = false;
      renderWork();
      gcx.toast(`Couldn't turn in: ${e.message || 'something went wrong'}. Your work is still here.`);
    }
  }

  // ---------------------------------------------------------------- private comments
  const cbox = view.querySelector('.gcx-asg-comments-body');
  function setupComments() {
    cbox.innerHTML = `<div class="gcx-asg-cmt-list"></div>
      <form class="gcx-asg-cform"><textarea rows="1" placeholder="Add private comment…" aria-label="Add private comment" maxlength="8000"></textarea>
        <button type="submit" class="gcx-asg-send" aria-label="Post comment" title="Post" disabled>${svg('send', 20)}</button></form>`;
    const form = cbox.querySelector('form');
    const ta = form.querySelector('textarea');
    const sendBtn = form.querySelector('button');
    const grow = () => {
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight + 2, 160)}px`;
      sendBtn.disabled = !ta.value.trim();
    };
    ta.addEventListener('input', grow);
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        form.requestSubmit();
      }
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = ta.value.trim();
      if (!text) return;
      const hist = history();
      const attempt = hist.length ? S.viewing || hist[hist.length - 1].attempt : null;
      const me = gcx.getMe ? gcx.getMe() : null;
      const tmp = { id: `tmp${Date.now()}`, author_name: (me && me.name) || 'You', created_at: new Date().toISOString(), comment: text, attempt, pending: true };
      S.pending.push(tmp);
      ta.value = '';
      grow();
      renderComments();
      const p = new URLSearchParams({ 'comment[text_comment]': text });
      if (attempt) p.set('comment[attempt]', String(attempt));
      try {
        const r = await send('PUT', SUB_PATH, p);
        S.pending = S.pending.filter((x) => x !== tmp);
        if (r && Array.isArray(r.submission_comments) && r.submission_comments.some((k) => k.comment === text)) S.s.submission_comments = r.submission_comments;
        else S.s.submission_comments = [...(S.s.submission_comments || []), { ...tmp, pending: false }];
        renderComments();
      } catch (err) {
        S.pending = S.pending.filter((x) => x !== tmp);
        renderComments();
        if (!ta.value.trim()) {
          ta.value = text;
          grow();
        }
        gcx.toast(`Couldn't post your comment: ${err.message || 'something went wrong'}`);
      }
    });
    renderComments();
    // Ours works, so Canvas's own "Add Comment" button (and its tray) can go.
    html.classList.add('gcx-asg-cmts');
  }
  function renderComments() {
    const list = cbox.querySelector('.gcx-asg-cmt-list');
    if (!list) return;
    const many = history().length > 1;
    const all = [...(S.s.submission_comments || []), ...S.pending].sort((x, y) => Date.parse(x.created_at) - Date.parse(y.created_at));
    list.innerHTML = all
      .map((k) => {
        const who = k.author_name || (k.author && k.author.display_name) || 'Someone';
        const files = (k.attachments || [])
          .map((f) => `<a class="gcx-asg-a gcx-asg-cmt-file" href="${esc(f.url || '#')}" data-gcx-file="${esc(f.id)}" data-gcx-name="${esc(f.display_name)}">${esc(f.display_name)}</a>`)
          .join('');
        const media = k.media_comment && k.media_comment.url ? `<a class="gcx-asg-a gcx-asg-cmt-file" href="${esc(k.media_comment.url)}" target="_blank" rel="noopener">Media comment</a>` : '';
        return `<div class="gcx-asg-cmt${k.pending ? ' pending' : ''}"><div class="gcx-asg-cmt-h"><b>${esc(who)}${many && k.attempt ? `<span class="gcx-asg-cmt-att">Attempt ${esc(k.attempt)}</span>` : ''}</b><span>${
          k.pending ? 'Sending…' : esc(fmtDay(new Date(k.created_at)))
        }</span></div><div class="gcx-asg-cmt-tx">${esc(k.comment || '')}</div>${files}${media}</div>`;
      })
      .join('');
  }
})();
