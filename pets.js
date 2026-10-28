// Pets: a Codex pet (from codex-pets.net, or one he imported) living along the bottom of every
// Canvas page.
//
// Sheets are Codex pet atlases: 8 columns of 192x208 cells, 9 rows (v1) or 11 rows (v2), one
// animation per row, 260 ms a frame. The behaviour follows Saif's TAILS pet (ChatPet.tsx and
// pet-motion.ts): same rows, same gravity, throw cap, bounce and drag, same wander and glance
// timings, same "resting states breathe, moments are brisk" frame rates.
//
// background.js fetches the library's pages and the sheet (codex-pets.net sends no CORS headers),
// takes in imported pets, and keeps sheets in chrome.storage.local. Prefs live in localStorage 'gcx:pets'; where the pet is
// lives in sessionStorage so it carries on from the same spot on the next page.
(() => {
  if (window.__gcxPets || window.top !== window) return;
  window.__gcxPets = true;
  const html = document.documentElement;

  // ---------------------------------------------------------------- sheet layout (Codex)
  const COLS = 8;
  const FRAME_MS = 260;
  const ROWS = {
    idle: [0, 6],
    'running-right': [1, 8],
    'running-left': [2, 8],
    waving: [3, 4],
    jumping: [4, 5],
    failed: [5, 8],
    waiting: [6, 6],
    running: [7, 6],
    review: [8, 6],
    'look-right-side': [9, 8],
    'look-left-side': [10, 8],
  };
  // Resting states breathe; reactions are brisk (TAILS sprite-rate.ts). Sleep is slower still.
  const RATE = { idle: 0.85, waiting: 1, sleep: 0.5, held: 0.9 };
  const ACTIVE_RATE = 1.35;

  // ---------------------------------------------------------------- feel (TAILS pet-motion.ts)
  const BASE_H = 96; // cell height on screen at 100%
  const WALK = 120; // px/s at 100%
  const GRAVITY = 2600;
  const BOUNCE = 0.5;
  const AIR_DRAG = 0.6;
  const GROUND_DRAG = 6;
  const REST_SPEED = 12;
  const MAX_STEP = 0.05;
  const MAX_THROW = 2400;
  const WANDER_MIN = 3500;
  const WANDER_MAX = 9000;
  const LEAP_CHANCE = 0.35; // on a class card, how often a walk is to its edge for a leap
  const LEAP_SEL = '.ic-DashboardCard';
  const GLANCE_MIN = 4000;
  const GLANCE_MAX = 11000;
  const GLANCE_MS = 1100;
  const REACTION_MS = 1200;
  const PAT_MS = 420;
  const PAT_REACTION_MS = 1400;
  const DROWSY_MS = 60e3;
  const SLEEP_MS = 120e3;
  const PERCH_SEL = '.ic-DashboardCard, .gcx-ann, .gcx-post';

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const now = () => performance.now();

  // ---------------------------------------------------------------- prefs
  const PREFS_KEY = 'gcx:pets';
  const DEFAULTS = { on: false, id: null, name: '', sheet: '', thumb: '', ver: 1, desc: '', size: 1, roam: true, walk: 1, remind: true, sound: false, volume: 1 };
  const readPrefs = () => {
    let p;
    try {
      p = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
    } catch {
      return { ...DEFAULTS };
    }
    // A pet from the old openpets.dev library can't be fetched any more: pick again.
    if (p.sheet && p.sheet !== 'mine' && !p.sheet.startsWith('https://codex-pets.net/'))
      Object.assign(p, { on: false, id: null, name: '', sheet: '', thumb: '', desc: '' });
    return p;
  };
  let prefs = readPrefs();
  const savePrefs = (patch) => {
    prefs = { ...prefs, ...patch };
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {}
    apply();
  };
  // Another tab changed them.
  window.addEventListener('storage', (e) => {
    if (e.key !== PREFS_KEY) return;
    prefs = readPrefs();
    if (out) out.gain.value = volume();
    apply();
  });

  const reducedMq = matchMedia('(prefers-reduced-motion: reduce)');
  const calm = () => reducedMq.matches || !!(window.gcx && window.gcx.prefs && window.gcx.prefs().motion === false);

  // A service worker that is just waking up can drop the first message, so that is retried once.
  const ask = (msg, retry = 1) =>
    new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage({ type: 'gcxPets', ...msg }, (r) => {
          const err = chrome.runtime.lastError;
          if (err && retry > 0) return setTimeout(() => ask(msg, retry - 1).then(resolve, reject), 800);
          if (err) return reject(new Error(err.message));
          if (!r || r.error) return reject(new Error((r && r.error) || 'no answer'));
          resolve(r);
        });
      } catch (e) {
        reject(e); // extension reloaded under the page
      }
    });

  // ---------------------------------------------------------------- sound (off by default)
  // Chrome keeps a page's audio suspended until someone clicks or types on it, so the context is
  // made (or woken) on the first click or key, not when he first lands, which is usually unprompted.
  let actx = null;
  let out = null; // every sound goes here: his volume, then a limiter so a hard landing never clips
  const volume = () => Math.max(0, Math.min(2, Number(prefs.volume) >= 0 ? Number(prefs.volume) : 1));
  // How much he walks (the slider): walks come this many times as often and go a bit further, and he
  // stays up longer before getting drowsy.
  const energy = () => Math.max(0.25, Math.min(3, Number(prefs.walk) || 1));
  const drowsyMs = () => DROWSY_MS * Math.max(1, energy());
  const sleepMs = () => SLEEP_MS * Math.max(1, energy());
  let hush = 0;
  let suspending = false;
  // For a sound: the context if a click or key has made one. Sounds scheduled while it is still
  // waking up play the moment it does. It goes back to sleep 12 s after the last sound.
  const audio = () => {
    if (!prefs.sound || !actx || document.hidden) return null;
    if (actx.state !== 'running' || suspending) actx.resume().catch(() => {});
    clearTimeout(hush);
    hush = setTimeout(() => {
      if (!actx || actx.state !== 'running') return;
      suspending = true;
      actx
        .suspend()
        .catch(() => {})
        .finally(() => (suspending = false));
    }, 12000);
    return actx;
  };
  const unlock = () => {
    if (!prefs.sound || actx) return;
    try {
      actx = new AudioContext();
      const limit = actx.createDynamicsCompressor();
      limit.threshold.value = -10;
      limit.ratio.value = 8;
      limit.connect(actx.destination);
      out = actx.createGain();
      out.gain.value = volume();
      out.connect(limit);
      audio();
    } catch {
      actx = null;
    }
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
  // A knock you can hear on laptop speakers (which play little below ~200 Hz): a short pitch drop
  // with some body, plus a tick of filtered noise for the contact. Harder landings are louder and
  // start higher.
  function thud(force) {
    const ctx = audio();
    const s = clamp(force, 0, 1);
    if (!ctx || s < 0.06) return;
    const t = ctx.currentTime;
    const d = 0.16;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(260 + s * 220, t);
    o.frequency.exponentialRampToValueAtTime(70, t + d);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0, t);
    og.gain.linearRampToValueAtTime(0.22 + s * 0.34, t + 0.005);
    og.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(og).connect(out);
    o.start(t);
    o.stop(t + d + 0.01);
    const n = Math.ceil(ctx.sampleRate * 0.04);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900 + s * 900;
    f.Q.value = 0.9;
    const ng = ctx.createGain();
    ng.gain.value = 0.1 + s * 0.24;
    src.connect(f).connect(ng).connect(out);
    src.start(t);
  }
  // A footstep: a soft padded pat, low in volume. A round sine "pum" (pitched high enough for
  // laptop speakers) with a gentle attack, plus a whisper of muffled noise for the scuff; the two
  // feet a little apart in pitch so a walk sounds like left, right, left.
  function stepSound(side) {
    const ctx = audio();
    if (!ctx) return;
    const t = ctx.currentTime + 0.005;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(side ? 520 : 460, t);
    o.frequency.exponentialRampToValueAtTime(side ? 260 : 230, t + 0.07);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0, t);
    og.gain.linearRampToValueAtTime(0.05, t + 0.008);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(og).connect(out);
    o.start(t);
    o.stop(t + 0.1);
    const n = Math.ceil(ctx.sampleRate * 0.05);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / n) * (1 - i / n);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1100;
    f.Q.value = 0.5;
    const ng = ctx.createGain();
    ng.gain.value = 0.035;
    src.connect(f).connect(ng).connect(out);
    src.start(t);
  }
  // A talking blip, one per couple of letters while a reminder types out: a tiny square-wave beep.
  function blip() {
    const ctx = audio();
    if (!ctx) return;
    const t = ctx.currentTime + 0.003;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(620 + Math.random() * 140, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.016, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.06);
  }
  // A snore: a quiet, fluttering breath in, matching the slow breathing in pets.css.
  function snore() {
    const ctx = audio();
    if (!ctx) return;
    const t = ctx.currentTime;
    const d = 1.2;
    const n = Math.ceil(ctx.sampleRate * d);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (0.55 + 0.45 * Math.sin((2 * Math.PI * 26 * i) / ctx.sampleRate));
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 420;
    f.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(f).connect(g).connect(out);
    src.start(t);
  }
  // Thrown: a breathy whoosh, falling in pitch, louder and longer the harder the throw.
  function whoosh(force) {
    const ctx = audio();
    const s = clamp(force, 0, 1);
    if (!ctx || s < 0.2) return;
    const t = ctx.currentTime;
    const d = 0.22 + s * 0.18;
    const n = Math.ceil(ctx.sampleRate * d);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.6;
    f.frequency.setValueAtTime(900 + s * 900, t);
    f.frequency.exponentialRampToValueAtTime(380, t + d);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05 + s * 0.09, t + d * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(f).connect(g).connect(out);
    src.start(t);
  }
  function chirp() {
    const ctx = audio();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    [523.25, 659.25].forEach((hz, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      const t = t0 + i * 0.07;
      o.frequency.setValueAtTime(hz, t);
      if (i) o.frequency.linearRampToValueAtTime(hz * 1.06, t + 0.12);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.12);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.14);
    });
  }

  // ---------------------------------------------------------------- the sheet
  // Loaded once per page from chrome.storage.local, then redrawn at the size it is shown at
  // (cell height x devicePixelRatio), which keeps it sharp and keeps a 1536x2288 atlas out of
  // memory for the rest of the visit.
  let sheet = null; // { id, rows, ver, cellW, cellH, bitmap, url, scaledFor, box:{x0,y0,x1,y1} in cell px }
  let loading = null;

  async function loadSheet(p) {
    const key = 'gcxPetSheet:' + p.id;
    let rec = (await chrome.storage.local.get(key))[key];
    if (!rec || !rec.dataUrl) {
      await ask({ op: 'sheet', id: p.id, url: p.sheet });
      rec = (await chrome.storage.local.get(key))[key];
    }
    if (!rec || !rec.dataUrl) throw new Error('sheet missing');
    const blob = await (await fetch(rec.dataUrl)).blob();
    const bitmap = await createImageBitmap(blob);
    const cellW = bitmap.width / COLS;
    // 9 or 11 rows; trust the image over the catalogue.
    let rows = Math.round(bitmap.height / (cellW * (208 / 192)));
    if (rows !== 9 && rows !== 11) rows = p.ver === 2 ? 11 : 9;
    const cellH = bitmap.height / rows;
    return { id: p.id, rows, ver: rows === 11 ? 2 : 1, cellW, cellH, bitmap, url: '', scaledFor: 0, box: opaqueBox(bitmap, cellW, cellH, rows === 11 ? 7 : 6) };
  }
  // The union of the idle frames' painted pixels: where his body is inside the cell. Used for
  // the hit area, for standing his feet on the floor, and for touching walls with his body.
  function opaqueBox(bitmap, cellW, cellH, frames) {
    const k = 4;
    const w = Math.max(1, Math.round((cellW * frames) / k));
    const h = Math.max(1, Math.round(cellH / k));
    const fallback = { x0: cellW * 0.2, y0: cellH * 0.2, x1: cellW * 0.8, y1: cellH * 0.96 };
    try {
      const c = new OffscreenCanvas(w, h);
      const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(bitmap, 0, 0, cellW * frames, cellH, 0, 0, w, h);
      const d = x.getImageData(0, 0, w, h).data;
      const cw = w / frames;
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let yy = 0; yy < h; yy++)
        for (let xx = 0; xx < w; xx++) {
          if (d[(yy * w + xx) * 4 + 3] < 48) continue;
          const cx = xx % cw;
          if (cx < x0) x0 = cx;
          if (cx > x1) x1 = cx;
          if (yy < y0) y0 = yy;
          if (yy > y1) y1 = yy;
        }
      if (x1 < 0) return fallback;
      const sx = cellW / cw;
      const sy = cellH / h;
      return { x0: x0 * sx, y0: y0 * sy, x1: (x1 + 1) * sx, y1: (y1 + 1) * sy };
    } catch {
      return fallback;
    }
  }
  let rescaleTimer = 0;
  async function rescale() {
    if (!sheet) return;
    const cellPx = devH();
    if (sheet.scaledFor === cellPx) return;
    const s = sheet;
    const cw = devW();
    const w = cw * COLS;
    const h = cellPx * s.rows;
    const current = () => sheet === s && devH() === cellPx;
    const use = (url) => {
      if (!current()) return URL.revokeObjectURL(url);
      if (s.url) URL.revokeObjectURL(s.url);
      s.url = url;
      s.scaledFor = cellPx;
      if (ui) ui.sprite.style.backgroundImage = `url("${url}")`;
      lastFrameKey = '';
      render();
    };
    // The browser's own shrink first, so he shows up at once; then the sharp one (background.js)
    // swaps in when it's ready. Growing past the sheet's size stays with the browser's.
    try {
      const c = new OffscreenCanvas(w, h);
      const x = c.getContext('2d');
      x.imageSmoothingQuality = 'high';
      x.drawImage(s.bitmap, 0, 0, w, h);
      use(URL.createObjectURL(await c.convertToBlob({ type: 'image/png' })));
    } catch {}
    if (!current() || w > s.bitmap.width || h > s.bitmap.height) return;
    ask({ op: 'scaled', id: s.id, w, h, cw, ch: cellPx })
      .then(async (r) => r.data && current() && use(URL.createObjectURL(await (await fetch(r.data)).blob())))
      .catch(() => {});
  }

  // ---------------------------------------------------------------- geometry
  // Sizes are whole screen (device) pixels, and the redrawn sheet is exactly that size, so each
  // frame is shown 1:1 instead of being resampled again (which blurs it at 125% or 150% scaling).
  const dpr = () => Math.min(window.devicePixelRatio || 1, 3);
  const devH = () => Math.max(16, Math.round(BASE_H * clamp(prefs.size || 1, 0.4, 1.6) * dpr()));
  const devW = () => (sheet ? Math.round(devH() * (sheet.cellW / sheet.cellH)) : devH());
  const dispH = () => devH() / dpr();
  const dispW = () => devW() / dpr();
  // A position on a whole screen pixel: in between, the browser smooths the sprite.
  const snap = (v) => Math.round(v * dpr()) / dpr();
  const sc = () => (sheet ? dispH() / sheet.cellH : 1); // cell px -> screen px
  const body = () => {
    const b = sheet ? sheet.box : { x0: 38, y0: 42, x1: 154, y1: 200 };
    const s = sc();
    return { l: b.x0 * s, t: b.y0 * s, r: b.x1 * s, b: b.y1 * s, w: (b.x1 - b.x0) * s, h: (b.y1 - b.y0) * s };
  };
  const vw = () => html.clientWidth || innerWidth;
  const vh = () => innerHeight;

  // ---------------------------------------------------------------- state
  // x: left edge of his body on screen. y: where his feet are. Both viewport px.
  const m = {
    x: 0, y: 0, vx: 0, vy: 0, target: null, facing: 'right', held: false, perch: null,
    gesture: null, gestureUntil: 0, squash: null, swing: 0, swingV: 0,
    sleeping: false, hovered: false,
  };
  let ui = null;
  let frame = 0;
  let playing = '';
  let lastFrameKey = '';
  let lastActive = Date.now();
  let typingUntil = 0;
  let caretX = null;
  let nextWander = 0;
  let nextGlance = 0;
  let nextSnore = 0;
  let wavedAt = 0;
  let pointer = { x: -1e4, y: -1e4 };

  const groundY = () => (m.perch ? m.perch.top : vh());
  const maxX = () => Math.max(0, vw() - body().w);
  const onGround = () => !m.held && m.vy === 0 && Math.abs(m.y - groundY()) < 0.5;

  function gesture(name, ms) {
    m.gesture = name;
    m.gestureUntil = Date.now() + ms;
    render();
  }
  function fx(cls, text, dx) {
    if (!ui) return;
    const s = document.createElement('span');
    s.className = cls;
    s.textContent = text;
    if (dx) s.style.setProperty('--dx', dx + 'px');
    ui.fx.append(s);
    setTimeout(() => s.remove(), 2600);
  }
  // A short jelly wobble: amount, which side the hit came from, and when.
  function squash(amount, side) {
    if (calm()) return;
    m.squash = { a: clamp(amount, 0.06, 0.42), side, t: now() };
    wake();
  }
  function hop(vy, vx = 0) {
    if (calm() || m.held) return;
    m.vy = -vy * Math.sqrt(clamp(prefs.size, 0.4, 1.6));
    if (vx) m.vx = vx;
    m.target = null;
    m.leap = null;
    wake();
  }

  // Which row to play, most specific first (TAILS ChatPet's order): being carried, falling,
  // walking, a reaction he owes someone, the user typing, hovering, asleep, idle.
  function stateNow() {
    const t = Date.now();
    const has = (n) => sheet && ROWS[n][0] < sheet.rows;
    const look = (dir) => (has(`look-${dir}-side`) ? `look-${dir}-side` : 'review');
    if (m.held) return Math.abs(m.vx) > 120 ? (m.vx < 0 ? 'running-left' : 'running-right') : 'waiting';
    if (m.vy !== 0 || m.y < groundY() - 1) return 'jumping';
    if (m.target !== null || Math.abs(m.vx) > 30) return (m.target !== null ? m.target < m.x : m.vx < 0) ? 'running-left' : 'running-right';
    if (m.gesture && t < m.gestureUntil) return m.gesture.startsWith('look-') ? look(m.gesture.slice(5, -5)) : m.gesture;
    if (t < typingUntil) {
      if (caretX == null) return 'review';
      const mid = m.x + body().w / 2;
      return Math.abs(caretX - mid) > 160 ? look(caretX < mid ? 'left' : 'right') : 'review';
    }
    if (m.working) return has('running') ? 'running' : 'review';
    if (m.hovered) return 'waving';
    if (m.sleeping) return 'sleep';
    // Nobody has touched anything for a minute: he waits, then (above) dozes off.
    if (t - lastActive > drowsyMs()) return 'waiting';
    return 'idle';
  }

  // ---------------------------------------------------------------- render
  function render() {
    if (!ui || !sheet) return;
    const st = stateNow();
    if (st !== playing) {
      playing = st;
      frame = 0;
      restartTicker();
      // Landed sliding (thrown, or a leap): the first step at once, not a frame later.
      if ((st === 'running-left' || st === 'running-right') && m.target === null && onGround()) footstep();
    }
    const rowName = st === 'sleep' ? 'idle' : st;
    const [row, count0] = ROWS[rowName] && ROWS[rowName][0] < sheet.rows ? ROWS[rowName] : ROWS.idle;
    const count = row === 0 && sheet.ver === 2 ? 7 : count0;
    // Asleep: the idle pose held still, breathing slowly (pets.css), with z's floating up.
    const f = st === 'sleep' ? 0 : frame % count;
    ui.pet.classList.toggle('gcx-pet-asleep', st === 'sleep');
    const H = dispH();
    const W = dispW();
    const b = body();
    const left = m.x - b.l;
    const top = m.y - b.b;
    ui.pet.style.transform = `translate3d(${snap(left)}px, ${snap(top)}px, 0)`;
    const key = `${W}x${H}:${row}:${f}`;
    if (key !== lastFrameKey) {
      lastFrameKey = key;
      ui.pet.style.width = W + 'px';
      ui.pet.style.height = H + 'px';
      ui.sprite.style.backgroundSize = `${W * COLS}px ${H * sheet.rows}px`;
      ui.sprite.style.backgroundPosition = `${-f * W}px ${-row * H}px`;
      Object.assign(ui.hit.style, { left: b.l + 'px', top: b.t + 'px', width: b.w + 'px', height: b.h + 'px' });
      Object.assign(ui.shadow.style, { left: b.l + b.w * 0.15 + 'px', width: b.w * 0.7 + 'px', top: b.b - 4 + 'px' });
      ui.fx.style.top = b.t - 6 + 'px';
    }
    // Squash and stretch, and the swing while he dangles from the pointer.
    let tf = '';
    let origin = '50% 100%';
    if (m.squash) {
      const t = (now() - m.squash.t) / 1000;
      if (t > 0.7) m.squash = null;
      else {
        const k = m.squash.a * Math.exp(-7 * t) * Math.cos(16 * t);
        const side = m.squash.side;
        if (side === 'left' || side === 'right') {
          tf = `scale(${1 - k}, ${1 + k * 0.6})`;
          origin = side === 'left' ? `${b.l}px 70%` : `${b.r}px 70%`;
        } else {
          tf = `scale(${1 + k * 0.7}, ${1 - k})`;
          origin = side === 'top' ? `50% ${b.t}px` : `50% ${b.b}px`;
        }
      }
    }
    if (m.held || Math.abs(m.swing) > 0.2) {
      tf = `rotate(${m.swing.toFixed(2)}deg)${m.held ? ' scale(0.98, 1.04)' : ''}`;
      origin = m.grab ? `${m.grab.ox + b.l}px ${m.grab.oy + b.b}px` : '50% 0';
    }
    ui.body.style.transform = tf;
    ui.body.style.transformOrigin = origin;
    const lift = clamp((groundY() - m.y) / 200, 0, 1);
    ui.shadow.style.opacity = m.held ? '0' : String(1 - lift);
    ui.shadow.style.transform = `translateY(${groundY() - m.y}px) scale(${1 - lift * 0.5})`;
    ui.pet.classList.toggle('gcx-pet-held', m.held);
    placeSay();
  }

  // Sprite frames run on their own clock, at the state's rate.
  let ticker = 0;
  function restartTicker() {
    clearTimeout(ticker);
    if (!ui || document.hidden) return;
    const running = playing === 'running-left' || playing === 'running-right';
    let r = RATE[playing === 'waiting' && m.held ? 'held' : playing] || ACTIVE_RATE;
    // Faster legs the faster he goes (a slide, the leap's run-up).
    if (running && !m.held) r *= clamp(Math.abs(m.vx) / (WALK * 2), 1, 2.6);
    ticker = setTimeout(() => {
      frame++;
      render();
      // A step every other frame on a walk; every frame while sliding or sprinting (short, quick).
      if ((playing === 'running-left' || playing === 'running-right') && (m.target === null || frame % 2 === 1) && onGround()) footstep();
      restartTicker();
    }, FRAME_MS / r);
  }
  let stepSide = 0;
  function footstep() {
    stepSide ^= 1;
    stepSound(stepSide);
    if (calm() || !ui) return;
    const b = body();
    const d = document.createElement('span');
    d.className = 'gcx-pet-dust';
    d.style.left = m.x + b.w * (stepSide ? 0.35 : 0.65) + 'px';
    d.style.top = m.y + 'px';
    d.style.setProperty('--dx', (m.facing === 'right' ? -10 : 10) + 'px');
    ui.layer.append(d);
    setTimeout(() => d.remove(), 600);
  }

  // ---------------------------------------------------------------- physics
  let raf = 0;
  let lastT = 0;
  function wake() {
    if (raf || !ui) return;
    lastT = now();
    raf = requestAnimationFrame(step);
  }
  function step(t) {
    raf = 0;
    const dt = Math.min(MAX_STEP, Math.max(0, (t - lastT) / 1000));
    lastT = t;
    const busy = physics(dt);
    render();
    if (busy) raf = requestAnimationFrame(step);
    else saveSoon();
  }
  function physics(dt) {
    if (m.held) {
      // The dangle: a damped pendulum pushed by how fast the hand moves sideways.
      const want = calm() ? 0 : clamp(-m.vx * 0.03, -40, 40);
      m.swingV += ((want - m.swing) * 60 - m.swingV * 9) * dt;
      m.swing += m.swingV * dt;
      m.vx *= Math.max(0, 1 - 10 * dt);
      return true;
    }
    if (Math.abs(m.swing) > 0.2) {
      m.swingV += (-m.swing * 70 - m.swingV * 8) * dt;
      m.swing += m.swingV * dt;
    } else m.swing = m.swingV = 0;
    if (m.perch && !perchStillThere()) m.perch = null;
    const g = groundY();
    const airborne = m.y < g - 0.5 || m.vy !== 0;
    if (airborne) {
      const prev = m.y;
      if (m.leap && m.leap.phase === 'fly') {
        // Exact, so a leap lands where it was aimed even at a low frame rate.
        m.y += m.vy * dt + 0.5 * GRAVITY * dt * dt;
        m.vy += GRAVITY * dt;
      } else {
        m.vy += GRAVITY * dt;
        m.y += m.vy * dt;
      }
      // Falling past the top of a card: he lands on it.
      if (m.vy > 0 && !m.perch) {
        const p = findPerch(prev, m.y);
        if (p) {
          m.perch = p;
          if (Math.random() < 0.5) setTimeout(() => fx('gcx-pet-note', '♪'), 200);
        }
      }
      const floor = groundY();
      const b = body();
      const flying = m.leap && m.leap.phase === 'fly' ? m.leap : null;
      if (m.y >= floor && flying && m.perch && m.perch.el === flying.card && flying.i < flying.hops.length - 1) {
        // Down on a card on the way: straight on to the next at the same speed.
        m.y = floor;
        m.vy = 0;
        squash(0.1, 'bottom');
        thud(0.12);
        flying.i++;
        flying.perch = m.perch.el;
        flying.card = flying.hops[flying.i];
        flying.v = flying.speed;
        flying.phase = 'run';
      } else if (m.y >= floor && flying && m.perch) {
        // The last one: no bounce, a skid that stops before the far edge.
        m.y = floor;
        m.vy = 0;
        squash(0.2, 'bottom');
        thud(0.3);
        const room = flying.dir > 0 ? m.perch.right - b.w - m.x : m.x - m.perch.left;
        flying.k = clamp(Math.abs(m.vx) / (0.7 * Math.max(room, 16)), GROUND_DRAG, 40);
        flying.phase = 'brake';
      } else if (m.y >= floor) {
        if (flying) m.leap = null; // came down short: an ordinary fall
        const impact = m.vy;
        m.y = floor;
        if (impact > 700 && !calm()) m.vy = -impact * 0.3; // one little bounce
        else m.vy = 0;
        squash(impact / 1800, 'bottom');
        thud(impact / MAX_THROW);
        if (impact > 1900) {
          // Seeing stars.
          gesture('failed', 1100);
          fx('gcx-pet-star', '✦', -16);
          setTimeout(() => fx('gcx-pet-star', '✦', 16), 120);
          setTimeout(() => fx('gcx-pet-sweat', '💦', 10), 300);
        } else if (impact > 1100 && m.vy < 0) fx('gcx-pet-q', '!');
      } else if (m.y - b.h < 0) {
        m.y = b.h;
        squash(Math.abs(m.vy) / 1800, 'top');
        thud(Math.abs(m.vy) / MAX_THROW);
        if (Math.abs(m.vy) > 800) fx('gcx-pet-star', '✦');
        m.vy = Math.abs(m.vy) * BOUNCE;
      }
    }
    const L = m.leap;
    if (L && L.phase === 'run') {
      const p = m.perch;
      // (Not the frame's `airborne`: he may have just landed on the previous card this frame.)
      if (m.vy !== 0 || !p || m.y < p.top - 0.5 || p.el !== L.perch || !L.card.isConnected) m.leap = null;
      else if (m.working || !prefs.roam || calm()) {
        // Called off mid-run (the AI started, roaming or animations off): he brakes to a stop
        // before the edge, quietly; with animations off, at once.
        const room = L.dir > 0 ? p.right - body().w - m.x : m.x - p.left;
        L.k = calm() ? 1e3 : clamp(Math.abs(m.vx) / (0.7 * Math.max(room, 4)), GROUND_DRAG, 1e3);
        L.phase = 'brake';
        L.quiet = true;
      } else {
        const b = body();
        const edge = L.dir > 0 ? p.right - b.w : p.left;
        L.v = Math.min(L.speed, L.v + L.acc * dt);
        m.vx = L.dir * Math.max(L.v, REST_SPEED + 1);
        if (L.dir > 0 ? m.x + m.vx * dt >= edge : m.x + m.vx * dt <= edge) {
          // Off the edge at full speed, aimed to come down on the card he picked; the same speed
          // carries him across.
          const r = L.card.getBoundingClientRect();
          const T = Math.max(0.12, Math.abs(leapLand(r, L.dir, b) - (edge + b.w / 2)) / L.speed);
          m.vx = L.dir * L.speed;
          m.x = edge - m.vx * dt;
          m.vy = (r.top - p.top - (GRAVITY * T * T) / 2) / T;
          m.perch = null;
          L.phase = 'fly';
          squash(0.12, 'bottom');
          whoosh(0.3);
        }
      }
    }
    if (m.vx !== 0) {
      m.x += m.vx * dt;
      const mx = m.perch ? m.perch.right - body().w : maxX();
      const mn = m.perch ? m.perch.left : 0;
      if (m.x <= mn || m.x >= mx) {
        if (m.perch && !airborne) {
          // Skidded off the edge of the card.
          m.perch = null;
          m.leap = null;
        } else {
          const side = m.x <= mn ? 'left' : 'right';
          m.x = clamp(m.x, mn, mx);
          squash(Math.abs(m.vx) / 1600, side);
          thud(Math.abs(m.vx) / MAX_THROW);
          if (Math.abs(m.vx) > 900) fx('gcx-pet-q', '!', side === 'left' ? 10 : -10);
          m.vx = (side === 'left' ? 1 : -1) * Math.abs(m.vx) * BOUNCE;
        }
      }
      // Mid-leap he keeps his speed (run-up and flight), then brakes to a stop on the card.
      const lp = m.leap && m.leap.phase;
      const drag = lp === 'run' || lp === 'fly' ? 0 : lp === 'brake' && !airborne ? m.leap.k : airborne ? AIR_DRAG : GROUND_DRAG;
      m.vx *= Math.max(0, 1 - drag * dt);
      if (Math.abs(m.vx) < REST_SPEED) m.vx = 0;
      if (!m.vx && lp === 'brake') {
        const quiet = m.leap.quiet;
        m.leap = null;
        if (!quiet) {
          // Made it: stars.
          nextWander = Date.now() + rand(2500, 5000);
          fx('gcx-pet-star', '✦', -18);
          setTimeout(() => fx('gcx-pet-star', '★', 0), 110);
          setTimeout(() => fx('gcx-pet-star', '✦', 18), 220);
          if (Math.random() < 0.5) setTimeout(() => fx('gcx-pet-note', '♪', rand(-10, 10)), 500);
        }
      }
      if (m.vx) m.facing = m.vx > 0 ? 'right' : 'left';
      m.target = null;
    }
    if (!airborne && m.vx === 0 && m.target !== null) {
      const dir = m.target > m.x ? 1 : -1;
      const next = m.x + dir * WALK * clamp(prefs.size, 0.6, 1.4) * dt;
      m.facing = dir > 0 ? 'right' : 'left';
      if (dir > 0 ? next >= m.target : next <= m.target) {
        m.x = m.target;
        m.target = null;
        // Walked into the edge of the screen on purpose: a small bonk.
        if (m.bonk && (m.x <= 1 || m.x >= maxX() - 1)) {
          squash(0.16, m.x <= 1 ? 'left' : 'right');
          thud(0.15);
          gesture('failed', 600);
          fx('gcx-pet-q', Math.random() < 0.5 ? '!' : '?');
        } else if (!m.leap && Math.random() < Math.min(0.75, 0.35 * energy())) {
          // Not done yet: another stretch after a short pause.
          nextWander = Date.now() + rand(250, 900);
        }
        m.bonk = false;
      } else m.x = next;
    }
    const moving = m.y < groundY() - 0.5 || m.vy !== 0 || m.vx !== 0 || m.target !== null;
    return moving || !!m.squash || Math.abs(m.swing) > 0.2;
  }
  function perchStillThere() {
    const p = m.perch;
    if (!p.el.isConnected) return false;
    const r = p.el.getBoundingClientRect();
    return Math.abs(r.top - p.top) < 2 && Math.abs(r.left - p.left) < 2;
  }
  // Card tops he can stand on. Only looked for while he is falling.
  function findPerch(from, to) {
    const b = body();
    const mid = m.x + b.w / 2;
    let best = null;
    for (const el of document.querySelectorAll(PERCH_SEL)) {
      const r = el.getBoundingClientRect();
      if (r.width < b.w * 1.2 || r.height < 40 || r.top < 70 || r.top > vh() - 40) continue;
      if (mid < r.left + 8 || mid > r.right - 8 || r.top < from - 0.5 || r.top > to) continue;
      if (!best || r.top < best.top) best = { el, top: r.top, left: r.left, right: r.right };
    }
    return best;
  }

  // ---------------------------------------------------------------- reminders
  // Now and then he says something useful in a little pixel speech bubble: work due soon, luck on
  // an exam, a cheer for a grade, a teacher's comment, unread messages or announcements. Clicking
  // the bubble opens what it's about. The news is classroom.js's (one fetch shared by every tab).
  const SAID_KEY = 'gcx:pet:said'; // what he has said (by key) and when, so nothing repeats for a week
  const SAY_GAP = 4 * 6e4; // at least this long between two, across pages
  const URGENT_GAP = 6e4;
  const EXAM = /\b(exams?|midterms?|mid-terms?|finals?|tests?|quiz(?:zes)?)\b/i;
  let nextSay = 0;
  let saying = null;
  const clip = (t, n = 32) => {
    t = String(t || '').trim();
    return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t;
  };
  const num = (x) => String(Math.round(x * 100) / 100);
  const DAY_MS = 864e5;
  const dayOf = (t) => {
    const a = new Date(t);
    const b = new Date();
    a.setHours(0, 0, 0, 0);
    b.setHours(0, 0, 0, 0);
    return Math.round((a - b) / DAY_MS);
  };
  const clock = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/:00(?=\s|$)/, '');
  const weekday = (t) => new Date(t).toLocaleDateString(undefined, { weekday: 'long' });
  // Everything he could say right now, most important first. Parts: plain text, or [text] for a name.
  function sayings(n) {
    const now = Date.now();
    const list = [];
    const add = (key, pri, parts, url) => list.push({ key, pri, parts, url });
    for (const d of n.due || []) {
      const left = d.due - now;
      if (left <= 0) continue;
      const T = [clip(d.title)];
      const day = dayOf(d.due);
      const exam = EXAM.test(d.title) && d.type !== 'discussion_topic';
      if (left < 3 * 36e5)
        add(`due:${d.key}:soon`, 100, left < 36e5 ? [T, ` is due in ${Math.max(1, Math.round(left / 6e4))} min!`] : [T, ` is due at ${clock(d.due)}!`], d.url);
      else if (exam && day === 0) add(`exam:${d.key}:0`, 90, ['Good luck on ', T, ' today! You got this.'], d.url);
      else if (exam && day === 1) add(`exam:${d.key}:1`, 70, [T, ' is tomorrow. Good luck!'], d.url);
      else if (day === 0) add(`due:${d.key}:0`, 80, ["Don't forget: ", T, ` is due today at ${clock(d.due)}.`], d.url);
      else if (day === 1) add(`due:${d.key}:1`, 60, ["Don't forget about ", T, '! It\u2019s due tomorrow.'], d.url);
      else if (day <= 3) add(`due:${d.key}:${day}`, 35, [T, ` is due ${weekday(d.due)}.`], d.url);
    }
    for (const g of n.grades || []) {
      if (now - g.at > 3 * DAY_MS) continue;
      const T = [clip(g.title)];
      if (g.comment && now - g.comment.at < 3 * DAY_MS) add(`cmt:${g.id}:${g.comment.at}`, 72, [[clip(g.comment.who, 22)], ' left a comment on ', T, '.'], g.url);
      if (!g.graded) continue;
      const pct = g.pts > 0 && g.score != null ? g.score / g.pts : null;
      const sc = pct != null ? ` ${num(g.score)}/${num(g.pts)}` : '';
      if (pct != null && pct >= 0.9) add(`grade:${g.id}`, 75, ['Nice work on ', T, `!${sc}`], g.url);
      else if (pct != null && pct >= 0.75) add(`grade:${g.id}`, 70, [T, ` got graded:${sc}. Nice!`], g.url);
      else add(`grade:${g.id}`, 66, [T, ' was graded. Take a look?'], g.url);
    }
    if (n.unread > 0) {
      const m0 = (n.msgs || [])[0];
      add(
        `msg:${n.unread}:${m0 ? m0.at : 0}`,
        65,
        n.unread === 1 && m0 && m0.from ? ['New message from ', [clip(m0.from, 24)], '!'] : [`You have ${n.unread} unread message${n.unread === 1 ? '' : 's'}.`],
        '/conversations',
      );
    }
    for (const a of n.anns || [])
      add(`ann:${a.id}`, 55, a.course ? ['New announcement in ', [clip(a.course, 24)], ': ', [clip(a.title, 30)]] : ['New announcement: ', [clip(a.title)]], a.url);
    for (const x of n.missing || []) add(`miss:${x.key}`, 45, [[clip(x.title)], ' is marked missing. Still time to turn it in?'], x.url);
    const today = new Date().toDateString();
    const h = new Date().getHours();
    if (h < 5) add(`late:${today}`, 12, ["It's late! Don't forget to sleep."], null);
    if (!list.some((x) => /^(due|exam):/.test(x.key))) add(`clear:${today}`, 6, ['All caught up! Nothing due in the next few days.'], null);
    return list.sort((a, b) => b.pri - a.pri);
  }
  function readSaid() {
    try {
      return JSON.parse(localStorage.getItem(SAID_KEY) || '{}') || {};
    } catch {
      return {};
    }
  }
  async function maybeSay() {
    const g = window.gcx;
    if (!g || !g.news || !prefs.remind) return;
    const n = await g.news().catch(() => null);
    if (!n || !ui || saying || m.held || m.leap || m.sleeping) return;
    const said = readSaid();
    const now = Date.now();
    for (const k of Object.keys(said)) if (now - said[k] > 7 * DAY_MS) delete said[k];
    const last = said._last || 0;
    const pick = sayings(n).find((x) => !said[x.key] && now - last > (x.pri >= 90 ? URGENT_GAP : SAY_GAP));
    // The little extras only some of the time.
    if (!pick || (pick.pri < 30 && Math.random() < 0.6)) return;
    said[pick.key] = now;
    said._last = now;
    try {
      localStorage.setItem(SAID_KEY, JSON.stringify(said));
    } catch {}
    say(pick);
  }
  // The bubble: white, pixel-bordered, the words typing out a letter at a time.
  function say(item) {
    if (!ui) return;
    unsay(true);
    const box = document.createElement('div');
    box.className = 'gcx-pet-say' + (item.url ? ' gcx-pet-say-link' : '');
    box.setAttribute('role', 'status');
    if (item.url) box.title = 'Open';
    const chars = [];
    for (const part of item.parts) {
      const name = Array.isArray(part);
      const wrap = document.createElement(name ? 'b' : 'span');
      for (const ch of name ? part[0] : part) {
        const c = document.createElement('i');
        c.textContent = ch;
        wrap.append(c);
        chars.push(c);
      }
      box.append(wrap);
    }
    const tail = document.createElement('span');
    tail.className = 'gcx-pet-say-tail';
    box.append(tail);
    ui.layer.append(box);
    const me = { box, w: box.offsetWidth, h: box.offsetHeight, timer: 0, typing: 0 };
    saying = me;
    placeSay();
    gesture('waving', 1200);
    const hold = 3500 + chars.length * 45;
    const done = () => {
      box.classList.add('gcx-done');
      me.timer = setTimeout(() => saying === me && unsay(), hold);
    };
    if (calm()) {
      chars.forEach((c) => c.classList.add('on'));
      done();
    } else {
      let i = 0;
      const next = () => {
        if (saying !== me) return;
        const c = chars[i++];
        if (!c) return done();
        c.classList.add('on');
        if (i % 2 && c.textContent.trim()) blip();
        me.typing = setTimeout(next, /[.!?,:]/.test(c.textContent) ? 140 : 32);
      };
      me.typing = setTimeout(next, 180);
    }
    box.addEventListener('mouseenter', () => clearTimeout(me.timer));
    box.addEventListener('mouseleave', () => {
      if (!box.classList.contains('gcx-done')) return;
      clearTimeout(me.timer);
      me.timer = setTimeout(() => saying === me && unsay(), 1500);
    });
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      if (item.url) location.href = item.url;
      else unsay();
    });
  }
  function unsay(now) {
    const me = saying;
    if (!me) return;
    saying = null;
    clearTimeout(me.timer);
    clearTimeout(me.typing);
    if (now || calm()) return me.box.remove();
    me.box.classList.add('gcx-out');
    setTimeout(() => me.box.remove(), 300);
  }
  // Above his head, inside the screen, the tail pointing at him.
  function placeSay() {
    if (!saying) return;
    const b = body();
    const { box, w, h } = saying;
    const cx = m.x + b.w / 2;
    const left = clamp(cx - w / 2, 6, Math.max(6, vw() - w - 6));
    const top = Math.max(6, m.y - b.h - h - 16);
    box.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
    box.style.setProperty('--tx', Math.round(clamp(cx - left, 12, w - 12)) + 'px');
  }

  // ---------------------------------------------------------------- the leap
  // Now and then on a class card he walks to its edge, thinks it over, backs up for a run-up,
  // sprints and hops across the next cards in the row one at a time (one card more often than
  // several), keeping the same speed on the cards and through the air, then skids to a stop.
  function leapCards(dir) {
    const p = m.perch;
    if (!p || !p.el.matches(LEAP_SEL)) return [];
    const b = body();
    const list = [];
    for (const el of document.querySelectorAll(LEAP_SEL)) {
      if (el === p.el) continue;
      const r = el.getBoundingClientRect();
      if (Math.abs(r.top - p.top) > 4 || r.width < b.w * 1.2 || r.left < 0 || r.right > vw()) continue;
      if (dir > 0 ? r.left < p.right - 1 : r.right > p.left + 1) continue;
      list.push({ el, left: r.left, right: r.right });
    }
    return list.sort((a, c) => dir * (a.left - c.left));
  }
  // Where on a card he aims to come down (his middle): a little way in from the near edge, so there
  // is room to run on to the next one, or to brake.
  function leapLand(c, dir, b) {
    const w = c.right - c.left;
    const into = clamp(w * 0.25, b.w / 2 + 24, w / 2);
    return dir > 0 ? c.left + into : c.right - into;
  }
  // The walking parts, 4 times a second from think(); the run and the flight are physics'. True
  // while the leap is on (nothing else interrupts it).
  function leapStep(t) {
    const L = m.leap;
    if (L.phase === 'run' || L.phase === 'fly' || L.phase === 'brake') return true;
    const p = m.perch;
    const stop = () => ((m.leap = null), false);
    if (!p || p.el !== L.perch || !prefs.roam || calm() || m.working) return stop();
    if (m.target !== null) return true; // still walking there
    const b = body();
    const edge = L.dir > 0 ? p.right - b.w : p.left;
    const face = L.dir > 0 ? 'right' : 'left';
    if (L.phase === 'go') {
      // At the edge: he stops and thinks about it.
      if (Math.abs(m.x - edge) > 2) return stop();
      L.phase = 'think';
      L.until = t + rand(1100, 1700);
      m.facing = face;
      gesture('review', L.until - t);
      setTimeout(() => m.leap === L && fx('gcx-pet-q', Math.random() < 0.5 ? '?' : '…'), 450);
      return true;
    }
    if (t < L.until) return true;
    if (L.phase === 'think') {
      // Picks the card and how fast he has to go: a higher, faster jump the further it is.
      const cards = leapCards(L.dir);
      if (!cards.length) return stop();
      L.hops = cards.slice(0, 1 + Math.floor(Math.random() ** 1.4 * cards.length)).map((c) => c.el);
      L.i = 0;
      L.card = L.hops[0];
      const D = Math.abs(leapLand(cards[0], L.dir, b) - (edge + b.w / 2));
      const room = p.top - b.h - 20;
      const apex = Math.min(48 + D * 0.1, 140, room);
      if (apex < 30) return stop();
      L.speed = Math.min(1700, D / Math.sqrt((8 * apex) / GRAVITY));
      // At the speed cap the arc is higher than planned: too high for the screen, no leap.
      if ((GRAVITY * (D / L.speed) ** 2) / 8 > room) return stop();
      const most = p.right - p.left - b.w - 2;
      L.run = clamp(L.speed * 0.3, Math.min(b.w, most), most);
      if (L.run < 20) return stop();
      L.phase = 'back';
      m.target = edge - L.dir * L.run;
      wake();
      return true;
    }
    if (L.phase === 'back') {
      // Backed up: turns to face the edge.
      if (Math.abs(m.x - (edge - L.dir * L.run)) > 2) return stop();
      L.phase = 'ready';
      L.until = t + 380;
      m.facing = face;
      gesture(`look-${face}-side`, 380);
      return true;
    }
    // Go.
    L.phase = 'run';
    L.v = 0;
    L.acc = (L.speed * L.speed) / (2 * L.run);
    m.gesture = null;
    fx('gcx-pet-q', '!');
    wake();
    return true;
  }

  // ---------------------------------------------------------------- the brain (4 times a second)
  let brain = 0;
  function think() {
    if (!ui || !sheet || document.hidden) return;
    const t = Date.now();
    const idleFor = t - lastActive;
    // At work while the AI writes (Ask, Inbox suggestions) or a page loads; a cheer when the AI is done.
    const asking = !!document.querySelector('.gcx-ask.busy, #gcx-sg .gcx-sg-wait');
    const working = asking || !!document.querySelector('.gcx-progress.on:not(.done)');
    if (working !== m.working) {
      m.working = working;
      if (working) {
        m.target = null;
        m.sleeping = false;
      }
      else lastActive = Date.now();
      if (!working && m.wasAsking && onGround() && !m.held) {
        gesture('waving', 1200);
        fx('gcx-pet-star', '!');
      }
      render();
    }
    m.wasAsking = asking;
    if (working && Math.random() < 0.05) fx('gcx-pet-dots', '…', rand(-8, 8));
    if (!m.sleeping && Date.now() - lastActive > sleepMs() && onGround() && !m.held && !m.working && !m.hovered) {
      m.snores = 0;
      m.sleeping = true;
      m.target = null;
      nextSnore = t + 1600;
      fx('gcx-pet-dots', '…');
    }
    if (m.sleeping) {
      if (t > nextSnore) {
        nextSnore = t + 3400;
        if (m.snores++ < 20) snore();
        fx('gcx-pet-z', 'z', rand(-6, 4));
        setTimeout(() => m.sleeping && fx('gcx-pet-z gcx-pet-Z', 'Z', rand(-2, 12)), 650);
      }
      render();
      return;
    }
    // Dangling from the pointer for a while: puzzled.
    if (m.held) {
      m.heldSince = m.heldSince || t;
      if (t - m.heldSince > 2500 && Math.random() < 0.03) fx('gcx-pet-q', Math.random() < 0.5 ? '?' : '…');
      return;
    }
    m.heldSince = 0;
    if (!onGround() || m.vx) return;
    if (m.gesture && t > m.gestureUntil) m.gesture = null;
    if (m.leap && leapStep(t)) return;
    // The cursor comes close: a wave, facing it.
    const b = body();
    const cx = m.x + b.w / 2;
    const cy = m.y - b.h / 2;
    const near = Math.hypot(pointer.x - cx, pointer.y - cy) < 110 + b.w;
    if (near && !m.hovered && t - wavedAt > 9000 && !m.gesture) {
      wavedAt = t;
      m.target = null;
      gesture('waving', 1500);
      if (Math.random() < 0.4) fx('gcx-pet-note', '♪', rand(-8, 8));
    }
    const drowsy = idleFor > drowsyMs();
    if (drowsy && !m.drowsy) fx('gcx-pet-dots', '…');
    m.drowsy = drowsy;
    const busy = m.gesture || t < typingUntil || m.hovered || near || m.working || !!saying;
    if (prefs.remind && !busy && !m.leap && t > nextSay) {
      nextSay = t + rand(25e3, 45e3);
      maybeSay();
    }
    // Wander (5-12 s apart, a bit livelier than TAILS' 7-16 s; at least 40 px, within 80% of the width).
    const roams = prefs.roam && !calm() && !drowsy;
    if (roams && !busy && m.target === null && t > nextWander) {
      nextWander = t + rand(WANDER_MIN, WANDER_MAX) / energy();
      const mn = m.perch ? m.perch.left : 0;
      const mx = m.perch ? m.perch.right - b.w : maxX();
      // On a class card with more cards beside it: now and then to its edge, for a leap.
      const dirs = m.perch && Math.random() < LEAP_CHANCE ? [1, -1].filter((d) => leapCards(d).length) : [];
      if (dirs.length) {
        const dir = dirs[Math.floor(Math.random() * dirs.length)];
        m.leap = { phase: 'go', dir, perch: m.perch.el };
        m.bonk = false;
        const edge = dir > 0 ? mx : mn;
        m.target = Math.abs(edge - m.x) >= 1 ? edge : null;
        wake();
      } else if (mx - mn > 60) {
        let target;
        if (!m.perch && Math.random() < 0.2) {
          target = Math.random() < 0.5 ? mn : mx; // all the way to the edge, and bonk
          m.bonk = true;
        } else {
          m.bonk = false;
          const span = (mx - mn) * 0.8;
          const reach = Math.min(span / 2, 520 * clamp(prefs.size, 0.6, 1.4) * Math.sqrt(energy()));
          for (let i = 0; i < 6; i++) {
            target = clamp(m.x + rand(-reach, reach), mn, mx);
            if (Math.abs(target - m.x) >= 40) break;
          }
        }
        if (Math.abs(target - m.x) >= 40) {
          m.target = target;
          wake();
        } else m.bonk = false;
      }
    }
    // Glance around now and then (v2 sheets only have the look rows).
    if (!busy && m.target === null && t > nextGlance && !drowsy) {
      nextGlance = t + rand(GLANCE_MIN, GLANCE_MAX);
      const r = Math.random();
      if (r < 0.12 && !calm()) {
        gesture('jumping', 700);
        hop(300);
        fx('gcx-pet-note', '♪', rand(-10, 10));
      } else if (r < 0.3) {
        gesture('review', 1600);
        if (Math.random() < 0.5) setTimeout(() => fx('gcx-pet-q', '?'), 500);
      } else if (sheet.ver === 2) {
        gesture(Math.random() < 0.5 ? 'look-left-side' : 'look-right-side', GLANCE_MS);
        if (Math.random() < 0.2) fx('gcx-pet-q', '?');
      } else gesture('review', GLANCE_MS);
    }
    if (drowsy && !busy) render();
  }

  // ---------------------------------------------------------------- the user
  function active() {
    const was = m.sleeping;
    lastActive = Date.now();
    if (!was) return;
    // Back! He wakes with a little jump and a wave.
    m.sleeping = false;
    nextWander = Date.now() + rand(3000, 6000);
    hop(380);
    gesture('waving', 1600);
    fx('gcx-pet-star', '!');
  }
  window.addEventListener(
    'pointermove',
    (e) => {
      pointer = { x: e.clientX, y: e.clientY };
      active();
    },
    { passive: true, capture: true },
  );
  window.addEventListener('pointerdown', active, { passive: true, capture: true });
  const editable = (el) => {
    if (!el || !el.tagName) return false;
    if (el.isContentEditable) return true;
    if (el.tagName === 'TEXTAREA') return true;
    return el.tagName === 'INPUT' && /^(text|search|email|url|number|password|tel|)$/i.test(el.type || '');
  };
  window.addEventListener(
    'keydown',
    (e) => {
      active();
      const el = e.composedPath ? e.composedPath()[0] : e.target;
      if (!ui || !editable(el) || e.ctrlKey || e.metaKey || e.altKey) return;
      // He looks over at whatever you are typing into.
      typingUntil = Date.now() + 1800;
      let x = null;
      try {
        const sel = getSelection();
        if (sel && sel.rangeCount && el.isContentEditable) {
          const r = sel.getRangeAt(0).getClientRects()[0];
          if (r) x = r.left;
        }
      } catch {}
      if (x == null) {
        const r = el.getBoundingClientRect();
        x = r.left + Math.min(r.width, 24 + (el.value ? el.value.length : 0) * 7);
      }
      caretX = x;
      if (m.target !== null && !m.held) m.target = null;
      const roll = Math.random();
      if (roll < 0.1) fx('gcx-pet-q', '?', rand(-8, 8));
      else if (roll < 0.13) fx('gcx-pet-dots', '…');
      render();
      clearTimeout(typingEnd);
      typingEnd = setTimeout(render, 1900);
    },
    { capture: true },
  );
  let typingEnd = 0;
  // Scrolling the page knocks him off balance (and off the card he was standing on).
  // Only a real scroll counts: 160 px of page movement within half a second, at most every 2.5 s.
  let lastScrollY = scrollY;
  let stumbledAt = 0;
  let scrollSum = 0;
  let scrollFrom = 0;
  window.addEventListener(
    'scroll',
    (e) => {
      active();
      if (!ui || !sheet || m.held) return;
      // The card under him may have moved; the physics step notices and lets him fall.
      if (m.perch) wake();
      const el = e.target === document ? document.scrollingElement : e.target;
      const y = el === document.scrollingElement ? scrollY : (el && el.scrollTop) || 0;
      const prev = el === document.scrollingElement ? lastScrollY : el._gcxPetY == null ? y : el._gcxPetY;
      if (el === document.scrollingElement) lastScrollY = y;
      else if (el) el._gcxPetY = y;
      // Not the pet picker's own list, and not little inner panes.
      if (!el || (el !== document.scrollingElement && el.clientHeight < vh() * 0.5)) return;
      const t = Date.now();
      if (t - scrollFrom > 500) (scrollSum = 0), (scrollFrom = t);
      scrollSum += y - prev;
      if (Math.abs(scrollSum) < 160 || t - stumbledAt < 2500 || !onGround() || calm()) return;
      stumbledAt = t;
      hop(260, (scrollSum > 0 ? -1 : 1) * rand(60, 160));
      scrollSum = 0;
      gesture('failed', 700);
      fx('gcx-pet-q', Math.random() < 0.5 ? '?!' : '!');
    },
    { passive: true, capture: true },
  );
  window.addEventListener('resize', () => {
    if (!ui) return;
    if (sheet && sheet.scaledFor !== devH()) {
      lastFrameKey = '';
      clearTimeout(rescaleTimer);
      rescaleTimer = setTimeout(rescale, 220);
    }
    m.perch = null;
    m.leap = null;
    m.x = clamp(m.x, 0, maxX());
    if (m.y > vh()) m.y = vh();
    m.vy = m.vy || (m.y < vh() - 0.5 ? 1 : 0);
    wake();
  });
  // Confetti from classroom.js means work was just handed in: celebrate.
  new MutationObserver((recs) => {
    if (!ui || !sheet) return;
    for (const r of recs)
      for (const n of r.addedNodes)
        if (n.nodeType === 1 && n.classList.contains('gcx-confetti')) return celebrate();
  }).observe(document.body || html, { childList: true });
  function celebrate() {
    m.sleeping = false;
    lastActive = Date.now();
    m.target = null;
    gesture('jumping', 2600);
    hop(520);
    setTimeout(() => onGround() && hop(420), 900);
    for (let i = 0; i < 3; i++) setTimeout(() => fx('gcx-pet-star', '★', rand(-20, 20)), i * 250);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearTimeout(ticker);
      save();
    } else if (ui) {
      restartTicker();
      wake();
    }
  });
  reducedMq.addEventListener('change', () => apply());
  window.addEventListener('gcx:prefs', () => apply());

  // ---------------------------------------------------------------- picking him up
  function bindPointer(hit) {
    let press = null;
    hit.addEventListener('pointerenter', () => {
      m.hovered = true;
      if (onGround()) m.target = null;
      render();
    });
    hit.addEventListener('pointerleave', () => {
      m.hovered = false;
      render();
    });
    hit.addEventListener('contextmenu', (e) => e.preventDefault());
    hit.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      // preventDefault below swallows the mousedown that open menus close on; send them one.
      hit.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, clientX: e.clientX, clientY: e.clientY }));
      e.preventDefault();
      e.stopPropagation();
      try {
        hit.setPointerCapture(e.pointerId);
      } catch {}
      // Followed on the window as well, so a fast hand that leaves his box is not lost.
      addEventListener('pointermove', move, true);
      addEventListener('pointerup', up, true);
      addEventListener('pointercancel', cancel, true);
      addEventListener('blur', cancel);
      press = { x: e.clientX, y: e.clientY, t: Date.now(), samples: [{ x: e.clientX, y: e.clientY, t: now() }], moved: false };
      press.pat = setTimeout(() => {
        if (!press || press.moved) return;
        press.patted = true;
        gesture('waving', PAT_REACTION_MS);
        fx('gcx-pet-heart', '♥', rand(-12, 12));
        setTimeout(() => fx('gcx-pet-heart', '♥', rand(-16, 16)), 180);
        chirp();
      }, PAT_MS);
    });
    const move = (e) => {
      if (!press) return;
      const s = press.samples;
      s.push({ x: e.clientX, y: e.clientY, t: now() });
      while (s.length > 2 && s[s.length - 1].t - s[0].t > 100) s.shift();
      if (!press.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 5) {
        press.moved = true;
        clearTimeout(press.pat);
        // Picked up: hold him where he was grabbed.
        m.held = true;
        m.sleeping = false;
        m.target = null;
        m.perch = null;
        m.leap = null;
        m.vy = 0;
        m.gesture = null;
        // Where he was grabbed, relative to his body's left edge and his feet (also the swing's pivot).
        m.grab = { ox: press.x - m.x, oy: press.y - m.y };
        html.classList.add('gcx-pet-dragging');
        wake();
      }
      if (!m.held) return;
      const prevX = m.x;
      const b = body();
      m.x = clamp(e.clientX - (m.grab.ox), 0, maxX());
      m.y = clamp(e.clientY - m.grab.oy, b.h, vh());
      const dt = Math.max(0.008, (s[s.length - 1].t - s[0].t) / 1000);
      m.vx = (s[s.length - 1].x - s[0].x) / dt;
      if (Math.abs(m.x - prevX) > 1) m.facing = m.x > prevX ? 'right' : 'left';
      wake();
    };
    const end = (e, cancelled) => {
      if (!press) return;
      const p = press;
      press = null;
      clearTimeout(p.pat);
      removeEventListener('pointermove', move, true);
      removeEventListener('pointerup', up, true);
      removeEventListener('pointercancel', cancel, true);
      removeEventListener('blur', cancel);
      try {
        if (e && e.pointerId != null) hit.releasePointerCapture(e.pointerId);
      } catch {}
      html.classList.remove('gcx-pet-dragging');
      if (!m.held) {
        // A click that stayed put: a happy jump.
        if (!cancelled && !p.patted && Date.now() - p.t < PAT_MS) {
          gesture('jumping', REACTION_MS);
          hop(420);
        }
        return;
      }
      m.held = false;
      const s = p.samples;
      const dt = Math.max(0.016, (s[s.length - 1].t - s[0].t) / 1000);
      const fresh = now() - s[s.length - 1].t < 80;
      if (calm()) {
        m.vx = m.vy = 0;
        m.y = vh();
      } else {
        // Let go: he keeps the hand's speed and gravity does the rest.
        m.vx = fresh ? clamp((s[s.length - 1].x - s[0].x) / dt, -MAX_THROW, MAX_THROW) : 0;
        m.vy = fresh ? clamp((s[s.length - 1].y - s[0].y) / dt, -MAX_THROW, MAX_THROW) : 0;
        if (Math.abs(m.vx) < REST_SPEED) m.vx = 0;
        if (m.vy === 0 && m.y < vh() - 0.5) m.vy = 1;
        if (Math.hypot(m.vx, m.vy) > 1200) fx('gcx-pet-q', Math.random() < 0.5 ? '!' : '?!');
        whoosh(Math.hypot(m.vx, m.vy) / MAX_THROW);
      }
      nextWander = Date.now() + rand(WANDER_MIN, WANDER_MAX);
      wake();
      saveSoon();
    };
    function up(e) {
      end(e, false);
    }
    function cancel(e) {
      end(e, true);
    }
  }

  // ---------------------------------------------------------------- where he was (per tab)
  const POS_KEY = 'gcx:pet:pos';
  let saveTimer = 0;
  function save() {
    if (!ui) return;
    try {
      sessionStorage.setItem(POS_KEY, JSON.stringify({ fx: (m.x + body().w / 2) / vw(), facing: m.facing, sleeping: m.sleeping, lastActive, t: Date.now() }));
    } catch {}
  }
  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 400);
  }
  window.addEventListener('pagehide', save);

  // ---------------------------------------------------------------- show / hide
  function build() {
    const layer = document.createElement('div');
    layer.className = 'gcx-pet-layer';
    layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML =
      '<div class="gcx-pet"><div class="gcx-pet-shadow"></div><div class="gcx-pet-body"><div class="gcx-pet-sprite"></div></div><div class="gcx-pet-fx"></div><div class="gcx-pet-hit" title="Drag to pick up. Click, or hold to pat."></div></div>';
    (document.body || html).append(layer);
    const q = (s) => layer.querySelector(s);
    ui = { layer, pet: q('.gcx-pet'), body: q('.gcx-pet-body'), sprite: q('.gcx-pet-sprite'), hit: q('.gcx-pet-hit'), fx: q('.gcx-pet-fx'), shadow: q('.gcx-pet-shadow') };
    bindPointer(ui.hit);
  }
  function place() {
    let saved = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(POS_KEY) || 'null');
    } catch {}
    const w = body().w;
    if (saved && Number.isFinite(saved.fx)) {
      m.x = clamp(saved.fx * vw() - w / 2, 0, maxX());
      m.y = vh();
      m.facing = saved.facing === 'left' ? 'left' : 'right';
    } else {
      // First page this tab: he drops in from above, a little right of centre.
      m.x = clamp(vw() * 0.68, 0, maxX());
      m.y = calm() ? vh() : Math.max(w, vh() * 0.25);
      m.vy = calm() ? 0 : 1;
    }
    nextWander = Date.now() + rand(3000, WANDER_MIN);
    nextSay = Date.now() + rand(5000, 9000);
    nextGlance = Date.now() + rand(GLANCE_MIN, GLANCE_MAX);
  }
  function teardown() {
    unsay(true);
    if (ui) ui.layer.remove();
    ui = null;
    clearTimeout(ticker);
    clearInterval(brain);
    cancelAnimationFrame(raf);
    raf = 0;
    brain = 0;
  }
  let applied = '';
  async function apply() {
    if (document.prerendering) return; // built ahead: the pet comes when he arrives
    const want = prefs.on && prefs.id && prefs.sheet;
    if (!want) {
      applied = '';
      teardown();
      return;
    }
    if (ui && calm()) m.target = null;
    if (!prefs.remind) unsay();
    if (applied === prefs.id) {
      // Still loading this pet, or it failed and apply() reset `applied`.
      if (!sheet || sheet.id !== prefs.id || !ui) return;
      // Size changed (live from the slider): redraw now, resample the sheet once it settles.
      lastFrameKey = '';
      m.x = clamp(m.x, 0, maxX());
      render();
      clearTimeout(rescaleTimer);
      rescaleTimer = setTimeout(rescale, 220);
      return;
    }

    applied = prefs.id;
    const p = prefs;
    const job = (loading = loadSheet(p).catch((e) => (console.warn('[gcx pets]', e.message), null)));
    const s = await job;
    if (loading !== job || prefs.id !== p.id || !prefs.on) return;
    if (!s) {
      applied = '';
      return;
    }
    if (sheet && sheet.url) URL.revokeObjectURL(sheet.url);
    if (sheet && sheet.bitmap && sheet.bitmap !== s.bitmap) sheet.bitmap.close();
    sheet = s;
    const fresh = !ui;
    if (fresh) build();
    lastFrameKey = '';
    playing = '';
    if (fresh) place();
    else m.x = clamp(m.x, 0, maxX());
    await rescale();
    if (!ui || sheet !== s) return;
    render();
    ui.pet.classList.add('gcx-pet-in');
    restartTicker();
    if (!brain) brain = setInterval(think, 250);
    wake();
  }

  // ---------------------------------------------------------------- settings
  const LIB_ASSET = /^https:\/\/codex-pets\.net\//;
  const OWN_THUMB = /^data:image\/webp;base64,/;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const SET_CSS = `
    .gcx-set-pets > :first-child { border-top: 1px solid var(--gcx-border, #e4e4e7); }
    .gcx-set-pets .gcx-set-row + .gcx-set-row, .gcx-set-pets .gcx-set-sub + .gcx-set-row { border-top: 1px solid var(--gcx-border, #e4e4e7); }
    .gcx-set-pets .gcx-pets-dis { opacity: .4; pointer-events: none; }
    .gcx-pets-cur { display: flex; align-items: center; gap: 12px; margin: 6px 0 4px; }
    .gcx-pets-cur img, .gcx-pets-cur .gcx-pets-none { flex: none; width: 52px; height: 56px; object-fit: contain; border-radius: 10px; background: var(--gcx-bg2, #f4f4f5); }
    .gcx-pets-cur div { flex: 1; min-width: 0; }
    .gcx-pets-cur b { display: block; font-size: 14px; font-weight: 600; color: var(--gcx-text, #18181b); }
    .gcx-pets-cur small { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 12px; color: var(--gcx-muted, #71717a); line-height: 1.35; }
    .gcx-pets-btn { flex: none; height: 30px; padding: 0 12px; border: 1px solid var(--gcx-border, #e4e4e7); border-radius: 8px; background: none; color: var(--gcx-text, #18181b);
      font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
    .gcx-pets-btn:hover { background: var(--gcx-bg2, #f4f4f5); }
    .gcx-pets-pick[hidden] { display: none; }
    .gcx-pets-search { display: block; width: 100%; box-sizing: border-box; height: 34px; margin: 8px 0; padding: 0 12px; border: 1px solid var(--gcx-border, #e4e4e7);
      border-radius: 10px; background: var(--gcx-card, #fff); color: var(--gcx-text, #18181b); font: inherit; font-size: 13px; }
    .gcx-pets-search:focus { outline: 2px solid var(--gcx-link, #4f46e5); outline-offset: -1px; }
    .gcx-pets-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(78px, 1fr)); gap: 6px; max-height: 300px; overflow-y: auto; padding: 2px; overscroll-behavior: contain;
      border-radius: 10px; outline: 2px dashed transparent; outline-offset: -2px; transition: outline-color .15s ease; }
    .gcx-pets-grid.gcx-drop { outline-color: var(--gcx-link, #4f46e5); }
    .gcx-pets-tile { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 4px 5px; border: 1px solid transparent; border-radius: 10px;
      background: none; color: var(--gcx-text, #18181b); cursor: pointer; font: inherit; min-width: 0; position: relative; }
    .gcx-pets-tile:hover { background: var(--gcx-bg2, #f4f4f5); }
    .gcx-pets-tile[aria-pressed="true"] { border-color: var(--gcx-link, #4f46e5); background: color-mix(in srgb, var(--gcx-link, #4f46e5) 8%, transparent); }
    .gcx-pets-tile img { width: 56px; height: 60px; object-fit: contain; }
    .gcx-pets-tile small { display: block; width: 100%; font-size: 11px; line-height: 1.25; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--gcx-muted, #71717a); }
    .gcx-pets-tile.gcx-busy img { opacity: .35; }
    .gcx-pets-tile.gcx-busy::after { content: ''; position: absolute; top: 22px; left: 50%; width: 18px; height: 18px; margin-left: -9px; border-radius: 50%;
      border: 2px solid var(--gcx-link, #4f46e5); border-right-color: transparent; animation: gcx-pets-spin .7s linear infinite; }
    @keyframes gcx-pets-spin { to { transform: rotate(360deg); } }
    .gcx-pets-own { position: relative; display: flex; min-width: 0; }
    .gcx-pets-own .gcx-pets-tile { flex: 1; }
    .gcx-pets-own .gcx-pets-tile small::before { content: '★ '; color: var(--gcx-link, #4f46e5); }
    .gcx-pets-x { position: absolute; top: 2px; right: 2px; width: 20px; height: 20px; padding: 0; border: 0; border-radius: 50%; background: var(--gcx-bg2, #f4f4f5);
      color: var(--gcx-muted, #71717a); font: 600 14px/20px system-ui, sans-serif; cursor: pointer; opacity: 0; transition: opacity .15s ease; }
    .gcx-pets-own:hover .gcx-pets-x, .gcx-pets-x:focus-visible { opacity: 1; }
    .gcx-pets-x:hover { color: var(--gcx-text, #18181b); }
    .gcx-pets-foot { display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 12px; color: var(--gcx-muted, #71717a); }
    .gcx-pets-foot span { flex: 1; min-width: 0; }
    .gcx-pets-foot a { color: inherit; }
    .gcx-pets-gen { margin-top: 10px; padding: 10px; border: 1px solid var(--gcx-border, #e4e4e7); border-radius: 12px; }
    .gcx-pets-gen[hidden] { display: none; }
    .gcx-pets-desc { display: block; width: 100%; box-sizing: border-box; resize: vertical; min-height: 52px; padding: 8px 10px; border: 1px solid var(--gcx-border, #e4e4e7);
      border-radius: 10px; background: var(--gcx-card, #fff); color: var(--gcx-text, #18181b); font: inherit; font-size: 13px; line-height: 1.4; }
    .gcx-pets-desc:focus { outline: 2px solid var(--gcx-link, #4f46e5); outline-offset: -1px; }
    .gcx-pets-ideas { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
    .gcx-pets-idea { height: 26px; padding: 0 10px; border: 1px solid var(--gcx-border, #e4e4e7); border-radius: 13px; background: none; color: var(--gcx-text, #18181b);
      font: inherit; font-size: 12px; cursor: pointer; }
    .gcx-pets-idea:hover { background: var(--gcx-bg2, #f4f4f5); }
    .gcx-pets-idea:disabled, .gcx-pets-go:disabled { opacity: .5; cursor: progress; }
    .gcx-pets-genfoot { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--gcx-muted, #71717a); }
    .gcx-pets-genfoot span { flex: 1; min-width: 0; line-height: 1.35; }
    .gcx-pets-go { background: var(--gcx-link, #4f46e5); border-color: transparent; color: #fff; }
    .gcx-pets-go:hover { background: color-mix(in srgb, var(--gcx-link, #4f46e5) 88%, #000); }
  `;
  function injectCss(root) {
    const host = root instanceof ShadowRoot ? root : document.head || html;
    const scope = root instanceof ShadowRoot ? root : document;
    if (scope.querySelector && scope.querySelector('style[data-gcx-pets]')) return;
    const st = document.createElement('style');
    st.dataset.gcxPets = '';
    st.textContent = SET_CSS;
    host.append(st);
  }

  // The library's pages, each asked for once per page view (background.js keeps them for hours).
  const lists = new Map();
  function libPage(page, q) {
    const k = page + '|' + q;
    if (!lists.has(k)) lists.set(k, ask({ op: 'list', page, q }).catch((e) => (lists.delete(k), Promise.reject(e))));
    return lists.get(k);
  }
  // His own pets (imported, or from the extension's pets.local folder).
  const loadMine = () => ask({ op: 'mine' }).then((r) => (r.pets || []).map((e) => ({ ...e, mine: true })));
  const readFile = (f) =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res({ name: f.name, dataUrl: r.result });
      r.onerror = () => rej(r.error || new Error('unreadable file'));
      r.readAsDataURL(f);
    });

  // A file dropped anywhere in the settings panel (just missing the pets) is still not opened by
  // the browser, which would leave Canvas.
  let petsBox = null;
  const strayDrop = (e) => {
    if (!petsBox || !petsBox.isConnected || ![...((e.dataTransfer && e.dataTransfer.types) || [])].includes('Files')) return;
    if (e.composedPath().includes(petsBox)) e.preventDefault();
  };
  window.addEventListener('dragover', strayDrop);
  window.addEventListener('drop', strayDrop);

  // A pet being drawn ({ desc, run }), kept outside the settings panel so closing and reopening it
  // can't start (and pay for) a second one. Once drawn, it becomes the pet.
  let genJob = null;
  function startGen(text) {
    // A message now and then keeps the background worker awake while the picture is drawn.
    const awake = setInterval(() => ask({ op: 'ping' }, 0).catch(() => {}), 15000);
    // Sent again only if it never reached the worker (nothing was drawn or paid for then).
    const send = () =>
      ask({ op: 'generate', desc: text }, 0).catch((e) => {
        if (/Receiving end does not exist|Could not establish connection/i.test(e.message)) return new Promise((r) => setTimeout(r, 800)).then(() => ask({ op: 'generate', desc: text }, 0));
        throw e;
      });
    return send()
      .then(({ pet }) => {
        const entry = { ...pet, mine: true };
        savePrefs({ on: true, id: entry.id, name: entry.displayName, sheet: 'mine', thumb: entry.thumbnail, ver: entry.spriteVersionNumber, desc: entry.description || '' });
        return entry;
      })
      .finally(() => {
        clearInterval(awake);
        genJob = null;
      });
  }
  // Starting points for an AI-made pet ('mascot' asks which school this Canvas belongs to).
  const IDEAS = [
    ['🎓 My school’s mascot', 'mascot'],
    ['🐱 Sleepy cat', 'a sleepy orange cat in a tiny hoodie'],
    ['🐉 Tiny dragon', 'a tiny green dragon with little wings'],
    ['🤖 Robot', 'a round little robot with one antenna'],
    ['🐸 Grad frog', 'a frog wearing a graduation cap'],
    ['🦉 Night owl', 'a sleepy owl holding a coffee cup'],
  ];
  function fill(box) {
    const host = box && box.querySelector && box.querySelector('.gcx-set-pets');
    if (!host || host.dataset.gcxPetsBound) return;
    host.dataset.gcxPetsBound = '1';
    injectCss(host.getRootNode());
    const p = prefs;
    host.innerHTML = `
      <label class="gcx-set-row"><span><b>Pet</b><small>A little Codex pet along the bottom of the page. Drag it, throw it, click or hold to pat it</small></span><input type="checkbox" class="gcx-switch" data-pk="on" ${p.on ? 'checked' : ''}></label>
      <div class="gcx-set-sub gcx-pets-main">
        <div class="gcx-pets-cur"></div>
        <div class="gcx-pets-pick" hidden>
          <input type="search" class="gcx-pets-search" placeholder="Search 3,600+ pets" aria-label="Search pets">
          <div class="gcx-pets-grid" role="list"></div>
          <div class="gcx-pets-foot"><span class="gcx-pets-status"></span><button type="button" class="gcx-pets-btn gcx-pets-make" aria-expanded="false" title="Draw a new pet with AI">Make one</button><button type="button" class="gcx-pets-btn gcx-pets-import" title="A pet .zip from codex-pets.net or Codex, a pet folder's pet.json and spritesheet, or just the spritesheet. You can also drop them on the pets">Import</button><button type="button" class="gcx-pets-btn gcx-pets-more" hidden>More</button></div>
          <div class="gcx-pets-gen" hidden>
            <textarea class="gcx-pets-desc" rows="2" maxlength="400" placeholder="Describe your pet: a sleepy cat in a hoodie, a frog in a graduation cap…" aria-label="Describe your pet"></textarea>
            <div class="gcx-pets-ideas">${IDEAS.map(([label, idea]) => `<button type="button" class="gcx-pets-idea" data-idea="${esc(idea)}">${esc(label)}</button>`).join('')}</div>
            <div class="gcx-pets-genfoot"><span class="gcx-pets-genstatus">Drawn by OpenAI with your key, like AI class covers. Takes about half a minute.</span><button type="button" class="gcx-pets-btn gcx-pets-go">Make it</button></div>
          </div>
          <input type="file" class="gcx-pets-file" accept=".zip,.webp,.png,.json,application/zip,image/webp,image/png,application/json" multiple hidden>
        </div>
        <div class="gcx-set-lbl">Size <span class="gcx-set-val">${Math.round(p.size * 100)}%</span></div>
        <input type="range" class="gcx-set-range" data-prange="size" min="40" max="160" step="5" value="${Math.round(p.size * 100)}" aria-label="Pet size">
      </div>
      <label class="gcx-set-row gcx-pets-dep"><span><b>Roams around</b><small>Walks along the bottom on its own, and now and then leaps across your class cards when it's on one. Off, it stays where you put it. Always off when page animations are off</small></span><input type="checkbox" class="gcx-switch" data-pk="roam" ${p.roam ? 'checked' : ''}></label>
      <div class="gcx-set-sub gcx-pets-dep gcx-pets-walk">
        <div class="gcx-set-lbl">How much it walks <span class="gcx-set-val">${Math.round(energy() * 100)}%</span></div>
        <input type="range" class="gcx-set-range" data-prange="walk" min="25" max="300" step="25" value="${Math.round(energy() * 100)}" aria-label="How much the pet walks">
      </div>
      <label class="gcx-set-row gcx-pets-dep"><span><b>Reminders</b><small>Now and then it pipes up in a little speech bubble: what's due soon, good luck on an exam, a cheer for a new grade, a teacher's comment, unread messages and announcements. Click the bubble to open it</small></span><input type="checkbox" class="gcx-switch" data-pk="remind" ${p.remind ? 'checked' : ''}></label>
      <label class="gcx-set-row gcx-pets-dep"><span><b>Pet sounds</b><small>A thud when it lands, soft footsteps, a whoosh when you throw it, a chirp when you pat it, little blips when it talks, and a quiet snore when it dozes off</small></span><input type="checkbox" class="gcx-switch" data-pk="sound" ${p.sound ? 'checked' : ''}></label>
      <div class="gcx-set-sub gcx-pets-dep gcx-pets-vol">
        <div class="gcx-set-lbl">Volume <span class="gcx-set-val">${Math.round(volume() * 100)}%</span></div>
        <input type="range" class="gcx-set-range" data-prange="volume" min="0" max="200" step="5" value="${Math.round(volume() * 100)}" aria-label="Pet volume">
      </div>`;
    const q = (s) => host.querySelector(s);
    const cur = q('.gcx-pets-cur');
    const pick = q('.gcx-pets-pick');
    const grid = q('.gcx-pets-grid');
    const status = q('.gcx-pets-status');
    const more = q('.gcx-pets-more');
    const search = q('.gcx-pets-search');
    const file = q('.gcx-pets-file');
    const genBox = q('.gcx-pets-gen');
    const desc = q('.gcx-pets-desc');
    const genStatus = q('.gcx-pets-genstatus');
    const go = q('.gcx-pets-go');
    let shown = []; // entries in the grid, by id
    let nextPage = 1;
    let gen = 0;

    const sync = () => {
      const on = prefs.on;
      q('.gcx-pets-main').classList.toggle('gcx-pets-dis', !on);
      host.querySelectorAll('.gcx-pets-dep').forEach((n) => n.classList.toggle('gcx-pets-dis', !on || !prefs.id || (n.classList.contains('gcx-pets-vol') && !prefs.sound) || (n.classList.contains('gcx-pets-walk') && !prefs.roam)));
      cur.innerHTML = prefs.id
        ? `<img alt="" src="${esc(prefs.thumb)}"><div><b>${esc(prefs.name)}</b><small>${esc(prefs.desc)}</small></div><button type="button" class="gcx-pets-btn gcx-pets-change">${pick.hidden ? 'Change' : 'Done'}</button>`
        : `<span class="gcx-pets-none"></span><div><b>No pet yet</b><small>Pick one below from codex-pets.net (the art belongs to each pet's maker), or import your own.</small></div>`;
      grid.querySelectorAll('.gcx-pets-tile').forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.petId === prefs.id)));
    };
    const tile = (e) => {
      const b = `<button type="button" class="gcx-pets-tile" role="listitem" data-pet-id="${esc(e.id)}" aria-pressed="${e.id === prefs.id}" title="${esc(e.displayName)}${e.description ? ' — ' + esc(e.description) : ''}"><img alt="" loading="lazy" src="${esc(e.thumbnail)}"><small>${esc(e.displayName)}</small></button>`;
      return e.mine ? `<div class="gcx-pets-own">${b}<button type="button" class="gcx-pets-x" data-forget="${esc(e.id)}" title="Remove" aria-label="Remove ${esc(e.displayName)}">×</button></div>` : b;
    };
    const show = (list, append) => {
      if (!append) (shown = []), (grid.innerHTML = '');
      const ok = list.filter((e) =>
        e && e.id && !shown.some((s) => s.id === e.id) && (e.mine ? /^mine-/.test(e.id) && OWN_THUMB.test(e.thumbnail || '') : LIB_ASSET.test(e.spritesheet || '') && LIB_ASSET.test(e.thumbnail || '')),
      );
      shown.push(...ok);
      grid.insertAdjacentHTML('beforeend', ok.map(tile).join(''));
    };
    // His own pets first (those matching the search), then the library's page.
    async function browse(append) {
      const g = ++gen;
      const text = search.value.trim();
      if (!append) {
        nextPage = 1;
        more.hidden = true;
        const words = text.toLowerCase().split(/\s+/).filter(Boolean);
        const own = await loadMine().catch(() => []);
        if (g !== gen) return;
        show(own.filter((e) => words.every((w) => `${e.displayName} ${e.description}`.toLowerCase().includes(w))), false);
      }
      status.textContent = text ? 'Searching…' : 'Loading pets…';
      try {
        const d = await libPage(nextPage, text);
        if (g !== gen) return;
        nextPage = d.page + 1;
        show(d.pets, true);
        more.hidden = d.page >= d.totalPages;
        status.innerHTML = text
          ? d.total
            ? `${d.total.toLocaleString()} found`
            : 'No pets match that.'
          : `${d.total.toLocaleString()} pets from <a href="https://codex-pets.net" target="_blank" rel="noopener">codex-pets.net</a>`;
      } catch (e) {
        if (g === gen) status.textContent = `Couldn't load pets (${e.message}).`;
      }
    }
    const open = (yes) => {
      pick.hidden = !yes;
      if (yes && !grid.children.length) browse(false);
      sync();
    };
    async function choose(entry, t) {
      if (t) t.classList.add('gcx-busy');
      status.textContent = `Fetching ${entry.displayName}…`;
      try {
        if (!entry.mine) await ask({ op: 'sheet', id: entry.id, url: entry.spritesheet });
        savePrefs({
          on: true,
          id: entry.id,
          name: entry.displayName,
          sheet: entry.mine ? 'mine' : entry.spritesheet,
          thumb: entry.thumbnail,
          ver: entry.spriteVersionNumber === 2 ? 2 : 1,
          desc: entry.description || '',
        });
        q('[data-pk="on"]').checked = true;
        status.textContent = `${entry.displayName} is on the page.`;
      } catch (err) {
        status.textContent = `Couldn't fetch ${entry.displayName} (${err.message}).`;
      }
      if (t) t.classList.remove('gcx-busy');
      sync();
    }
    // A dropped folder is opened up: its pet.json and images (or a .zip inside it).
    async function dropped(dt) {
      const entries = [...(dt.items || [])].map((i) => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
      if (!entries.some((en) => en.isDirectory)) return [...dt.files];
      const files = [];
      const fileOf = (en) => new Promise((res, rej) => en.file(res, rej));
      for (const en of entries) {
        if (en.isFile) files.push(await fileOf(en));
        else {
          const kids = await new Promise((res, rej) => en.createReader().readEntries(res, rej));
          for (const k of kids) if (k.isFile && /\.(json|webp|png|zip)$/i.test(k.name)) files.push(await fileOf(k));
        }
      }
      // pet.json first, then the sheet (named spritesheet.* if there's a choice)
      files.sort((x, y) => (/\.json$/i.test(y.name) - /\.json$/i.test(x.name)) || (/^spritesheet\./i.test(y.name) - /^spritesheet\./i.test(x.name)));
      return files;
    }
    async function importFiles(list) {
      const picked = [...list].slice(0, 4);
      if (!picked.length) return;
      status.textContent = 'Importing…';
      try {
        if (picked.some((f) => f.size > 12e6)) throw new Error('that file is too big for a pet');
        const { pet } = await ask({ op: 'import', files: await Promise.all(picked.map(readFile)) });
        search.value = '';
        await browse(false);
        await choose({ ...pet, mine: true });
        status.textContent = `Imported ${pet.displayName}.`;
      } catch (e) {
        status.textContent = `Couldn't import that (${e.message}).`;
      }
    }

    // A pet drawn by AI from his description (background.js makes the sheet).
    const drawing = () => {
      if (pick.hidden) open(true);
      go.disabled = true;
      genBox.hidden = false;
      q('.gcx-pets-make').setAttribute('aria-expanded', 'true');
      if (genJob) desc.value = genJob.desc;
      genStatus.textContent = 'Drawing your pet… (about half a minute)';
    };
    async function generate() {
      const text = desc.value.trim();
      if (genJob) return;
      if (text.length < 3) {
        genStatus.textContent = 'Describe your pet first.';
        return desc.focus();
      }
      genJob = { desc: text, run: startGen(text) };
      drawing();
      try {
        const pet = await genJob.run;
        if (!host.isConnected) return;
        search.value = '';
        await browse(false);
        await choose({ ...pet, mine: true });
        genStatus.textContent = `Made ${pet.displayName}. Make another, or pick it above any time.`;
      } catch (e) {
        genStatus.textContent = /no openai key/i.test(e.message)
          ? 'Add your OpenAI key first (the key button in Ask anything, or the extension’s options).'
          : `Couldn't make it (${e.message}).`;
      } finally {
        go.disabled = false;
      }
    }
    // Settings reopened while a pet is still being drawn: show that, and pick it up when it's done.
    if (genJob) {
      const job = genJob;
      drawing();
      job.run.then(
        async (pet) => {
          if (!host.isConnected) return;
          go.disabled = false;
          q('[data-pk="on"]').checked = true;
          await browse(false);
          sync();
          genStatus.textContent = `Made ${pet.displayName}. Make another, or pick it above any time.`;
        },
        (e) => {
          if (!host.isConnected) return;
          go.disabled = false;
          genStatus.textContent = /no openai key/i.test(e.message)
            ? 'Add your OpenAI key first (the key button in Ask anything, or the extension’s options).'
            : `Couldn't make it (${e.message}).`;
        },
      );
    }
    async function idea(b) {
      if (b.dataset.idea !== 'mascot') {
        desc.value = b.dataset.idea;
        return desc.focus();
      }
      b.disabled = true;
      genStatus.textContent = 'Looking up your school’s mascot…';
      try {
        const r = await ask({ op: 'mascot', host: location.host }, 0);
        desc.value = r.desc;
        genStatus.textContent = 'Change anything you like, then Make it.';
        desc.focus();
      } catch (e) {
        genStatus.textContent = /no openai key/i.test(e.message) ? 'Add your OpenAI key first (the key button in Ask anything, or the extension’s options).' : `Couldn't find it (${e.message}).`;
      } finally {
        b.disabled = false;
      }
    }

    host.addEventListener('change', (e) => {
      if (e.target === file) {
        e.stopPropagation();
        importFiles(file.files).finally(() => (file.value = ''));
        return;
      }
      const k = e.target.dataset && e.target.dataset.pk;
      if (!k) return;
      e.stopPropagation();
      savePrefs({ [k]: e.target.checked });
      if (k === 'on' && e.target.checked && !prefs.id) open(true);
      if (k === 'sound' && e.target.checked) {
        unlock();
        thud(0.6);
      }
      sync();
    });
    host.addEventListener('input', (e) => {
      if (e.target.dataset && e.target.dataset.prange === 'size') {
        e.stopPropagation();
        const v = Number(e.target.value);
        e.target.parentElement.querySelector('.gcx-set-val').textContent = v + '%';
        savePrefs({ size: v / 100 });
      } else if (e.target.dataset && e.target.dataset.prange === 'walk') {
        e.stopPropagation();
        const v = Number(e.target.value);
        e.target.parentElement.querySelector('.gcx-set-val').textContent = v + '%';
        savePrefs({ walk: v / 100 });
        nextWander = Math.min(nextWander, Date.now() + rand(WANDER_MIN, WANDER_MAX) / energy());
      } else if (e.target.dataset && e.target.dataset.prange === 'volume') {
        e.stopPropagation();
        const v = Number(e.target.value);
        e.target.parentElement.querySelector('.gcx-set-val').textContent = v + '%';
        savePrefs({ volume: v / 100 });
        if (out) out.gain.value = volume();
        // a soft pat to hear the new level (at most a few a second while dragging)
        if (Date.now() - (e.target._at || 0) > 250) {
          e.target._at = Date.now();
          unlock();
          chirp();
        }
      } else if (e.target === search) {
        e.stopPropagation();
        clearTimeout(search._t);
        search._t = setTimeout(() => browse(false), 300);
      }
    });
    search.addEventListener('keydown', (e) => e.stopPropagation());
    // Pet files dropped on the grid import like the button does.
    const hasFiles = (e) => [...((e.dataTransfer && e.dataTransfer.types) || [])].includes('Files');
    host.addEventListener('dragover', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      grid.classList.add('gcx-drop');
    });
    host.addEventListener('dragleave', (e) => !host.contains(e.relatedTarget) && grid.classList.remove('gcx-drop'));
    host.addEventListener('drop', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.stopPropagation();
      grid.classList.remove('gcx-drop');
      if (pick.hidden) open(true);
      dropped(e.dataTransfer).then(importFiles, (err) => (status.textContent = `Couldn't import that (${err.message}).`));
    });
    petsBox = box.getRootNode() instanceof ShadowRoot ? box.getRootNode().host : box;
    host.addEventListener('click', async (e) => {
      if (e.target.closest('.gcx-pets-change')) return open(pick.hidden);
      if (e.target.closest('.gcx-pets-more')) return browse(true);
      if (e.target.closest('.gcx-pets-import')) return file.click();
      const mk = e.target.closest('.gcx-pets-make');
      if (mk) {
        genBox.hidden = !genBox.hidden;
        mk.setAttribute('aria-expanded', String(!genBox.hidden));
        if (!genBox.hidden) desc.focus();
        return;
      }
      if (e.target.closest('.gcx-pets-go')) return generate();
      const ib = e.target.closest('.gcx-pets-idea');
      if (ib) return idea(ib);
      const x = e.target.closest('.gcx-pets-x');
      if (x) {
        const id = x.dataset.forget;
        const entry = shown.find((s) => s.id === id);
        try {
          await ask({ op: 'forget', id });
          x.parentElement.remove();
          shown = shown.filter((s) => s.id !== id);
          if (prefs.id === id) savePrefs({ id: null, name: '', sheet: '', thumb: '', desc: '' });
          status.textContent = `Removed ${entry ? entry.displayName : 'that pet'}.`;
        } catch (err) {
          status.textContent = `Couldn't remove it (${err.message}).`;
        }
        return sync();
      }
      const t = e.target.closest('.gcx-pets-tile');
      if (!t || t.classList.contains('gcx-busy')) return;
      const entry = shown.find((s) => s.id === t.dataset.petId);
      if (entry) choose(entry, t);
    });
    sync();
    if (prefs.on && !prefs.id) open(true);
  }
  window.addEventListener('gcx:settings', (e) => fill(e.detail));

  // A page built ahead of time (prerendered) gets the pet only once he arrives, from where it was
  // on the page he came from.
  if (document.prerendering) document.addEventListener('prerenderingchange', () => apply(), { once: true });
  else apply();
})();
