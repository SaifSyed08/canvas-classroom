// Runs at document_start: sets the layout classes before Canvas paints so the old
// nav never flashes. classroom.js reads the same classes and data attributes.
(() => {
  if (window.top !== window) return;
  const html = document.documentElement;
  const path = location.pathname;
  const q = new URLSearchParams(location.search);

  html.classList.add('gcx');
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
  try {
    const nav = JSON.parse(sessionStorage.getItem('gcx:nav') || 'null');
    sessionStorage.removeItem('gcx:nav');
    if (nav && Date.now() - nav.t < 15000) {
      html.dataset.gcxNav = nav.dir;
      // Which course tab he came from, so the underline can slide over from it.
      if (course && String(nav.course) === course[1] && nav.from >= 0) html.dataset.gcxFrom = nav.from;
    }
  } catch {}
  // Opt both pages in to cross-document view transitions. Lives in the page (not the
  // extension stylesheet) so Chrome counts it as the page's own.
  let still = false;
  try {
    still = (JSON.parse(localStorage.getItem('gcx:prefs') || '{}') || {}).motion === false;
  } catch {}
  if (still) html.classList.add('gcx-still');
  // Page pieces ease in one by one, except when sliding between a course's tabs.
  if (!still && html.dataset.gcxNav !== 'left' && html.dataset.gcxNav !== 'right') html.classList.add('gcx-enter');
  const vt = document.createElement('style');
  vt.id = 'gcx-vt';
  vt.textContent = '@media (prefers-reduced-motion: no-preference) { @view-transition { navigation: auto; } }';
  if (!still) html.append(vt);
  addEventListener('pagereveal', (e) => {
    if (e.viewTransition) e.viewTransition.finished.finally(() => delete html.dataset.gcxNav);
    else delete html.dataset.gcxNav;
  });
  if (view) {
    html.classList.add('gcx-takeover');
    html.dataset.gcxView = view;
  }
})();
