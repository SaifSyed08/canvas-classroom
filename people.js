// Course People page (/courses/:id/users), laid out like Google Classroom's People tab:
// Teachers (teachers, TAs, designers), the groups he's in (and any others he can see), then
// Classmates with a count. Clicking anyone opens a compact card: name with Message/profile icons,
// "Student · Group", their Canvas bio, email when Canvas shares it, and the classes he shares with
// them (read from the Enrollments list on their Canvas profile page; his other courses' rosters
// are the fallback). classroom.js mounts the empty view and hands over the course;
// `?gcx-original=1` shows Canvas's own page.
(() => {
  'use strict';
  const T0 = performance.now();
  const gcx = window.gcx;
  if (!gcx || window.top !== window) return;
  if (gcx.VIEW !== 'people' || !gcx.people || !gcx.COURSE_ID) return;
  const { api, esc, el, svg, swr, coursesReady, prettyName, toast } = gcx;
  const { view, course: cPromise } = gcx.people;
  const id = gcx.COURSE_ID;

  const COPY = 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z';
  const copySvg = `<svg class="gcx-svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="${COPY}"/></svg>`;

  // His own id: the cached profile, else the id Canvas writes into the page's ENV script.
  const ME = (() => {
    const m = gcx.getMe && gcx.getMe();
    if (m && m.id) return Number(m.id);
    for (const sc of document.scripts) {
      const x = !sc.src && sc.textContent.match(/"current_user_id":"(\d+)"/);
      if (x) return Number(x[1]);
    }
    return null;
  })();
  const still = () => gcx.prefs().motion === false || matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------- data
  const ROLE = { TeacherEnrollment: 'teacher', TaEnrollment: 'ta', DesignerEnrollment: 'designer', StudentEnrollment: 'student', ObserverEnrollment: 'observer' };
  const RANK = { teacher: 0, ta: 1, designer: 2, student: 3, observer: 4 };
  const ROLE_LABEL = { teacher: 'Teacher', ta: 'TA', designer: 'Designer', student: 'Student', observer: 'Observer' };
  const STAFF = new Set(['teacher', 'ta', 'designer']);
  // Canvas's stand-in picture for people who never set one.
  const DEFAULT_AV = /avatar-50\.png|\/images\/messages\/avatar-|\/images\/dotted_pic/;
  const realAv = (u) => {
    const a = u && (u.avatar_url || u.avatar_image_url);
    return a && !DEFAULT_AV.test(a) ? a : '';
  };
  // "Not allowed" and "not found" are answers; anything else (network, 5xx) is a gap swr shouldn't save.
  const soft = (fallback, tally) => (e) => {
    if (tally && !(e && (e.status === 401 || e.status === 403 || e.status === 404))) tally.fails++;
    return fallback;
  };

  // A course's roster in the compact shape that's cached (key people:<courseId>), so any page
  // that loaded one course's roster helps the "classes you share" lookup on every other.
  async function fetchRoster(cid, tally) {
    const base = `/courses/${cid}/users?include[]=avatar_url&include[]=enrollments&include[]=email&include[]=pronouns&per_page=100`;
    const users = await api(base, true);
    const out = users.map((u) => {
      const roles = new Set();
      let custom = '';
      for (const e of u.enrollments || []) {
        const r = ROLE[e.type];
        if (r) roles.add(r);
        // Custom roles ("Grader", "Course Coordinator") are built on a base type.
        if (e.role && e.role !== e.type && !custom) custom = e.role;
      }
      return {
        id: u.id,
        name: u.short_name || u.name || 'Unknown',
        full: u.name || '',
        sort: u.sortable_name || u.name || '',
        av: realAv(u),
        email: u.email || '',
        pro: u.pronouns || '',
        roles: [...roles],
        custom,
      };
    });
    // Enrollments didn't come back at all: ask for the staff by type and call everyone else a student.
    if (out.length && users.every((u) => !u.enrollments)) {
      const byType = (t) => api(`/courses/${cid}/users?enrollment_type[]=${t}&per_page=100`, true).then((l) => new Set(l.map((u) => u.id)), soft(new Set(), tally));
      const [t, ta, de] = await Promise.all([byType('teacher'), byType('ta'), byType('designer')]);
      for (const p of out) p.roles = [t.has(p.id) ? 'teacher' : ta.has(p.id) ? 'ta' : de.has(p.id) ? 'designer' : 'student'];
    }
    return out;
  }
  const roleOf = (p) => (p.roles && p.roles.length ? p.roles.reduce((a, b) => (RANK[a] <= RANK[b] ? a : b)) : 'student');
  const roleText = (p) => p.custom || (p.roles && p.roles.length ? ROLE_LABEL[roleOf(p)] : '');

  // Groups he can see in this course. The course list may be off-limits to students; his own
  // groups always work. Members come inline when Canvas includes them, else per group.
  async function fetchGroups(cid, tally) {
    const [mineAll, courseList] = await Promise.all([
      api('/users/self/groups?context_type=Course&include[]=users&per_page=100', true).catch(soft([], tally)),
      api(`/courses/${cid}/groups?include[]=users&per_page=100`, true).catch(soft(null, tally)),
    ]);
    const mine = mineAll.filter((g) => Number(g.course_id) === cid);
    const mineIds = new Set(mine.map((g) => g.id));
    const list = [...(courseList || [])];
    for (const g of mine) if (!list.some((x) => x.id === g.id)) list.push(g);
    // His groups without members inline: ask each group (members can always read their own).
    await Promise.all(
      list
        .filter((g) => mineIds.has(g.id) && !Array.isArray(g.users))
        .map((g) =>
          api(`/groups/${g.id}/users?include[]=avatar_url&per_page=100`, true)
            .then((u) => (g.users = u))
            .catch(soft(null, tally)),
        ),
    );
    // Category names ("Lab groups", "Project teams"). Students may not be allowed the list;
    // then try each of his groups' categories one by one, and failing that, go without.
    const cats = new Map();
    const catList = await api(`/courses/${cid}/group_categories?per_page=100`, true).catch(soft(null, tally));
    if (catList) for (const c of catList) cats.set(c.id, c.name);
    else {
      const need = [...new Set(list.filter((g) => mineIds.has(g.id)).map((g) => g.group_category_id).filter(Boolean))].slice(0, 6);
      await Promise.all(need.map((cat) => api(`/group_categories/${cat}`).then((c) => cats.set(cat, c.name), soft(null, tally))));
    }
    return {
      all: !!courseList,
      groups: list.map((g) => {
        const users = Array.isArray(g.users) ? g.users : null;
        return {
          id: g.id,
          name: g.name || 'Group',
          cat: cats.get(g.group_category_id) || '',
          count: users ? users.length : g.members_count || 0,
          mine: mineIds.has(g.id) || !!(ME && users && users.some((u) => u.id === ME)),
          members: users ? users.map((u) => ({ id: u.id, name: u.short_name || u.display_name || u.name || '', av: realAv(u) })) : null,
        };
      }),
    };
  }

  // ---------------------------------------------------------------- rosters of his other courses
  // Fetched only once he opens someone's card, three at a time, each through swr so a saved
  // copy answers at once. Listeners redraw the open card as each one lands.
  const rosters = new Map(); // courseId -> Set of user ids
  const rosterState = new Map(); // courseId -> 'queued' | 'loading' | 'ok' | 'err'
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn());
  const queue = [];
  let active = 0;
  const CAP = 3;
  const keepRoster = (cid, list) => {
    rosters.set(cid, new Set(list.map((u) => u.id)));
    rosterState.set(cid, 'ok');
  };
  function wantRoster(cid) {
    if (rosterState.has(cid)) return;
    rosterState.set(cid, 'queued');
    queue.push(cid);
    pump();
  }
  function pump() {
    while (active < CAP && queue.length) {
      const cid = queue.shift();
      active++;
      rosterState.set(cid, 'loading');
      swr(`people:${cid}`, (t) => fetchRoster(cid, t), (list) => {
        keepRoster(cid, list);
        emit();
      })
        .catch(() => {
          if (!rosters.has(cid)) rosterState.set(cid, 'err');
        })
        .finally(() => {
          active--;
          emit();
          pump();
        });
    }
  }
  let otherCourses = null; // his dashboard courses minus this one
  async function startMutual() {
    if (!otherCourses) otherCourses = (await coursesReady).filter((c) => c.id !== id);
    for (const c of otherCourses) wantRoster(c.id);
    return otherCourses;
  }
  let myCourses = null; // his dashboard courses, for colors and short names
  coursesReady.then((l) => (myCourses = l), () => {});

  // ---------------------------------------------------------------- their Canvas profile page
  // /courses/:id/users/:uid is HTML with the bio (#biography) and an Enrollments list of their
  // courses and groups that he can see, i.e. the classes they share. (The profile API answers 403
  // for other students.) Fetched once per card opening per session, saved per user id.
  const profiles = new Map(); // uid -> { bio, courses: [{id, name}] | null, groups: [{id, name}] } | null
  const profLoading = new Map(); // uid -> promise
  function parseProfile(markup) {
    const d = new DOMParser().parseFromString(markup, 'text/html');
    const bioEl = d.getElementById('biography');
    let bio = '';
    if (bioEl) {
      // Only <br>s are line breaks; the newlines in the page source are just markup.
      bioEl.querySelectorAll('br').forEach((b) => b.replaceWith('\u0001'));
      bio = bioEl.textContent.replace(/\s+/g, ' ').replace(/ ?\u0001 ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    }
    // The header text is translated; the item class isn't.
    const items = [...d.querySelectorAll('li.profileEnrollment__Items')];
    const head = [...d.querySelectorAll('.profileHeader')].find((h) => /^\s*Enrollments\s*$/i.test(h.textContent));
    if (!items.length && !head) return { bio, courses: null, groups: [] };
    const links = items.length ? items.map((li) => li.querySelector('a[href]')).filter(Boolean) : [...head.parentElement.querySelectorAll('li a[href]')];
    const courses = [];
    const groups = [];
    for (const a of links) {
      const m = (a.getAttribute('href') || '').match(/\/(courses|groups)\/(\d+)\/?(?:[?#].*)?$/);
      if (!m) continue;
      const list = m[1] === 'courses' ? courses : groups;
      const cid = Number(m[2]);
      if (!list.some((x) => x.id === cid)) list.push({ id: cid, name: a.textContent.trim() });
    }
    return { bio, courses, groups };
  }
  function loadProfile(uid) {
    if (profLoading.has(uid)) return profLoading.get(uid);
    const job = swr(
      `pprof:${uid}`,
      async () => {
        const r = await fetch(`/courses/${id}/users/${uid}`, { credentials: 'same-origin', headers: { Accept: 'text/html' } });
        if (!r.ok) throw Object.assign(new Error(`${r.status} profile`), { status: r.status });
        return parseProfile(await r.text());
      },
      (d) => {
        profiles.set(uid, d);
        emit();
      },
    ).catch(() => {
      // Not allowed, gone, or offline with nothing saved: no bio, and the rosters answer "shared".
      if (!profiles.has(uid)) profiles.set(uid, null);
      emit();
    });
    profLoading.set(uid, job);
    return job;
  }

  // ---------------------------------------------------------------- markup
  const COLORS = ['#1a73e8', '#d93025', '#188038', '#e8710a', '#9334e6', '#12a4af', '#c2185b', '#5f6368', '#b06000'];
  const tint = (p) => COLORS[Math.abs(Number(p.id) || [...String(p.name)].reduce((a, ch) => a + ch.charCodeAt(0), 0)) % COLORS.length];
  const firstChar = (s) => ([...String(s || '').trim()][0] || '?').toUpperCase();
  const avHtml = (p, size = '') =>
    p.av
      ? `<img class="gcx-pp-av ${size}" src="${esc(p.av)}" alt="" loading="lazy" decoding="async" data-l="${esc(firstChar(p.name))}" style="--t:${tint(p)}">`
      : `<span class="gcx-pp-av ${size}" style="--t:${tint(p)}" aria-hidden="true">${esc(firstChar(p.name))}</span>`;
  // Pictures that fail to load (here or in the person card) become the colored initial.
  document.addEventListener(
    'error',
    (e) => {
      const img = e.target;
      if (img.tagName !== 'IMG' || !img.classList.contains('gcx-pp-av')) return;
      const s = el(`<span class="${esc(img.className)}" style="${esc(img.getAttribute('style') || '')}" aria-hidden="true">${esc(img.dataset.l || '?')}</span>`);
      img.replaceWith(s);
    },
    true,
  );

  const qOf = (p) => [p.name, p.full, p.email, p.pro].filter(Boolean).join(' ').toLowerCase();
  const rowHtml = (p, i) => {
    const me = p.id === ME;
    const role = roleOf(p);
    const tag = me ? 'You' : role !== 'student' && role !== 'teacher' ? roleText(p) : p.custom || '';
    const sub = [p.pro, p.email].filter(Boolean).join(' · ');
    return `<button type="button" class="gcx-row gcx-pp-row" data-uid="${p.id}" data-q="${esc(qOf(p))}" style="--i:${Math.min(i, 14)}" aria-haspopup="dialog">
      ${avHtml(p)}
      <span class="gcx-row-main"><span class="gcx-row-title">${esc(p.name)}</span>${sub ? `<span class="gcx-row-sub">${esc(sub)}</span>` : ''}</span>
      ${tag ? `<span class="gcx-pp-tag${me ? ' me' : ''}">${esc(tag)}</span>` : ''}
    </button>`;
  };
  const stackHtml = (members, max = 5) => {
    if (!members || !members.length) return '';
    const shown = members.slice(0, max);
    const more = members.length - shown.length;
    return `<span class="gcx-pp-stack">${shown.map((m) => avHtml(m, 'sm')).join('')}${more > 0 ? `<span class="gcx-pp-av sm more">+${more}</span>` : ''}</span>`;
  };

  // ---------------------------------------------------------------- page
  let roster = null; // this course's people
  let byId = new Map();
  let groupsData = null;
  let course = null;

  view.classList.add('gcx-pp');
  view.innerHTML = `
    <div class="gcx-pp-bar">
      <span class="gcx-sync" hidden>${svg('sync', 18)}Updating</span>
      <label class="gcx-filter">${svg('search', 18)}<input type="text" placeholder="Search people" aria-label="Search people"></label>
    </div>
    <section class="gcx-pp-sec gcx-pp-teachers" style="--s:0">
      <div class="gcx-pp-h"><h2>Teachers</h2></div>
      <div class="gcx-pp-list"><div class="gcx-pad">${'<div class="gcx-skel w60"></div><div class="gcx-skel w40"></div>'}</div></div>
    </section>
    <section class="gcx-pp-sec gcx-pp-groups" style="--s:1" hidden></section>
    <section class="gcx-pp-sec gcx-pp-students" style="--s:2">
      <div class="gcx-pp-h"><h2>Classmates</h2><span class="gcx-pp-n"></span></div>
      <div class="gcx-pp-list"><div class="gcx-pad"><div class="gcx-skel w80"></div><div class="gcx-skel w60"></div><div class="gcx-skel w40"></div><div class="gcx-skel w80"></div></div></div>
    </section>`;
  const filter = view.querySelector('.gcx-filter input');
  const sync = view.querySelector('.gcx-sync');

  const paintCourse = (c) => {
    if (!c) return;
    course = c;
    view.style.setProperty('--c', c.color);
    if (panel) panel.el.style.setProperty('--c', c.color);
  };
  cPromise.then(paintCourse, () => {});
  coursesReady.then((list) => !course && paintCourse(list.find((c) => c.id === id)));

  let drawnOnce = false;
  function drawRoster(list, fromCache) {
    roster = list;
    byId = new Map(list.map((p) => [p.id, p]));
    keepRoster(id, list);
    const bySort = (a, b) => a.sort.localeCompare(b.sort, undefined, { sensitivity: 'base' });
    const staff = list.filter((p) => STAFF.has(roleOf(p))).sort((a, b) => RANK[roleOf(a)] - RANK[roleOf(b)] || bySort(a, b));
    const students = list.filter((p) => roleOf(p) === 'student').sort(bySort);
    const tSec = view.querySelector('.gcx-pp-teachers');
    const sSec = view.querySelector('.gcx-pp-students');
    tSec.querySelector('.gcx-pp-list').innerHTML = staff.length ? staff.map(rowHtml).join('') : '<div class="gcx-pp-none">No teachers listed.</div>';
    sSec.querySelector('.gcx-pp-list').innerHTML = students.length ? students.map(rowHtml).join('') : '<div class="gcx-pp-none">No classmates listed.</div>';
    sSec.querySelector('.gcx-pp-n').textContent = students.length ? `${students.length} ${students.length === 1 ? 'student' : 'students'}` : '';
    // Rows rise in one by one the first time only; later refreshes just swap.
    // Only a roster that had to wait on Canvas rises in; the saved copy just appears.
    const anim = !drawnOnce && !still() && performance.now() - T0 > 400;
    for (const s of [tSec, sSec]) s.classList.toggle('gcx-stagger', anim);
    drawnOnce = true;
    sync.hidden = !fromCache;
    if (groupsData) drawGroups();
    applyFilter();
    if (panel) panel.refresh();
  }

  function groupCard(g, i) {
    const members = (g.members || []).map((m) => byId.get(m.id) || m);
    const count = g.members ? members.length : g.count;
    const closed = gOpen.has(g.id) ? !gOpen.get(g.id) : !g.mine || members.length > 8;
    const q = [g.name, g.cat, ...members.map((m) => m.name)].join(' ').toLowerCase();
    const name = g.mine ? `<a class="gcx-pp-gname" href="/groups/${g.id}">${esc(g.name)}</a>` : `<span class="gcx-pp-gname">${esc(g.name)}</span>`;
    return `<div class="gcx-pp-group${g.mine ? ' mine' : ''}${closed ? ' closed' : ''}" data-gid="${g.id}" data-q="${esc(q)}" style="--i:${Math.min(i, 8)}">
      <div class="gcx-pp-ghead">
        <span class="gcx-pp-gic">${svg('people', 20)}</span>
        <span class="gcx-pp-gtx">${name}<small>${esc([g.cat, `${count} ${count === 1 ? 'member' : 'members'}`].filter(Boolean).join(' · '))}</small></span>
        ${stackHtml(members)}
        ${members.length ? `<button type="button" class="gcx-pp-gtoggle" aria-expanded="${!closed}" aria-label="${closed ? 'Show' : 'Hide'} members of ${esc(g.name)}">${svg('chevron', 20)}</button>` : ''}
      </div>
      ${members.length ? `<div class="gcx-collapse"><div class="gcx-collapse-in"><div class="gcx-pp-gmembers">${members.map(rowHtml).join('')}</div></div></div>` : ''}
    </div>`;
  }
  let othersOpen = false;
  const gOpen = new Map(); // group id -> opened/closed by him, kept across redraws
  function drawGroups() {
    const sec = view.querySelector('.gcx-pp-groups');
    const gs = (groupsData && groupsData.groups) || [];
    const mine = gs.filter((g) => g.mine);
    // Empty self-signup groups are just noise in a list of other people's groups.
    const others = gs.filter((g) => !g.mine && g.count > 0);
    if (!mine.length && !others.length) {
      sec.hidden = true;
      sec.innerHTML = '';
      return;
    }
    const byCat = new Map();
    for (const g of others) {
      const k = g.cat || 'Other groups';
      if (!byCat.has(k)) byCat.set(k, []);
      byCat.get(k).push(g);
    }
    sec.hidden = false;
    sec.innerHTML = `
      <div class="gcx-pp-h"><h2>Groups</h2><span class="gcx-pp-n">${mine.length ? `You're in ${mine.length}` : ''}</span></div>
      ${mine.length ? `<div class="gcx-pp-gsub">Your ${mine.length === 1 ? 'group' : 'groups'}</div><div class="gcx-pp-grid">${mine.map(groupCard).join('')}</div>` : ''}
      ${
        others.length
          ? `<button type="button" class="gcx-pp-more" aria-expanded="${othersOpen}">${svg('chevron', 20)}<span>${othersOpen ? 'Hide' : 'Show'} ${others.length} other ${others.length === 1 ? 'group' : 'groups'}</span></button>
             <div class="gcx-pp-others"${othersOpen ? '' : ' hidden'}>${[...byCat]
               .map(([cat, list]) => `<div class="gcx-pp-gsub">${esc(cat)}</div><div class="gcx-pp-grid">${list.map(groupCard).join('')}</div>`)
               .join('')}</div>`
          : ''
      }`;
    applyFilter();
  }

  view.addEventListener('click', (e) => {
    const more = e.target.closest('.gcx-pp-more');
    if (more) {
      othersOpen = !othersOpen;
      more.setAttribute('aria-expanded', String(othersOpen));
      more.querySelector('span').textContent = more.querySelector('span').textContent.replace(/^(Show|Hide)/, othersOpen ? 'Hide' : 'Show');
      view.querySelector('.gcx-pp-others').hidden = !othersOpen;
      return;
    }
    const ghead = e.target.closest('.gcx-pp-ghead');
    if (ghead && !e.target.closest('a')) {
      const card = ghead.parentElement;
      const t = card.querySelector('.gcx-pp-gtoggle');
      if (!t) return;
      const closed = card.classList.toggle('closed');
      gOpen.set(Number(card.dataset.gid), !closed);
      t.setAttribute('aria-expanded', String(!closed));
      t.setAttribute('aria-label', `${closed ? 'Show' : 'Hide'} members of ${card.querySelector('.gcx-pp-gname').textContent}`);
      return;
    }
    const row = e.target.closest('.gcx-pp-row');
    if (row) {
      const uid = Number(row.dataset.uid);
      if (panel && panel.uid === uid && panel.anchor === row) return closePanel();
      openPanel(uid, row);
    }
  });

  // Search: people rows by name/email/pronouns, group cards by name or any member.
  function applyFilter() {
    const q = filter.value.trim().toLowerCase();
    view.classList.toggle('gcx-filtering', !!q);
    for (const sec of view.querySelectorAll('.gcx-pp-teachers, .gcx-pp-students')) {
      let n = 0;
      for (const r of sec.querySelectorAll('.gcx-pp-list > .gcx-pp-row')) {
        const hit = !q || r.dataset.q.includes(q);
        r.hidden = !hit;
        if (hit) n++;
      }
      const list = sec.querySelector('.gcx-pp-list');
      let none = list.querySelector('.gcx-pp-nomatch');
      if (q && !n && list.querySelector('.gcx-pp-row')) {
        if (!none) list.append((none = el('<div class="gcx-pp-none gcx-pp-nomatch">No matches.</div>')));
      } else if (none) none.remove();
    }
    const gsec = view.querySelector('.gcx-pp-groups');
    if (gsec.innerHTML) {
      for (const g of gsec.querySelectorAll('.gcx-pp-group')) g.hidden = !!q && !g.dataset.q.includes(q);
      const others = gsec.querySelector('.gcx-pp-others');
      // While searching, matching groups that aren't his show without opening the list.
      if (others) others.hidden = !othersOpen && !q;
      for (const grid of gsec.querySelectorAll('.gcx-pp-grid')) {
        const sub = grid.previousElementSibling;
        const any = [...grid.children].some((c) => !c.hidden);
        grid.hidden = !any;
        if (sub && sub.classList.contains('gcx-pp-gsub')) sub.hidden = !any;
      }
    }
  }
  filter.addEventListener('input', applyFilter);

  // ---------------------------------------------------------------- person card
  let panel = null;
  function closePanel(refocus = false) {
    const p = panel;
    if (!p) return;
    panel = null;
    listeners.delete(p.refresh);
    document.removeEventListener('mousedown', p.outside, true);
    document.removeEventListener('keydown', p.onKey, true);
    removeEventListener('scroll', p.onMove, true);
    removeEventListener('resize', p.onMove);
    p.el.classList.add('gcx-out');
    setTimeout(() => p.el.remove(), still() ? 0 : 160);
    if (refocus && p.anchor && p.anchor.isConnected) p.anchor.focus({ preventScroll: true });
  }

  function openPanel(uid, anchor) {
    closePanel();
    const person = () => byId.get(uid) || findMember(uid) || { id: uid, name: 'Unknown', roles: [] };
    const p0 = person();
    const isMe = uid === ME;
    const pop = el(`<div class="gcx-pop-panel gcx-pp-card" role="dialog" aria-label="${esc(p0.name)}">
      <button type="button" class="gcx-pp-x" aria-label="Close">${svg('close', 18)}</button>
      <div class="gcx-pp-card-body">
        <div class="gcx-pp-card-top"></div>
        <div class="gcx-pp-card-who"></div>
        <div class="gcx-pp-bio-wrap" hidden><div class="gcx-pp-bio"></div><button type="button" class="gcx-pp-bio-more" hidden>more</button></div>
        <div class="gcx-pp-mail"></div>
        <div class="gcx-pp-shared"${isMe ? ' hidden' : ''}>
          <div class="gcx-pp-shared-h">Shared classes<span class="gcx-pp-shared-note"></span></div>
          <div class="gcx-pp-chips"></div>
        </div>
      </div>
    </div>`);
    if (course) pop.style.setProperty('--c', course.color);
    document.body.append(pop);
    // Redraws come with every roster that lands; only touch what changed, so focus and pictures stay put.
    const put = (node, markup) => {
      if (node.gcxM === markup) return false;
      node.gcxM = markup;
      node.innerHTML = markup;
      return true;
    };
    const scope = anchor.closest('.gcx-pp-group');
    const anchorSel = scope ? `.gcx-pp-group[data-gid="${scope.dataset.gid}"] .gcx-pp-row[data-uid="${uid}"]` : `.gcx-pp-list > .gcx-pp-row[data-uid="${uid}"]`;

    // Their groups in this course: from the group member lists, plus any group their profile page
    // names that's one of this course's groups.
    const groupsOf = () => {
      const prof = profiles.get(uid);
      const named = new Set(((prof && prof.groups) || []).map((g) => g.id));
      return ((groupsData && groupsData.groups) || []).filter((g) => named.has(g.id) || (g.members && g.members.some((m) => m.id === uid)));
    };

    const drawWho = () => {
      const p = person();
      pop.setAttribute('aria-label', p.name);
      const gs = groupsOf();
      const groupBits = gs.map((g) => (g.mine ? `<a href="/groups/${g.id}">${esc(g.name)}</a>` : esc(g.name)));
      const line = [roleText(p) ? esc(roleText(p)) : '', ...groupBits].filter(Boolean).join(' · ');
      const icons = isMe
        ? `<a class="gcx-pp-ic" href="/profile/settings" aria-label="Your profile settings" title="Your profile settings">${svg('gear', 16)}</a>`
        : `<a class="gcx-pp-ic" href="/conversations?user_id=${uid}&user_name=${encodeURIComponent(p.name)}&context_id=course_${id}" aria-label="Message ${esc(p.name)} in Canvas" title="Message in Canvas">${svg('inbox', 16)}</a>` +
          `<a class="gcx-pp-ic" href="/courses/${id}/users/${uid}" aria-label="Canvas profile" title="Canvas profile">${svg('open', 15)}</a>`;
      put(pop.querySelector('.gcx-pp-card-who'), `
        ${avHtml(p, 'xl')}
        <div class="gcx-pp-card-id">
          <div class="gcx-pp-card-name"><span class="gcx-pp-card-n"${p.full && p.full !== p.name ? ` title="${esc(p.full)}"` : ''}>${esc(p.name)}</span>${
            p.pro ? `<span class="gcx-pp-pro">${esc(p.pro)}</span>` : ''
          }${isMe ? '<span class="gcx-pp-tag me">You</span>' : ''}<span class="gcx-pp-ics">${icons}</span></div>
          ${line ? `<div class="gcx-pp-card-sub">${line}</div>` : ''}
        </div>`);
      put(
        pop.querySelector('.gcx-pp-mail'),
        p.email
          ? `<a class="gcx-pp-act" href="mailto:${esc(p.email)}">${svg('mail', 16)}<span>${esc(p.email)}</span></a><button type="button" class="gcx-pp-copy" aria-label="Copy email address" title="Copy">${copySvg}</button>`
          : '',
      );
    };

    // Bio, 3 lines with "more" when it runs longer. Never waits on anything else.
    const drawBio = () => {
      const prof = profiles.get(uid);
      const bio = (prof && prof.bio) || '';
      const wrap = pop.querySelector('.gcx-pp-bio-wrap');
      wrap.hidden = !bio;
      const box = wrap.querySelector('.gcx-pp-bio');
      if (!put(box, esc(bio))) return;
      wrap.classList.remove('open');
      const more = wrap.querySelector('.gcx-pp-bio-more');
      more.textContent = 'more';
      more.hidden = !bio || box.scrollHeight <= box.clientHeight + 1;
    };

    let rosterFallback = false;
    const chipHtml = (c) =>
      `<a class="gcx-pp-chip course${c.color ? '' : ' plain'}${still() ? '' : ' gcx-new'}" data-k="${c.id}|${esc(c.color || '')}" href="/courses/${c.id}"${
        c.color ? ` style="--c:${esc(c.color)}"` : ''
      } title="${esc(c.name || '')}"><i></i><span>${esc(prettyName(c) || c.name || 'Course')}</span></a>`;
    const drawShared = () => {
      if (isMe) return;
      const box = pop.querySelector('.gcx-pp-shared');
      const wrap = box.querySelector('.gcx-pp-chips');
      const noteEl = box.querySelector('.gcx-pp-shared-note');
      const prof = profiles.get(uid);
      let hits = [];
      let note = '';
      if (prof && prof.courses) {
        // Their profile's Enrollments list: dashboard classes first (in his order, with his colors), then the rest.
        const mine = myCourses || [];
        const theirs = prof.courses.filter((c) => c.id !== id);
        hits = [
          ...mine.filter((m) => theirs.some((c) => c.id === m.id)),
          ...theirs.filter((c) => !mine.some((m) => m.id === c.id)),
        ];
        if (!hits.length) note = 'None';
      } else if (!profiles.has(uid)) {
        note = 'Checking…';
      } else {
        // No readable profile page: intersect his other rosters.
        if (!rosterFallback) {
          rosterFallback = true;
          startMutual().then(() => panel && panel.el === pop && refresh(), () => {});
        }
        if (!otherCourses) note = 'Checking…';
        else {
          hits = otherCourses.filter((c) => rosters.has(c.id) && rosters.get(c.id).has(uid));
          const pending = otherCourses.filter((c) => !rosters.has(c.id) && /queued|loading/.test(rosterState.get(c.id) || 'queued')).length;
          const failed = otherCourses.filter((c) => rosterState.get(c.id) === 'err').length;
          note = !otherCourses.length
            ? 'None on your dashboard'
            : pending
              ? `Checking… ${otherCourses.length - pending}/${otherCourses.length}`
              : !hits.length
                ? failed === otherCourses.length
                  ? "Couldn't check"
                  : 'None'
                : failed
                  ? `${failed} couldn't be checked`
                  : '';
        }
      }
      // Chips only get added (each new one pops in) or dropped, never redrawn.
      // Keyed by id and color, so a chip drawn before his course colors arrived gets redrawn once.
      const key = (c) => `${c.id}|${c.color || ''}`;
      const want = hits.map(key);
      wrap.querySelectorAll('[data-k]').forEach((n) => !want.includes(n.dataset.k) && n.remove());
      for (const c of hits) if (!wrap.querySelector(`[data-k="${key(c)}"]`)) wrap.append(el(chipHtml(c)));
      if ([...wrap.children].map((n) => n.dataset.k).join() !== want.join()) for (const k of want) wrap.append(wrap.querySelector(`[data-k="${k}"]`));
      noteEl.textContent = note;
      noteEl.classList.toggle('busy', note.startsWith('Checking'));
    };

    // Next to the avatar of whatever was clicked; above it when there's no room below. Phones get a bottom sheet.
    let lastRect = null;
    const place = () => {
      if (innerWidth < 600) {
        pop.classList.add('gcx-pp-sheet');
        pop.style.left = pop.style.top = pop.style.bottom = '';
        return;
      }
      pop.classList.remove('gcx-pp-sheet');
      const a = panel && panel.anchor && panel.anchor.isConnected ? panel.anchor : null;
      const target = a && (a.querySelector('.gcx-pp-av') || a);
      const r = target ? target.getBoundingClientRect() : lastRect;
      if (!r) return;
      lastRect = r;
      const W = pop.offsetWidth;
      const H = pop.offsetHeight;
      pop.style.left = Math.max(12, Math.min(r.left - 8, innerWidth - W - 12)) + 'px';
      if (r.bottom + 8 + H <= innerHeight - 12 || r.top - 8 - H < 12) {
        pop.style.bottom = '';
        pop.style.top = Math.max(12, Math.min(r.bottom + 8, innerHeight - H - 12)) + 'px';
        pop.style.transformOrigin = 'top left';
      } else {
        // Anchored by its bottom so it grows upward as classes fill in.
        pop.style.top = 'auto';
        pop.style.bottom = innerHeight - (r.top - 8) + 'px';
        pop.style.transformOrigin = 'bottom left';
      }
    };
    let raf = 0;
    const onMove = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (panel && panel.el === pop) place();
      });
    };
    const refresh = () => {
      if (!panel || panel.el !== pop) return;
      if (panel.anchor && !panel.anchor.isConnected) {
        // A redraw replaced the row; follow the new one.
        const again = view.querySelector(anchorSel);
        if (again) panel.anchor = again;
      }
      drawWho();
      drawBio();
      drawShared();
      place();
    };
    const outside = (e) => {
      if (!pop.contains(e.target) && !(panel && panel.anchor && panel.anchor.contains(e.target))) closePanel();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') closePanel(true);
    };
    panel = { el: pop, uid, anchor, refresh, outside, onKey, onMove };
    pop.addEventListener('animationend', (e) => e.target.classList.remove('gcx-new'));
    pop.addEventListener('click', (e) => {
      if (e.target.closest('.gcx-pp-x')) return closePanel(true);
      const more = e.target.closest('.gcx-pp-bio-more');
      if (more) {
        const open = more.parentElement.classList.toggle('open');
        more.textContent = open ? 'less' : 'more';
        return place();
      }
      if (e.target.closest('.gcx-pp-copy')) {
        const mail = person().email;
        navigator.clipboard.writeText(mail).then(
          () => toast('Email copied'),
          () => toast("Couldn't copy"),
        );
      }
    });
    listeners.add(refresh);
    document.addEventListener('mousedown', outside, true);
    document.addEventListener('keydown', onKey, true);
    addEventListener('scroll', onMove, { capture: true, passive: true });
    addEventListener('resize', onMove);
    refresh();
    pop.querySelector('.gcx-pp-x').focus({ preventScroll: true });
    loadProfile(uid);
  }
  function findMember(uid) {
    for (const g of (groupsData && groupsData.groups) || []) {
      const m = (g.members || []).find((x) => x.id === uid);
      if (m) return { ...m, roles: [] };
    }
    return null;
  }

  // ---------------------------------------------------------------- load
  swr(`people:${id}`, (t) => fetchRoster(id, t), drawRoster)
    .then(() => (sync.hidden = true))
    .catch((e) => {
      console.warn('[canvas-classroom] people', e);
      closePanel();
      view.innerHTML = `<div class="gcx-err">Couldn't load people (${esc(e && e.message)}). <a href="/courses/${id}/users?gcx-original=1">Open the original Canvas page</a>.</div>`;
    });
  swr(`pgroups:${id}`, (t) => fetchGroups(id, t), (d) => {
    groupsData = d;
    if (roster) drawGroups();
    if (panel) panel.refresh();
  }).catch((e) => console.warn('[canvas-classroom] groups', e));
})();
