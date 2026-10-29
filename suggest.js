// Inbox suggestions: while he writes a message in Canvas's Inbox, gray text after the cursor
// suggests how it goes on (the whole reply when the box is still empty). Tab takes it,
// Ctrl + → takes one word, Esc hides it, and typing what it says eats it as you go.
// The model runs in background.js; this file reads the thread off the Compose dialog and draws
// the gray text in a layer laid exactly over Canvas's textarea (a textarea can't style part of
// its own text), so Canvas's React state is only ever changed by real typing or insertText.
(() => {
  'use strict';
  if (window.top !== window) return;
  const gcx = window.gcx;
  if (!gcx) return;

  const BODY = 'textarea[data-testid="message-body"]';
  const on = () => gcx.prefs().suggest !== false;
  const WAIT_TYPING = 650;
  const WAIT_FOCUS = 200;

  let ta = null; // the message box being written in
  let ghost = ''; // the suggestion still on offer
  let base = ''; // the box's value when the suggestion was made
  let at = 0; // where in that value it goes
  let loading = false;
  let timer = 0;
  let seq = 0;
  let asked = ''; // the draft the last request was for (no asking twice for the same text)
  let dead = false; // no key: stop asking on this page
  let layer = null;
  let raf = 0;
  let painted = null; // the textarea we made see-through, to put back
  let eatEscUp = false; // an Esc we used: its keyup mustn't close the dialog either
  let waits = 0; // tries left for a reply's earlier messages to show up

  // ---------------------------------------------------------------- what the model is told
  // The dialog shows the earlier messages under the box ("past-messages") and the course, people
  // and subject above it; the rest of its text is buttons, which don't hurt.
  function context(t) {
    const modal = t.closest('[role="dialog"], [aria-modal="true"]');
    if (!modal) return { thread: '', header: '' };
    const past = modal.querySelector('[data-testid="past-messages"]');
    const thread = past ? past.innerText.trim() : '';
    let header = modal.innerText;
    if (thread) header = header.replace(past.innerText, '');
    header = header.replace(/\n{2,}/g, '\n').trim();
    return { thread: thread.slice(0, 8000), header: header.slice(0, 1200) };
  }

  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(ask, ms);
  }

  async function ask() {
    const t = ta;
    if (!t || dead || !on() || !t.isConnected || document.activeElement !== t || t.disabled || t.readOnly) return;
    if (t.selectionStart !== t.selectionEnd) return;
    const v = t.value;
    const pos = t.selectionStart;
    const before = v.slice(0, pos);
    const after = v.slice(pos);
    // In the middle of a word: nothing to add there.
    if (/^\S/.test(after) && /\S$/.test(before)) return;
    const { thread, header } = context(t);
    // A new message (no thread) gets help once he's started it; a reply, from the empty box.
    if (!thread && before.trim().split(/\s+/).filter(Boolean).length < 2) {
      // A reply's earlier messages can render a moment after the box: look again shortly.
      if (!before.trim() && waits-- > 0) schedule(400);
      return;
    }
    const key = before + '\u0000' + after;
    if (key === asked) return;
    asked = key;
    const id = ++seq;
    const empty = !before.trim();
    if (empty) show('', pos, true);
    let res;
    try {
      const me = gcx.getMe && gcx.getMe();
      res = await chrome.runtime.sendMessage({ type: 'gcxSuggest', me: (me && me.name) || '', thread, header, before: before.slice(-4000), after: after.slice(0, 1500) });
    } catch {
      res = null;
    }
    if (id !== seq || ta !== t || t.value !== v || t.selectionStart !== pos || document.activeElement !== t) return;
    if (!res || res.error || !res.text) {
      if (res && /nokey|badkey/.test(res.code || '')) dead = true;
      // A failed request (not an empty answer) may be tried again for this same draft.
      if (!res || res.error) asked = '';
      return hide();
    }
    let text = res.text.replace(/\s+$/, '');
    if (!before || /\n\s*$/.test(before)) text = text.replace(/^\s+/, '');
    else if (/\s$/.test(before)) text = text.replace(/^[ \t]+/, '');
    if (!text.trim()) return hide();
    show(text, pos, false);
  }

  // ---------------------------------------------------------------- the gray text
  const COPY = [
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant', 'fontStretch', 'lineHeight', 'letterSpacing', 'wordSpacing',
    'textTransform', 'textIndent', 'textAlign', 'tabSize', 'direction', 'wordBreak', 'overflowWrap',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  ];
  function show(text, pos, isLoading) {
    ghost = text;
    loading = isLoading;
    base = ta.value;
    at = pos;
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'gcx-sg';
      layer.setAttribute('aria-hidden', 'true');
      document.body.append(layer);
    }
    const v = base;
    const after = v.slice(at);
    // With text after the cursor (a signature, say), the gray text has to push it along, so the
    // layer draws all of it and the textarea's own text goes see-through (its caret stays).
    const full = /\S/.test(after);
    const cs = getComputedStyle(ta);
    layer.classList.toggle('full', full);
    layer.style.setProperty('--sg-ink', cs.color);
    const span = (cls, s) => `<span class="${cls}">${gcx.esc(s)}</span>`;
    layer.innerHTML =
      span('gcx-sg-pre', v.slice(0, at)) +
      (loading ? '<span class="gcx-sg-wait">Writing a reply…</span>' : span('gcx-sg-ghost', ghost) + '<span class="gcx-sg-key">Tab</span>') +
      span('gcx-sg-post', after) +
      // keeps a trailing newline's empty line, like the textarea does
      '​';
    for (const k of COPY) layer.style[k] = cs[k];
    paintBox(full ? cs.color : null);
    place();
    if (!raf) raf = requestAnimationFrame(follow);
  }
  function paintBox(ink) {
    if (ink) {
      painted = ta;
      ta.style.setProperty('-webkit-text-fill-color', 'transparent', 'important');
      ta.style.setProperty('caret-color', ink, 'important');
    } else unpaint();
  }
  function unpaint() {
    if (!painted) return;
    painted.style.removeProperty('-webkit-text-fill-color');
    painted.style.removeProperty('caret-color');
    painted = null;
  }
  function place() {
    const r = ta.getBoundingClientRect();
    const cs = getComputedStyle(ta);
    const x = r.left + parseFloat(cs.borderLeftWidth);
    const y = r.top + parseFloat(cs.borderTopWidth);
    const w = ta.clientWidth;
    const h = ta.clientHeight;
    layer.style.left = x + 'px';
    layer.style.top = y + 'px';
    layer.style.width = w + 'px';
    layer.style.height = h + 'px';
    layer.scrollTop = ta.scrollTop;
    layer.scrollLeft = ta.scrollLeft;
    // Cut to what the dialog's scrolling areas (and the window) actually show of the box.
    let top = Math.max(y, 0);
    let left = Math.max(x, 0);
    let bottom = Math.min(y + h, innerHeight);
    let right = Math.min(x + w, innerWidth);
    for (let n = ta.parentElement; n && n !== document.body; n = n.parentElement) {
      const o = getComputedStyle(n);
      if (o.overflowX === 'visible' && o.overflowY === 'visible') continue;
      const a = n.getBoundingClientRect();
      top = Math.max(top, a.top);
      left = Math.max(left, a.left);
      bottom = Math.min(bottom, a.bottom);
      right = Math.min(right, a.right);
    }
    layer.style.clipPath = `inset(${Math.max(0, top - y)}px ${Math.max(0, x + w - right)}px ${Math.max(0, y + h - bottom)}px ${Math.max(0, left - x)}px)`;
    layer.style.visibility = bottom > top && right > left ? '' : 'hidden';
  }
  // While the gray text is up: follow the box (the dialog easing in, scrolling) and drop the
  // suggestion if the box changed under it some other way (Canvas adding the signature).
  function follow() {
    raf = 0;
    if (!layer || (!ghost && !loading)) return;
    if (!ta || !ta.isConnected || document.activeElement !== ta) return hide();
    if (ta.value !== base || ta.selectionStart !== at || ta.selectionEnd !== at) {
      // Changed without typing (Canvas adding the signature, say): ask again for the new text.
      seq++;
      hide();
      if (ta.selectionStart === ta.selectionEnd) {
        asked = '';
        schedule(WAIT_FOCUS);
      }
      return;
    }
    place();
    raf = requestAnimationFrame(follow);
  }
  function hide() {
    ghost = '';
    loading = false;
    if (layer) layer.remove();
    layer = null;
    unpaint();
    cancelAnimationFrame(raf);
    raf = 0;
  }

  // ---------------------------------------------------------------- taking it
  function insert(text) {
    ta.focus();
    // insertText goes through the browser's editing, so React sees an input event and Ctrl+Z works.
    if (!document.execCommand('insertText', false, text)) {
      const p = ta.selectionStart;
      const v = ta.value;
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(ta, v.slice(0, p) + text + v.slice(ta.selectionEnd));
      ta.setSelectionRange(p + text.length, p + text.length);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  function take(all) {
    const part = all ? ghost : (ghost.match(/^\s*\S+/) || [ghost])[0];
    const rest = ghost.slice(part.length);
    // The input event that follows sees exactly the offered text arrive and moves the rest along.
    insert(part);
    if (!rest) asked = ta.value.slice(0, ta.selectionStart) + '\u0000' + ta.value.slice(ta.selectionStart);
  }

  addEventListener(
    'keydown',
    (e) => {
      eatEscUp = false;
      if (!ta || e.target !== ta || e.isComposing) return;
      if (loading && e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        eatEscUp = true;
        seq++;
        return hide();
      }
      if (!ghost) return;
      const plain = !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey;
      if (e.key === 'Tab' && plain) {
        e.preventDefault();
        e.stopImmediatePropagation();
        take(true);
      } else if (e.key === 'ArrowRight' && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        e.stopImmediatePropagation();
        take(false);
      } else if (e.key === 'Escape') {
        // Hides the suggestion only; the dialog stays open.
        e.preventDefault();
        e.stopImmediatePropagation();
        eatEscUp = true;
        hide();
      }
    },
    true,
  );
  // Canvas's dialog closes on Esc's keyup.
  addEventListener(
    'keyup',
    (e) => {
      if (e.key !== 'Escape' || !eatEscUp) return;
      eatEscUp = false;
      e.preventDefault();
      e.stopImmediatePropagation();
    },
    true,
  );

  document.addEventListener(
    'input',
    (e) => {
      if (!ta || e.target !== ta) return;
      if (e.isComposing) {
        seq++;
        clearTimeout(timer);
        return hide();
      }
      const v = ta.value;
      const pos = ta.selectionStart;
      if (ghost && pos > at && pos === ta.selectionEnd) {
        const typed = v.slice(at, pos);
        if (ghost.startsWith(typed) && v === base.slice(0, at) + typed + base.slice(at)) {
          const rest = ghost.slice(typed.length);
          if (rest.trim()) return show(rest, pos, false);
          hide();
          return;
        }
      }
      seq++;
      hide();
      schedule(WAIT_TYPING);
    },
    true,
  );

  document.addEventListener('compositionend', (e) => e.target === ta && schedule(WAIT_TYPING), true);
  document.addEventListener(
    'focusin',
    (e) => {
      const t = e.target;
      if (!(t instanceof HTMLTextAreaElement) || !t.matches(BODY)) return;
      if (ta !== t) asked = '';
      ta = t;
      waits = 5;
      schedule(WAIT_FOCUS);
    },
    true,
  );
  document.addEventListener(
    'focusout',
    (e) => {
      if (e.target !== ta) return;
      clearTimeout(timer);
      seq++;
      eatEscUp = false;
      hide();
    },
    true,
  );
  // The caret moved (a click, arrow keys): the suggestion no longer fits there; ask afresh.
  document.addEventListener('selectionchange', () => {
    if (!ta || document.activeElement !== ta) return;
    if ((ghost || loading) && (ta.selectionStart !== at || ta.selectionEnd !== at) && ta.value === base) {
      seq++;
      hide();
      schedule(WAIT_TYPING);
    }
  });
  addEventListener('gcx:prefs', () => {
    if (!on()) {
      seq++;
      hide();
    }
  });
})();
