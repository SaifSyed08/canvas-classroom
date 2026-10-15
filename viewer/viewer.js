// In-page file viewer frame. fileview.js opens this page in an iframe over Canvas and
// drives it with postMessage: it renders PDFs with pdf.js (continuous scroll, lazy pages,
// zoom) or shows plain text. It reports page / zoom state back so the overlay's pill can show it.
import * as pdfjsLib from './pdfjs/pdf.min.mjs';

const params = new URLSearchParams(location.search);
const SRC = params.get('src') || '';
const ALT = params.get('alt') || '';
const MODE = params.get('mode') === 'text' ? 'text' : 'pdf';
const PARENT = params.get('o') || '';
const CANVAS_ORIGIN = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.instructure\.com$/i;
const FILE_HOSTS = /(^|\.)(instructure\.com|inscloudgate\.net|amazonaws\.com)$/i;
const PT = 96 / 72; // CSS px per PDF point at 100%
const STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];
const MIN_Z = 0.25;
const MAX_Z = 5;

const scroller = document.getElementById('scroller');
const pagesEl = document.getElementById('pages');
const textEl = document.getElementById('text');
const statusEl = document.getElementById('status');

// Only talk to the Canvas page that embedded us.
const ancestor = location.ancestorOrigins && location.ancestorOrigins[0];
const parentOk = CANVAS_ORIGIN.test(PARENT) && (!ancestor || ancestor === PARENT);
function post(msg) {
  if (parentOk && window.parent !== window) window.parent.postMessage({ gcxfv: 1, ...msg }, PARENT);
}

function setStatus(msg, ratio, err) {
  statusEl.querySelector('.msg').textContent = msg;
  if (ratio != null) statusEl.querySelector('.bar i').style.width = `${Math.round(ratio * 100)}%`;
  statusEl.classList.toggle('err', !!err);
  statusEl.classList.remove('gone');
}
const hideStatus = () => statusEl.classList.add('gone');
function fail(message) {
  setStatus(message, null, true);
  post({ type: 'error', message });
}

function allowed(u) {
  try {
    const x = new URL(u);
    return x.protocol === 'https:' && FILE_HOSTS.test(x.hostname);
  } catch {
    return false;
  }
}

// Fetch the file bytes, reporting progress. The signed public URL needs no cookies; the
// Canvas download URL (fallback) does.
async function fetchBytes() {
  const tries = [
    [SRC, 'omit'],
    [ALT, 'include'],
  ].filter(([u]) => u && allowed(u));
  if (!tries.length) throw new Error('This file link isn’t allowed.');
  let last;
  for (const [url, credentials] of tries) {
    try {
      const r = await fetch(url, { credentials });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const total = Number(r.headers.get('content-length')) || 0;
      if (!r.body || !total) return new Uint8Array(await r.arrayBuffer());
      const reader = r.body.getReader();
      const buf = new Uint8Array(total);
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (got + value.length > buf.length) {
          // Server lied about the length; fall back to concatenating.
          const bigger = new Uint8Array(Math.max(buf.length * 2, got + value.length));
          bigger.set(buf.subarray(0, got));
          return finishGrow(bigger, got, value, reader);
        }
        buf.set(value, got);
        got += value.length;
        setStatus('Loading…', got / total);
        post({ type: 'progress', ratio: got / total });
      }
      return buf.subarray(0, got);
    } catch (e) {
      last = e;
    }
  }
  throw last;
}
async function finishGrow(buf, got, first, reader) {
  const chunks = [buf.subarray(0, got), first];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

// ---------------------------------------------------------------- shared zoom state
let zoom = 1; // 1 = 100%
let fitMode = 'auto'; // 'auto' | 'width' | null (manual)
let pageCount = 0;
let currentPage = 1;

function sendState() {
  post({ type: 'state', page: currentPage, pages: pageCount, zoom, fit: fitMode });
}

// ---------------------------------------------------------------- PDF
const pages = []; // { n, w, h, div, canvas, pdfPage, rendered, task, near, text, links }
let pdf = null;

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./pdfjs/pdf.worker.min.mjs', import.meta.url).href;

async function openPdf() {
  setStatus('Loading…', 0);
  const data = await fetchBytes();
  setStatus('Opening…', 1);
  const task = pdfjsLib.getDocument({
    data,
    cMapUrl: new URL('./pdfjs/cmaps/', import.meta.url).href,
    cMapPacked: true,
    standardFontDataUrl: new URL('./pdfjs/standard_fonts/', import.meta.url).href,
    isEvalSupported: false,
  });
  task.onPassword = () => {
    task.destroy();
    fail('This PDF is password-protected. Download it to open it.');
  };
  pdf = await task.promise;
  pageCount = pdf.numPages;
  const first = await pdf.getPage(1);
  const vp = first.getViewport({ scale: 1 });
  const frag = document.createDocumentFragment();
  for (let n = 1; n <= pageCount; n++) {
    const div = document.createElement('div');
    div.className = 'page';
    div.dataset.n = n;
    div.style.setProperty('--w', vp.width);
    div.style.setProperty('--h', vp.height);
    div.innerHTML = '<div class="ph"></div>';
    frag.append(div);
    pages.push({ n, w: vp.width, h: vp.height, div, canvas: null, pdfPage: n === 1 ? first : null, rendered: 0, task: null, near: false, text: false, links: false });
  }
  pagesEl.append(frag);
  applyZoom(autoZoom(), null, 'auto');
  hideStatus();
  post({ type: 'ready', kind: 'pdf', pages: pageCount });
  requestAnimationFrame(() => pages.forEach((p, i) => setTimeout(() => p.div.classList.add('in'), Math.min(i, 6) * 40)));
  pages.forEach((p) => io.observe(p.div));
  scroller.focus({ preventScroll: true });
  sendState();
}

const contentWidth = () => scroller.clientWidth - 48;
function widthZoom() {
  const w = pages.length ? pages[0].w : 612;
  return clampZ(contentWidth() / (w * PT));
}
// Portrait pages fit the width up to a comfortable reading size; slides also fit the height.
function autoZoom() {
  const p = pages[0];
  if (!p) return 1;
  let z = Math.min(contentWidth(), 1000) / (p.w * PT);
  if (p.w > p.h) z = Math.min(contentWidth() / (p.w * PT), (scroller.clientHeight - 64) / (p.h * PT), 1400 / (p.w * PT));
  return clampZ(z);
}
const clampZ = (z) => Math.max(MIN_Z, Math.min(MAX_Z, z));

// Change zoom, keeping the point under (x, y) (scroller coords) where it was.
function applyZoom(z, anchor, mode = null) {
  z = clampZ(z);
  fitMode = mode;
  const old = zoom;
  let ref = null;
  if (anchor && pagesEl.children.length) {
    const el = pageAt(anchor.y) || pages[currentPage - 1]?.div;
    if (el) {
      const r = el.getBoundingClientRect();
      ref = { el, fx: (anchor.x - r.left) / r.width, fy: (anchor.y - r.top) / r.height };
    }
  } else if (pages.length && old !== z) {
    // Keep the current page's top-ish position when zooming from the pill.
    const el = pages[currentPage - 1].div;
    const r = el.getBoundingClientRect();
    const midY = scroller.clientHeight / 2;
    ref = { el, fx: 0.5, fy: (midY - r.top) / r.height, x: scroller.clientWidth / 2, y: midY };
  }
  zoom = z;
  if (MODE === 'pdf') pagesEl.style.setProperty('--scale-factor', z * PT);
  else textEl.style.setProperty('--zoom', z);
  if (ref) {
    const r2 = ref.el.getBoundingClientRect();
    const ax = anchor ? anchor.x : ref.x;
    const ay = anchor ? anchor.y : ref.y;
    scroller.scrollLeft += r2.left + ref.fx * r2.width - ax;
    scroller.scrollTop += r2.top + ref.fy * r2.height - ay;
  }
  scheduleRender();
  sendState();
}
function step(dir) {
  const cur = zoom;
  const next = dir > 0 ? STEPS.find((s) => s > cur + 0.001) ?? MAX_Z : [...STEPS].reverse().find((s) => s < cur - 0.001) ?? MIN_Z;
  applyZoom(next);
}
function pageAt(clientY) {
  for (const p of pages) {
    const r = p.div.getBoundingClientRect();
    if (clientY >= r.top - 8 && clientY <= r.bottom + 8) return p.div;
  }
  return null;
}

// Pages near the viewport get rendered; far ones drop their canvas to save memory.
const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      const p = pages[Number(e.target.dataset.n) - 1];
      p.near = e.isIntersecting;
      if (!p.near && p.canvas && pages.length > 12) {
        if (p.task) p.task.cancel();
        p.canvas.width = p.canvas.height = 0;
        p.canvas.remove();
        p.canvas = null;
        p.rendered = 0;
        p.div.classList.remove('rendered');
      }
    }
    scheduleRender();
  },
  { root: scroller, rootMargin: '1200px 0px' },
);

let renderTimer = 0;
let rendering = false;
function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(pump, 120);
}
async function pump() {
  if (rendering || !pdf) return;
  rendering = true;
  try {
    for (;;) {
      const scale = zoom * PT;
      const todo = pages
        .filter((p) => p.near && p.rendered !== scale)
        .sort((a, b) => Math.abs(a.n - currentPage) - Math.abs(b.n - currentPage));
      if (!todo.length) break;
      await renderPage(todo[0], scale);
    }
  } finally {
    rendering = false;
  }
}
async function renderPage(p, scale) {
  if (!p.pdfPage) {
    p.pdfPage = await pdf.getPage(p.n);
    const vp1 = p.pdfPage.getViewport({ scale: 1 });
    if (vp1.width !== p.w || vp1.height !== p.h) {
      p.w = vp1.width;
      p.h = vp1.height;
      p.div.style.setProperty('--w', p.w);
      p.div.style.setProperty('--h', p.h);
    }
  }
  const vp = p.pdfPage.getViewport({ scale });
  // Stay under ~16 MP per canvas so huge zooms don't blow up memory.
  let out = window.devicePixelRatio || 1;
  const maxPx = 16_000_000;
  if (vp.width * vp.height * out * out > maxPx) out = Math.sqrt(maxPx / (vp.width * vp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(vp.width * out);
  canvas.height = Math.floor(vp.height * out);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (p.task) p.task.cancel();
  p.task = p.pdfPage.render({ canvasContext: ctx, viewport: vp, transform: out !== 1 ? [out, 0, 0, out, 0, 0] : null });
  try {
    await p.task.promise;
  } catch (e) {
    if (e && e.name === 'RenderingCancelledException') return;
    throw e;
  } finally {
    p.task = null;
  }
  // Swap in the new canvas in one go so zooming never flashes blank.
  if (p.canvas) p.canvas.replaceWith(canvas);
  else p.div.prepend(canvas);
  p.canvas = canvas;
  p.rendered = scale;
  p.div.classList.add('rendered');
  if (!p.text) {
    p.text = true;
    addTextLayer(p).catch(() => {});
  }
  if (!p.links) {
    p.links = true;
    addLinks(p).catch(() => {});
  }
}
async function addTextLayer(p) {
  const div = document.createElement('div');
  div.className = 'textLayer';
  p.div.append(div);
  const layer = new pdfjsLib.TextLayer({ textContentSource: p.pdfPage.streamTextContent(), container: div, viewport: p.pdfPage.getViewport({ scale: 1 }) });
  await layer.render();
}
// Link annotations: web links open in a new tab, internal ones scroll to their page.
async function addLinks(p) {
  const annots = await p.pdfPage.getAnnotations({ intent: 'display' });
  const vp = p.pdfPage.getViewport({ scale: 1 });
  for (const a of annots) {
    if (a.subtype !== 'Link' || (!a.url && !a.dest)) continue;
    const [x1, y1, x2, y2] = vp.convertToViewportRectangle(a.rect);
    const l = Math.min(x1, x2), t = Math.min(y1, y2), w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
    const link = document.createElement('a');
    link.className = 'lnk';
    link.style.cssText = `left:calc(var(--scale-factor)*${l}px);top:calc(var(--scale-factor)*${t}px);width:calc(var(--scale-factor)*${w}px);height:calc(var(--scale-factor)*${h}px)`;
    if (a.url && /^(https?:|mailto:)/i.test(a.url)) {
      link.href = a.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.title = a.url;
    } else if (a.dest) {
      link.href = '#';
      link.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          const dest = typeof a.dest === 'string' ? await pdf.getDestination(a.dest) : a.dest;
          if (!dest) return;
          const idx = typeof dest[0] === 'object' ? await pdf.getPageIndex(dest[0]) : dest[0];
          goto(idx + 1);
        } catch {}
      });
    } else continue;
    p.div.append(link);
  }
}

function goto(n) {
  const p = pages[Math.max(1, Math.min(pageCount, n)) - 1];
  if (!p) return;
  scroller.scrollTo({ top: p.div.offsetTop - 16, behavior: Math.abs(n - currentPage) > 8 ? 'auto' : 'smooth' });
}

// Current page = the one covering the middle of the viewport.
let scrollRaf = 0;
scroller.addEventListener(
  'scroll',
  () => {
    if (scrollRaf || !pages.length) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      const mid = scroller.scrollTop + scroller.clientHeight / 3;
      let n = currentPage;
      // pages are in order; binary search on offsetTop
      let lo = 0, hi = pages.length - 1;
      while (lo <= hi) {
        const m = (lo + hi) >> 1;
        if (pages[m].div.offsetTop <= mid) {
          n = m + 1;
          lo = m + 1;
        } else hi = m - 1;
      }
      if (n !== currentPage) {
        currentPage = n;
        sendState();
      }
    });
  },
  { passive: true },
);

// ---------------------------------------------------------------- text
async function openText() {
  setStatus('Loading…', 0);
  const bytes = await fetchBytes();
  const max = 3 * 1024 * 1024;
  let text = new TextDecoder().decode(bytes.subarray(0, max));
  if (bytes.length > max) text += '\n\n… (file truncated; download it to see the rest)';
  textEl.textContent = text;
  textEl.hidden = false;
  hideStatus();
  pageCount = 0;
  post({ type: 'ready', kind: 'text' });
  scroller.focus({ preventScroll: true });
  sendState();
}

// ---------------------------------------------------------------- input
scroller.addEventListener(
  'wheel',
  (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0025));
    applyZoom(zoom * f, { x: e.clientX, y: e.clientY });
  },
  { passive: false },
);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    post({ type: 'key', key: 'Escape' });
  } else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
    e.preventDefault();
    step(1);
  } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
    e.preventDefault();
    step(-1);
  } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
    e.preventDefault();
    applyZoom(MODE === 'pdf' ? autoZoom() : 1, null, 'auto');
  } else if (MODE === 'pdf' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    // Left/Right flip pages; on a slide deck at its fitted size, Up/Down do too.
    const slides = fitMode === 'auto' && pages[0] && pages[0].w > pages[0].h;
    if (e.key === 'ArrowRight' || (slides && e.key === 'ArrowDown')) {
      e.preventDefault();
      goto(currentPage + 1);
    } else if (e.key === 'ArrowLeft' || (slides && e.key === 'ArrowUp')) {
      e.preventDefault();
      goto(currentPage - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      goto(1);
    } else if (e.key === 'End') {
      e.preventDefault();
      goto(pageCount);
    }
  }
});
// A click on the dark space around the pages closes the viewer (like Drive).
let downOnBackdrop = false;
scroller.addEventListener('mousedown', (e) => {
  downOnBackdrop = e.button === 0 && !e.target.closest('.page, #text');
});
scroller.addEventListener('click', (e) => {
  if (downOnBackdrop && !e.target.closest('.page, #text') && !String(window.getSelection() || '')) post({ type: 'backdrop' });
  downOnBackdrop = false;
});

window.addEventListener('message', (e) => {
  if (e.source !== window.parent || e.origin !== PARENT || !parentOk) return;
  const m = e.data || {};
  if (m.gcxfv !== 1) return;
  if (m.type === 'zoom') step(m.dir);
  else if (m.type === 'fit' && m.reset) applyZoom(MODE === 'pdf' ? autoZoom() : 1, null, 'auto');
  else if (m.type === 'fit') applyZoom(MODE === 'pdf' ? (fitMode === 'width' ? autoZoom() : widthZoom()) : 1, null, MODE === 'pdf' ? (fitMode === 'width' ? 'auto' : 'width') : 'auto');
  else if (m.type === 'setZoom') applyZoom(Number(m.zoom) || 1);
  else if (m.type === 'goto') goto(Number(m.page) || 1);
  else if (m.type === 'focus') scroller.focus({ preventScroll: true });
});

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (fitMode === 'auto') applyZoom(MODE === 'pdf' ? autoZoom() : zoom, null, 'auto');
    else if (fitMode === 'width') applyZoom(widthZoom(), null, 'width');
  }, 120);
});

if (!parentOk) fail('This viewer only opens from Canvas.');
else (MODE === 'text' ? openText() : openPdf()).catch((e) => fail(`Couldn’t open this file (${(e && e.message) || e}).`));
