// Runs at document_start: sets the layout classes before Canvas paints so the old
// nav never flashes. classroom.js reads the same classes and data attributes.
(() => {
  if (window.top !== window) return;
  const html = document.documentElement;
  const path = location.pathname;
  const q = new URLSearchParams(location.search);

  html.classList.add('gcx');
  // The BetterCampus theme's colors from the last page (saved by classroom.js), so this page's
  // first frame is already dark or themed. BetterCampus's own styles take over when they load.
  try {
    const v = JSON.parse(localStorage.getItem('gcx:themevars') || 'null');
    if (v && v['--bcbackground-0']) {
      const decl = Object.entries(v)
        .filter(([k, x]) => /^--bc[a-z0-9-]+$/.test(k) && typeof x === 'string' && !/[{}<;]/.test(x))
        .map(([k, x]) => `${k}:${x}`)
        .join(';');
      const st = document.createElement('style');
      st.id = 'gcx-theme-early';
      st.textContent = `:root{${decl}}body{background:var(--bcbackground-image,var(--bcbackground-0)) center/cover fixed;color:var(--bctext-0)}`;
      html.append(st);
    }
  } catch {}
  try {
    if (localStorage.getItem('gcx:pinned') === 'true') html.classList.add('gcx-pinned');
  } catch {}

  const course = path.match(/^\/courses\/(\d+)(\/.*)?$/);
  if (course) {
    html.classList.add('gcx-course');
    html.dataset.gcxCourse = course[1];
  }

  // ?gcx-original=1 shows Canvas's own page instead of the replacement view.
  let view = '';
  if (!q.has('gcx-original')) {
    const rest = course ? course[2] || '/' : '';
    if (path === '/' && q.get('gcx') === 'todo') view = 'todo';
    else if (course && rest === '/') view = q.get('gcx') === 'classwork' ? 'classwork' : 'home';
    else if (course && /^\/modules\/?$/.test(rest)) view = 'classwork';
    else if (course && /^\/users\/?$/.test(rest)) view = 'people';
  }
  if (path === '/' && !view) {
    html.classList.add('gcx-dash');
    // Canvas's loading state stays hidden until our stand-in cards (or the real ones) are up.
    // The timer is a failsafe in case classroom.js never gets that far.
    html.classList.add('gcx-dash-wait');
    setTimeout(() => html.classList.remove('gcx-dash-wait'), 10000);
  }

  // Page transitions: the page we came from leaves a direction ('left'/'right' between
  // course tabs, 'in' when opening a class) and the view transition CSS reads it.
  // 'back' comes from the page he left with Back or Esc. `hero` is what he clicked (a class card or
  // a row), which grows into this page's banner or header.
  const takeNav = () => {
    try {
      const nav = JSON.parse(sessionStorage.getItem('gcx:nav') || 'null');
      sessionStorage.removeItem('gcx:nav');
      return nav && Date.now() - nav.t < 15000 ? nav : null;
    } catch {
      return null;
    }
  };
  const nav = takeNav();
  if (nav) {
    html.dataset.gcxNav = nav.dir;
    if (nav.hero) html.dataset.gcxHero = nav.hero;
    // Which course tab he came from, so the underline can slide over from it.
    if (course && String(nav.course) === course[1] && nav.from >= 0) html.dataset.gcxFrom = nav.from;
  }
  // Opt both pages in to cross-document view transitions. Lives in the page (not the
  // extension stylesheet) so Chrome counts it as the page's own.
  let still = false;
  try {
    still = (JSON.parse(localStorage.getItem('gcx:prefs') || '{}') || {}).motion === false;
  } catch {}
  if (still) html.classList.add('gcx-still');
  // Page pieces ease in one by one only when opening a class; anywhere else (like going back to
  // the dashboard) the page is just there, instead of washing in from white.
  if (!still && html.dataset.gcxNav === 'in') html.classList.add('gcx-enter');
  const vt = document.createElement('style');
  vt.id = 'gcx-vt';
  vt.textContent = '@media (prefers-reduced-motion: no-preference) { @view-transition { navigation: auto; } }';
  if (!still) html.append(vt);
  // Chrome snapshots this page for the page transition at pagereveal, before classroom.js has
  // run. Stand-ins for what stays put across pages (the rail, the course bar) and for what the
  // clicked thing grows into (the class banner, the assignment header) go in now, so the
  // transition has something to hold still or morph into. classroom.js and assignment.js take over
  // these same elements rather than replacing them (replacing one mid-transition would end it).
  const saved = (k) => {
    try {
      return JSON.parse(sessionStorage.getItem(k) || 'null');
    } catch {
      return null;
    }
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  let revealed = false;
  // Who's signed in, from Canvas's ENV (parsed by now), so another account's saved copy is never shown.
  const pageUser = () => {
    for (const sc of document.scripts) {
      if (sc.src) continue;
      const m = sc.textContent.match(/"current_user_id":"?(\d+)/);
      if (m) return m[1];
    }
    return '';
  };
  function standIns() {
    // Only for this page's first reveal: a page coming back from the back/forward cache already
    // has its live rail and view.
    if (revealed) return;
    revealed = true;
    // Pages classroom.js leaves alone (login, borderless tools) get none.
    if (!document.getElementById('header') || !document.getElementById('wrapper')) return;
    if (!document.getElementById('gcx-rail')) {
      const r = saved('gcx:rail');
      if (r && r.html) {
        const n = document.createElement('nav');
        n.id = 'gcx-rail';
        n.setAttribute('aria-label', 'Main');
        n.dataset.early = '';
        n.innerHTML = r.html;
        n.querySelectorAll('.on').forEach((x) => x.classList.remove('on'));
        document.body.append(n);
      }
    }
    const wrapper = document.getElementById('wrapper');
    if (course && wrapper && !document.getElementById('gcx-cbar')) {
      const b = saved('gcx:cbar');
      if (b && String(b.course) === course[1] && b.html) {
        const n = document.createElement('div');
        n.id = 'gcx-cbar';
        n.dataset.early = '';
        if (b.c) n.style.setProperty('--c', b.c);
        n.innerHTML = b.html;
        wrapper.prepend(n);
      }
    }
    const content = document.getElementById('content');
    if (!content) return;
    // Last visit's copy of this very page (saved by classroom.js on the way out), so the page
    // transition slides or grows into real content instead of an empty page. It's swapped for
    // the live view once the transition is over (classroom.js mountView).
    if (view && !document.getElementById('gcx-snap') && !document.getElementById('gcx-view')) {
      const s = saved('gcx:snap:' + location.pathname + location.search);
      if (s && s.html && s.user === pageUser()) {
        const n = document.createElement('div');
        n.id = 'gcx-snap';
        if (s.cls) n.className = s.cls;
        if (s.style) n.setAttribute('style', s.style);
        n.setAttribute('aria-hidden', 'true');
        n.inert = true;
        n.innerHTML = s.html;
        content.prepend(n);
        html.classList.remove('gcx-enter');
        return;
      }
    }
    if (!course) return;
    if (html.dataset.gcxHero === 'card' && view === 'home' && !document.getElementById('gcx-view')) {
      let list = [];
      try {
        list = JSON.parse(localStorage.getItem('gcx:courses') || '[]') || [];
      } catch {}
      const c = list.find((x) => String(x.id) === course[1]);
      if (!c) return;
      const v = document.createElement('div');
      v.id = 'gcx-view';
      v.dataset.early = '';
      if (c.color) v.style.setProperty('--c', c.color);
      v.innerHTML = `<div class="gcx-banner" data-early><div class="gcx-banner-img"></div><div class="gcx-banner-tx"><h1>${esc(c.name)}</h1><div>${esc([c.code, c.term].filter(Boolean).join(' · '))}</div></div></div>`;
      if (c.image) v.querySelector('.gcx-banner-img').style.backgroundImage = `url("${String(c.image).replace(/"/g, '%22')}")`;
      content.prepend(v);
    } else if (html.dataset.gcxHero === 'row' && /^\/assignments\/\d+\/?$/.test(course[2] || '') && !document.getElementById('gcx-asg')) {
      const t = nav && nav.title;
      if (!t) return;
      const sec = document.createElement('section');
      sec.id = 'gcx-asg';
      sec.dataset.early = '';
      sec.innerHTML = `<div class="gcx-asg-main"><div class="gcx-asg-head"><span class="gcx-asg-ic"></span><div class="gcx-asg-titles"><h1 class="gcx-asg-title">${esc(t)}</h1><div class="gcx-asg-by"></div></div></div></div>`;
      content.prepend(sec);
    }
  }
  addEventListener('pagereveal', (e) => {
    // A page coming back from the back/forward cache doesn't run this script again; the page he
    // left saved which way to go.
    if (!html.dataset.gcxNav) {
      const n = takeNav();
      if (n) html.dataset.gcxNav = n.dir;
    }
    const clear = () => {
      delete html.dataset.gcxNav;
      delete html.dataset.gcxHero;
    };
    if (e.viewTransition && document.body) {
      try {
        standIns();
      } catch {}
    }
    // classroom.js waits on this before swapping a stand-in for the live page.
    window.gcxTransition = e.viewTransition ? e.viewTransition.finished.catch(() => {}) : null;
    if (e.viewTransition) e.viewTransition.finished.finally(clear);
    else clear();
  });
  if (view) {
    html.classList.add('gcx-takeover');
    html.dataset.gcxView = view;
  }
})();
