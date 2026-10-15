// In-page file viewer: clicking a Canvas file opens it over the current page instead of
// navigating away. PDFs and text render in viewer/viewer.html (pdf.js, in an extension
// iframe); Office files use Canvas's own DocViewer; images and media use native elements.
(() => {
  'use strict';
  if (window.top !== window) return;
  const gcx = window.gcx;
  if (!gcx) return;
  const { api, esc } = gcx;

  const P = {
    back: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
    download: 'M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z',
    share: 'M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z',
    zoomIn: 'M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zm2.5-4h-2v2H9v-2H7V9h2V7h1v2h2v1z',
    zoomOut: 'M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zM7 9h5v1H7z',
    minus: 'M19 13H5v-2h14v2z',
    plus: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
    pdf: 'M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z',
    slides: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 13H5V6h14v10z',
    doc: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 14H7v-2h10v2zm0-4H7v-2h10v2zm0-4H7V7h10v2z',
    sheet: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 2v3H5V5h14zm-9 14H5v-9h5v9zm2 0v-9h7v9h-7z',
    image: 'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z',
    video: 'M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z',
    audio: 'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z',
    text: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
  };
  const icon = (name, size = 24) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="${P[name]}"/></svg>`;
  const KIND = {
    pdf: { icon: 'pdf', color: '#ea4335' },
    office: { icon: 'doc', color: '#4285f4' },
    image: { icon: 'image', color: '#ea4335' },
    video: { icon: 'video', color: '#ea4335' },
    audio: { icon: 'audio', color: '#a142f4' },
    text: { icon: 'text', color: '#9aa0a6' },
    other: { icon: 'text', color: '#9aa0a6' },
  };

  // With use_dynamic_url the frame may end up on the extension's static id, so messages are
  // matched by source window (our own iframe) plus the chrome-extension scheme, not exact origin.
  const VIEWER_URL = chrome.runtime.getURL('viewer/viewer.html');
  const FROM_VIEWER = /^chrome-extension:\/\//;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  function kindOf(meta) {
    const ct = String(meta['content-type'] || '').toLowerCase();
    const ext = (String(meta.display_name || meta.filename || '').match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase() || '';
    if (ct === 'application/pdf' || ext === 'pdf') return 'pdf';
    if (/^image\/(png|jpe?g|gif|webp|svg\+xml|bmp|avif|x-icon)$/.test(ct)) return 'image';
    if (/^video\/(mp4|webm|ogg)$/.test(ct) || ['mp4', 'webm', 'm4v'].includes(ext)) return 'video';
    if (/^audio\//.test(ct) || ['mp3', 'wav', 'm4a', 'ogg', 'aac'].includes(ext)) return 'audio';
    if (['ppt', 'doc', 'xls'].includes(meta.mime_class) || /^(pptx?|docx?|xlsx?|odt|odp|ods|rtf|pages|key|numbers)$/.test(ext)) return 'office';
    if (
      /^text\//.test(ct) ||
      /^application\/(json|xml|javascript|x-javascript|x-python|x-r|csv|x-sh|x-yaml|yaml|x-tex|x-ipynb\+json)$/.test(ct) ||
      ['txt', 'md', 'csv', 'tsv', 'py', 'r', 'rmd', 'qmd', 'java', 'c', 'cpp', 'h', 'hpp', 'js', 'ts', 'json', 'xml', 'sql', 'm', 'sh', 'yml', 'yaml', 'log', 'tex', 'ipynb'].includes(ext)
    )
      return 'text';
    if (meta.preview_url) return 'office';
    return 'other';
  }
  function officeIcon(meta) {
    const ext = (String(meta.display_name || '').match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase() || '';
    if (meta.mime_class === 'ppt' || /^(pptx?|odp|key)$/.test(ext)) return { icon: 'slides', color: '#f9ab00' };
    if (meta.mime_class === 'xls' || /^(xlsx?|ods|numbers|csv)$/.test(ext)) return { icon: 'sheet', color: '#34a853' };
    return KIND.office;
  }
  const fmtSize = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n > 1024 ? `${Math.round(n / 1024)} KB` : `${n || 0} B`);

  function toast(msg) {
    if (typeof gcx.toast === 'function') return gcx.toast(msg);
    const t = document.createElement('div');
    t.className = 'gcx-fv-toast';
    t.textContent = msg;
    (ov || document.body).append(t);
    setTimeout(() => t.remove(), 2200);
  }

  // ---------------------------------------------------------------- overlay
  let ov = null; // the open overlay element
  let state = null; // { fid, cid, meta, kind, frame, zoom, page, pages, fit, img, returnFocus, pushed }

  function build(name) {
    const root = document.createElement('div');
    root.id = 'gcx-fv';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', name || 'File preview');
    root.innerHTML = `
      <div class="gcx-fv-scrim"></div>
      <header class="gcx-fv-top">
        <button type="button" class="gcx-fv-btn gcx-fv-close" title="Back (Esc)" aria-label="Close preview">${icon('back')}</button>
        <span class="gcx-fv-type">${icon('text', 22)}</span>
        <div class="gcx-fv-name" title="${esc(name)}">${esc(name || 'Loading…')}</div>
        <div class="gcx-fv-actions">
          <button type="button" class="gcx-fv-btn gcx-fv-dl" title="Download" aria-label="Download" disabled>${icon('download')}</button>
          <button type="button" class="gcx-fv-btn gcx-fv-share" title="Copy link" aria-label="Copy link to this file" disabled>${icon('share')}</button>
          <button type="button" class="gcx-fv-btn gcx-fv-fit" title="Fit to width" aria-label="Fit to width" hidden>${icon('zoomIn')}</button>
        </div>
      </header>
      <main class="gcx-fv-stage"></main>
      <div class="gcx-fv-loading"><div class="gcx-fv-spin"></div><div class="gcx-fv-bar"><i></i></div></div>
      <div class="gcx-fv-pill" hidden>
        <button type="button" class="gcx-fv-pb gcx-fv-zout" title="Zoom out (Ctrl -)" aria-label="Zoom out">${icon('minus', 18)}</button>
        <button type="button" class="gcx-fv-pct" title="Reset zoom (Ctrl 0)">100%</button>
        <button type="button" class="gcx-fv-pb gcx-fv-zin" title="Zoom in (Ctrl +)" aria-label="Zoom in">${icon('plus', 18)}</button>
        <span class="gcx-fv-sep"></span>
        <label class="gcx-fv-pg"><input type="text" inputmode="numeric" aria-label="Page number" value="1"><span>/ 1</span></label>
      </div>`;
    return root;
  }

  async function openFile(fid, opts = {}) {
    fid = String(fid);
    if (!/^\d+$/.test(fid)) return false;
    // Opening a second file replaces the first one's history entry instead of stacking another.
    const replacing = !!(ov && state && state.pushed && history.state && history.state.gcxfv === state.fid);
    if (ov) closeNow(true);
    const cid = opts.courseId ? String(opts.courseId) : gcx.COURSE_ID ? String(gcx.COURSE_ID) : '';
    ov = build(opts.name || '');
    state = { fid, cid, meta: null, kind: '', zoom: 1, page: 1, pages: 0, fit: 'auto', returnFocus: document.activeElement, pushed: false, fallback: opts.fallback || '' };
    const me = state;
    document.body.append(ov);
    document.documentElement.classList.add('gcx-fv-open');
    wire(ov);
    requestAnimationFrame(() => ov && ov.classList.add('in'));
    ov.querySelector('.gcx-fv-close').focus({ preventScroll: true });

    let meta;
    try {
      meta = await api(`/files/${fid}?include[]=preview_url`).catch((e) => (cid ? api(`/courses/${cid}/files/${fid}?include[]=preview_url`) : Promise.reject(e)));
    } catch (e) {
      meta = null;
    }
    if (state !== me) return true;
    if (!meta || meta.locked_for_user || meta.hidden_for_user) {
      // Locked or not visible through the API: let Canvas show its own page (it explains why).
      const href = me.fallback || (cid ? `/courses/${cid}/files/${fid}` : `/files/${fid}`);
      closeNow(true);
      location.href = href;
      return true;
    }
    // Only now add a history entry (so Back closes the viewer); a fallback navigation above never leaves one behind.
    try {
      if (replacing) history.replaceState({ ...(history.state || {}), gcxfv: fid }, '');
      else history.pushState({ ...(history.state || {}), gcxfv: fid }, '');
      state.pushed = true;
    } catch {}
    state.meta = meta;
    state.kind = kindOf(meta);
    const k = state.kind === 'office' ? officeIcon(meta) : KIND[state.kind];
    const type = ov.querySelector('.gcx-fv-type');
    type.innerHTML = icon(k.icon, 22);
    type.style.color = k.color;
    const name = meta.display_name || opts.name || 'File';
    ov.querySelector('.gcx-fv-name').textContent = name;
    ov.querySelector('.gcx-fv-name').title = name;
    ov.setAttribute('aria-label', name);
    ov.querySelector('.gcx-fv-dl').disabled = !meta.url;
    ov.querySelector('.gcx-fv-share').disabled = false;
    await show(me);
    return true;
  }

  async function publicUrl(fid) {
    try {
      const r = await api(`/files/${fid}/public_url`);
      return r && r.public_url ? r.public_url : '';
    } catch {
      return '';
    }
  }

  async function show(me) {
    const stage = ov.querySelector('.gcx-fv-stage');
    const { meta, kind } = me;
    const done = () => {
      if (state !== me) return;
      ov.classList.add('ready');
    };
    if (kind === 'pdf' || kind === 'text') {
      const src = await publicUrl(me.fid);
      if (state !== me) return;
      const q = new URLSearchParams({ src, alt: meta.url || '', mode: kind, o: location.origin, name: meta.display_name || '' });
      const frame = document.createElement('iframe');
      frame.className = 'gcx-fv-frame';
      frame.title = meta.display_name || 'File preview';
      frame.src = `${VIEWER_URL}?${q}`;
      me.frame = frame;
      stage.append(frame);
      ov.querySelector('.gcx-fv-fit').hidden = kind !== 'pdf';
      // The frame reports 'ready' (or 'error'); give up on the spinner after a while regardless.
      setTimeout(done, 20000);
    } else if (kind === 'office') {
      const preview = meta.preview_url || meta.canvadoc_session_url;
      if (!preview) return card(me, 'No preview is available for this file.');
      const frame = document.createElement('iframe');
      frame.className = 'gcx-fv-frame gcx-fv-doc';
      frame.title = meta.display_name || 'Document preview';
      frame.allow = 'fullscreen';
      frame.src = new URL(preview, location.origin).href;
      frame.addEventListener('load', () => setTimeout(done, 150), { once: true });
      setTimeout(done, 15000);
      me.frame = frame;
      stage.append(frame);
    } else if (kind === 'image') {
      const src = (await publicUrl(me.fid)) || meta.url;
      if (state !== me) return;
      const wrap = document.createElement('div');
      wrap.className = 'gcx-fv-imgwrap';
      const img = document.createElement('img');
      img.className = 'gcx-fv-img';
      img.alt = meta.display_name || '';
      img.decoding = 'async';
      img.addEventListener('load', () => {
        if (state !== me) return;
        me.img = img;
        fitImage(me, true);
        ov.querySelector('.gcx-fv-pill').hidden = false;
        ov.querySelector('.gcx-fv-pg').hidden = true;
        ov.querySelector('.gcx-fv-sep').hidden = true;
        ov.querySelector('.gcx-fv-fit').hidden = false;
        done();
      });
      img.addEventListener('error', () => card(me, 'This image couldn’t be shown.'));
      img.src = src;
      wrap.append(img);
      stage.append(wrap);
      stage.classList.add('scroll');
      enableImagePan(stage, me);
    } else if (kind === 'video' || kind === 'audio') {
      const src = (await publicUrl(me.fid)) || meta.url;
      if (state !== me) return;
      const media = document.createElement(kind);
      media.className = `gcx-fv-${kind}`;
      media.controls = true;
      media.preload = 'metadata';
      media.src = src;
      media.addEventListener('loadedmetadata', done, { once: true });
      media.addEventListener('error', () => card(me, 'This file can’t be played here.'), { once: true });
      setTimeout(done, 8000);
      stage.append(media);
    } else {
      card(me, 'No preview is available for this file type.');
    }
  }

  function card(me, why) {
    if (state !== me) return;
    const { meta } = me;
    const k = me.kind === 'office' ? officeIcon(meta) : KIND[me.kind] || KIND.other;
    const stage = ov.querySelector('.gcx-fv-stage');
    stage.classList.remove('scroll');
    stage.innerHTML = `<div class="gcx-fv-card">
        <span class="gcx-fv-card-ic" style="color:${k.color}">${icon(k.icon, 48)}</span>
        <div class="gcx-fv-card-name">${esc(meta.display_name || 'File')}</div>
        <div class="gcx-fv-card-sub">${esc(why)}${meta.size ? ` · ${esc(fmtSize(meta.size))}` : ''}</div>
        ${meta.url ? `<button type="button" class="gcx-fv-cta">${icon('download', 20)}<span>Download</span></button>` : ''}
      </div>`;
    const cta = stage.querySelector('.gcx-fv-cta');
    if (cta) cta.addEventListener('click', download);
    ov.querySelector('.gcx-fv-pill').hidden = true;
    ov.querySelector('.gcx-fv-fit').hidden = true;
    ov.classList.add('ready');
  }

  // ----- images: fit to the stage, zoom with the pill / ctrl+wheel, drag to pan
  function fitImage(me, initial) {
    const img = me.img;
    const stage = ov.querySelector('.gcx-fv-stage');
    const fitZ = Math.min((stage.clientWidth - 48) / img.naturalWidth, (stage.clientHeight - 48) / img.naturalHeight, 1);
    setImageZoom(me, fitZ, null, 'auto');
    if (initial) me.fitZ = fitZ;
  }
  function setImageZoom(me, z, anchor, fit = null) {
    const img = me.img;
    if (!img) return;
    const stage = ov.querySelector('.gcx-fv-stage');
    z = Math.max(0.05, Math.min(8, z));
    const r = img.getBoundingClientRect();
    const ax = anchor ? anchor.x : stage.getBoundingClientRect().left + stage.clientWidth / 2;
    const ay = anchor ? anchor.y : stage.getBoundingClientRect().top + stage.clientHeight / 2;
    const fx = (ax - r.left) / r.width;
    const fy = (ay - r.top) / r.height;
    img.style.width = `${Math.round(img.naturalWidth * z)}px`;
    img.style.height = `${Math.round(img.naturalHeight * z)}px`;
    const r2 = img.getBoundingClientRect();
    if (Number.isFinite(fx) && Number.isFinite(fy)) {
      stage.scrollLeft += r2.left + fx * r2.width - ax;
      stage.scrollTop += r2.top + fy * r2.height - ay;
    }
    me.zoom = z;
    me.fit = fit;
    syncPill();
  }
  function enableImagePan(stage, me) {
    let drag = null;
    stage.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !me.img || !e.target.closest('.gcx-fv-img')) return;
      if (stage.scrollWidth <= stage.clientWidth && stage.scrollHeight <= stage.clientHeight) return;
      drag = { x: e.clientX, y: e.clientY, l: stage.scrollLeft, t: stage.scrollTop };
      stage.setPointerCapture(e.pointerId);
      stage.classList.add('dragging');
      e.preventDefault();
    });
    stage.addEventListener('pointermove', (e) => {
      if (!drag) return;
      stage.scrollLeft = drag.l - (e.clientX - drag.x);
      stage.scrollTop = drag.t - (e.clientY - drag.y);
    });
    const end = () => {
      drag = null;
      stage.classList.remove('dragging');
    };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
    stage.addEventListener(
      'wheel',
      (e) => {
        if (!e.ctrlKey || !me.img) return;
        e.preventDefault();
        setImageZoom(me, me.zoom * Math.exp(-e.deltaY * 0.0025), { x: e.clientX, y: e.clientY });
      },
      { passive: false },
    );
  }

  // ----- pill + toolbar
  function syncPill() {
    if (!ov || !state) return;
    const pill = ov.querySelector('.gcx-fv-pill');
    ov.querySelector('.gcx-fv-pct').textContent = `${Math.round(state.zoom * 100)}%`;
    const input = ov.querySelector('.gcx-fv-pg input');
    if (document.activeElement !== input) input.value = String(state.page);
    ov.querySelector('.gcx-fv-pg span').textContent = `/ ${state.pages}`;
    input.style.setProperty('width', `${String(state.pages || 1).length + 2}ch`, 'important');
    const fitBtn = ov.querySelector('.gcx-fv-fit');
    const toWidth = state.fit !== 'width';
    const label = state.kind === 'image' ? (state.fit === 'auto' ? 'Actual size' : 'Fit to screen') : toWidth ? 'Fit to width' : 'Fit to page';
    fitBtn.title = label;
    fitBtn.setAttribute('aria-label', label);
    fitBtn.innerHTML = icon((state.kind === 'image' ? state.fit === 'auto' : toWidth) ? 'zoomIn' : 'zoomOut');
    if (state.kind === 'pdf' || state.kind === 'text') {
      pill.hidden = false;
      const paged = state.kind === 'pdf' && state.pages > 0;
      ov.querySelector('.gcx-fv-pg').hidden = !paged;
      ov.querySelector('.gcx-fv-sep').hidden = !paged;
    }
  }
  // Commands carry nothing private (zoom / page numbers), and the frame checks they came from its parent.
  const toFrame = (msg) => state && state.frame && state.frame.contentWindow && state.frame.contentWindow.postMessage({ gcxfv: 1, ...msg }, '*');

  function zoomBy(dir) {
    if (!state) return;
    if (state.kind === 'image') {
      const steps = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6, 8];
      const z = state.zoom;
      const next = dir > 0 ? steps.find((s) => s > z + 0.001) ?? 8 : [...steps].reverse().find((s) => s < z - 0.001) ?? 0.05;
      setImageZoom(state, next);
    } else toFrame({ type: 'zoom', dir });
  }
  function resetZoom() {
    if (!state) return;
    if (state.kind === 'image') fitImage(state);
    else toFrame({ type: 'fit', reset: true });
  }
  function toggleFit() {
    if (!state) return;
    if (state.kind === 'image') {
      if (state.fit === 'auto') setImageZoom(state, 1, null, null);
      else fitImage(state);
    } else toFrame({ type: 'fit' });
  }

  function shareLink() {
    if (!state) return;
    const url = `${location.origin}${state.cid ? `/courses/${state.cid}` : ''}/files/${state.fid}`;
    const ok = () => toast('Link copied');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(ok, () => legacyCopy(url) && ok());
    else if (legacyCopy(url)) ok();
  }
  function legacyCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;left:-9999px';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {}
    ta.remove();
    return ok;
  }
  function download() {
    if (!state || !state.meta || !state.meta.url) return;
    const u = new URL(state.meta.url, location.origin);
    u.searchParams.set('download_frd', '1');
    // An attachment response downloads without leaving the page.
    const a = document.createElement('a');
    a.href = u.href;
    a.dataset.gcxNoPreview = '1';
    a.style.display = 'none';
    document.body.append(a);
    a.click();
    a.remove();
    toast('Downloading…');
  }

  function wire(root) {
    root.querySelector('.gcx-fv-close').addEventListener('click', () => close());
    root.querySelector('.gcx-fv-scrim').addEventListener('click', () => close());
    root.querySelector('.gcx-fv-dl').addEventListener('click', download);
    root.querySelector('.gcx-fv-share').addEventListener('click', shareLink);
    root.querySelector('.gcx-fv-fit').addEventListener('click', toggleFit);
    root.querySelector('.gcx-fv-zin').addEventListener('click', () => zoomBy(1));
    root.querySelector('.gcx-fv-zout').addEventListener('click', () => zoomBy(-1));
    root.querySelector('.gcx-fv-pct').addEventListener('click', resetZoom);
    const stage = root.querySelector('.gcx-fv-stage');
    stage.addEventListener('click', (e) => {
      if (e.target === stage || e.target.classList.contains('gcx-fv-imgwrap')) close();
    });
    const input = root.querySelector('.gcx-fv-pg input');
    input.addEventListener('focus', () => input.select());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const n = parseInt(input.value, 10);
        if (n >= 1 && n <= state.pages) toFrame({ type: 'goto', page: n });
        else input.value = String(state.page);
        toFrame({ type: 'focus' });
        state.frame && state.frame.focus();
      } else if (e.key === 'Escape') {
        e.stopPropagation();
        input.value = String(state.page);
        input.blur();
      }
    });
    input.addEventListener('blur', () => state && (input.value = String(state.page)));
  }

  function close() {
    if (!ov) return;
    const ours = !!(state && state.pushed && history.state && history.state.gcxfv === state.fid);
    closeNow();
    if (!ours) return;
    // Drop the entry we added so Back doesn't land on a dead step. Only go back when the
    // previous entry is this same page; otherwise just strip our marker from the state.
    const nav = window.navigation;
    const prev = nav && nav.currentEntry && nav.entries()[nav.currentEntry.index - 1];
    if (prev && prev.sameDocument) history.back();
    else {
      const { gcxfv, ...rest } = history.state || {};
      history.replaceState(rest, '');
    }
  }
  function closeNow(instant) {
    const root = ov;
    const st = state;
    ov = null;
    state = null;
    if (!root) return;
    document.documentElement.classList.remove('gcx-fv-open');
    const finish = () => root.remove();
    if (instant || reduced()) finish();
    else {
      root.classList.remove('in');
      root.classList.add('out');
      setTimeout(finish, 200);
    }
    if (st && st.returnFocus && st.returnFocus.focus && document.contains(st.returnFocus)) {
      try {
        st.returnFocus.focus({ preventScroll: true });
      } catch {}
    }
  }
  window.addEventListener('popstate', () => {
    if (ov && !(history.state && history.state.gcxfv === (state && state.fid))) closeNow();
  });

  // Messages from the viewer frame.
  window.addEventListener('message', (e) => {
    if (!state || !state.frame || e.source !== state.frame.contentWindow || !FROM_VIEWER.test(e.origin)) return;
    const m = e.data || {};
    if (m.gcxfv !== 1) return;
    if (m.type === 'ready') {
      ov.classList.add('ready');
      syncPill();
    } else if (m.type === 'state') {
      state.page = m.page || 1;
      state.pages = m.pages || 0;
      state.zoom = m.zoom || 1;
      state.fit = m.fit || null;
      syncPill();
    } else if (m.type === 'progress') {
      const bar = ov.querySelector('.gcx-fv-bar i');
      if (bar) bar.style.width = `${Math.round((m.ratio || 0) * 100)}%`;
    } else if (m.type === 'error') {
      card(state, m.message || 'This file couldn’t be opened.');
    } else if (m.type === 'key' && m.key === 'Escape') close();
    else if (m.type === 'backdrop') close();
  });

  // Keys while the viewer is open and focus is on the overlay (not inside the frame).
  document.addEventListener(
    'keydown',
    (e) => {
      if (!ov || !state) return;
      const inInput = e.target && e.target.closest && e.target.closest('.gcx-fv-pg');
      if (e.key === 'Escape' && !inInput) {
        e.preventDefault();
        e.stopPropagation();
        close();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        zoomBy(1);
      } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        zoomBy(-1);
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        resetZoom();
      } else if (!inInput && state.kind === 'pdf' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        toFrame({ type: 'goto', page: state.page + (e.key === 'ArrowRight' ? 1 : -1) });
      } else if (e.key === 'Tab') {
        // Keep focus inside the dialog.
        const f = [...ov.querySelectorAll('button:not([disabled]):not([hidden]), input, iframe')].filter((n) => n.offsetParent !== null);
        if (!f.length) return;
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) {
          e.preventDefault();
          f[f.length - 1].focus();
        } else if (!e.shiftKey && i === f.length - 1) {
          e.preventDefault();
          f[0].focus();
        }
      }
    },
    true,
  );
  window.addEventListener('resize', () => {
    if (state && state.kind === 'image' && state.img && state.fit === 'auto') fitImage(state);
  });

  // ---------------------------------------------------------------- click interception
  // /courses/1/files/2, /files/2, /users/1/files/2, /groups/1/files/2, optional /preview or (wrap=1) /download
  const FILE_PATH = /^\/(?:(courses|users|groups)\/(\d+)\/)?files\/(\d+)(\/(preview|download))?\/?$/;
  function fileFromLink(a) {
    if (a.dataset.gcxNoPreview || a.hasAttribute('download')) return null;
    if (a.dataset.gcxFile) {
      return { fid: a.dataset.gcxFile, cid: a.dataset.gcxCourse || '' };
    }
    let u;
    try {
      u = new URL(a.getAttribute('href') || '', location.href);
    } catch {
      return null;
    }
    if (u.origin !== location.origin) return null;
    const m = u.pathname.match(FILE_PATH);
    if (m) {
      if (u.searchParams.has('download_frd')) return null;
      if (m[5] === 'download' && u.searchParams.get('wrap') !== '1') return null;
      return { fid: m[3], cid: m[1] === 'courses' ? m[2] : '' };
    }
    // Rich-content file links carry their API endpoint.
    const ep = a.getAttribute('data-api-endpoint') || '';
    if (a.getAttribute('data-api-returntype') === 'File') {
      const e = ep.match(/\/api\/v1\/(?:courses\/(\d+)\/)?files\/(\d+)/);
      if (e) return { fid: e[2], cid: e[1] || '' };
    }
    return null;
  }
  document.addEventListener(
    'click',
    (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const a = e.target && e.target.closest && e.target.closest('a[href], [data-gcx-file]');
      if (!a || a.closest('#gcx-fv')) return;
      const hit = fileFromLink(a);
      if (!hit) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const name = (a.dataset.gcxName || a.querySelector('.gcx-row-title')?.textContent || a.textContent || '').replace(/\s+/g, ' ').trim();
      openFile(hit.fid, { courseId: hit.cid, name, fallback: a.href || '' });
    },
    true,
  );

  gcx.openFile = (fileId, opts = {}) => openFile(fileId, opts);
})();
