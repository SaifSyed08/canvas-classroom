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
    else if (course && rest === '/') view = 'home';
    else if (course && /^\/modules\/?$/.test(rest)) view = 'classwork';
  }
  if (path === '/' && !view) html.classList.add('gcx-dash');
  if (view) {
    html.classList.add('gcx-takeover');
    html.dataset.gcxView = view;
  }
})();
