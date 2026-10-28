// Service worker for the "Ask anything" pill. It holds the OpenAI key and talks to the
// Responses API, so the key never reaches the page. ai.js (content script) runs the tool
// loop: it sends the conversation over a port, gets streamed text or tool calls back,
// runs the tools against Canvas with the page's session, and sends the results here.
// Files are downloaded here because Canvas redirects downloads to other hosts.

const MODEL = 'gpt-6.1-sol';
// Simple lookups ("when is HW 8 due?") go to a small model; ai.js decides per question.
const MODEL_FAST = 'gpt-5.4-mini';
const REASONING = { effort: 'low' };
const MAX_FILE = 25e6;
const MAX_TEXT = 24000;

// A key saved on the settings page wins, so a revoked key in config.local.json can be replaced
// without editing the file. config.local.json is the fallback.
async function getKey() {
  const { openaiKey } = await chrome.storage.local.get('openaiKey');
  if (openaiKey) return openaiKey;
  try {
    const r = await fetch(chrome.runtime.getURL('config.local.json'));
    if (r.ok) return (await r.json()).openaiKey || '';
  } catch {}
  return '';
}

// ---------------------------------------------------------------- files
const decode = (s) =>
  s
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
const clip = (s, n = MAX_TEXT) => (s && s.length > n ? s.slice(0, n) + '\n…(cut off)' : s);

// .docx and .pptx are zip files of XML; pull the text out of them.
async function unzip(buf) {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--)
    if (v.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  if (eocd < 0) throw new Error('not a zip');
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const out = {};
  const td = new TextDecoder();
  for (let n = 0; n < count && v.getUint32(p, true) === 0x02014b50; n++) {
    const method = v.getUint16(p + 10, true);
    const csize = v.getUint32(p + 20, true);
    const usize = v.getUint32(p + 24, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = td.decode(buf.subarray(p + 46, p + 46 + nameLen));
    // Text by default; raw bytes when asked (an image inside the zip).
    out[name] = async (raw, max = Infinity) => {
      if (usize > max) throw new Error(`${name} is too big`);
      const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
      const data = buf.subarray(start, start + csize);
      if (method !== 8) return raw ? data : td.decode(data);
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      // Counted as it comes out: the size the zip claims is only a claim.
      const bytes = await petCapped(new Response(stream), max);
      return raw ? bytes : td.decode(bytes);
    };
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}
async function officeText(buf, ext) {
  const z = await unzip(buf);
  const xmlText = (xml, para) =>
    decode(xml.replace(new RegExp(`</${para}>`, 'g'), '\n').replace(/<w:tab\/>/g, '\t').replace(/<[^>]+>/g, '')).replace(/\n{3,}/g, '\n\n').trim();
  if (ext === 'docx' && z['word/document.xml']) return xmlText(await z['word/document.xml'](), 'w:p');
  if (ext === 'pptx') {
    const slides = Object.keys(z)
      .filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))
      .sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0]);
    const parts = [];
    for (const [i, k] of slides.entries()) parts.push(`--- Slide ${i + 1} ---\n` + xmlText(await z[k](), 'a:p'));
    return parts.join('\n\n');
  }
  return null;
}
// Base64 in 3-byte-aligned chunks, so there's never one giant binary string in memory.
function b64(buf) {
  const parts = [];
  for (let i = 0; i < buf.length; i += 0x7ffe) parts.push(btoa(String.fromCharCode.apply(null, buf.subarray(i, i + 0x7ffe))));
  return parts.join('');
}
const TEXTY = /^(txt|md|csv|tsv|json|html?|xml|py|java|js|ts|c|cpp|h|r|rmd|m|tex|sql|ipynb|css|sh)$/;
const IMAGE = /^(png|jpe?g|gif|webp)$/;

// Downloads a Canvas file (its verifier URL needs no cookies) and turns it into either
// text for the tool output or a file/image part for a follow-up message.
async function readFile(att) {
  const ext = (String(att.name).match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase() || '';
  if (att.size && att.size > MAX_FILE) return { text: `${att.name} is ${Math.round(att.size / 1e6)} MB, too big to read here.` };
  // Only Canvas and its file storage, never a URL the model was talked into.
  let host = '';
  try {
    const u = new URL(att.url);
    host = u.protocol === 'https:' ? u.hostname : '';
  } catch {}
  if (!/(^|\.)(instructure\.com|inscloudgate\.net|amazonaws\.com)$/.test(host)) return { text: `Can't download ${att.name} from that address.` };
  // Skip types it can't read before downloading anything (a lecture video, say).
  const readable = (e, m) => e === 'pdf' || e === 'docx' || e === 'pptx' || IMAGE.test(e) || TEXTY.test(e) || /pdf|^image\/|^text\//.test(m);
  if (!readable(ext, att.mime || '')) return { text: `${att.name} is a .${ext || '?'} file, which can't be read here. Link it instead.` };
  const r = await fetch(att.url, { credentials: 'include' });
  if (!r.ok) return { text: `Couldn't download ${att.name} (HTTP ${r.status}).` };
  const len = Number(r.headers.get('content-length')) || 0;
  if (len > MAX_FILE) {
    r.body?.cancel();
    return { text: `${att.name} is ${Math.round(len / 1e6)} MB, too big to read here.` };
  }
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf.length > MAX_FILE) return { text: `${att.name} is ${Math.round(buf.length / 1e6)} MB, too big to read here.` };
  const mime = att.mime || r.headers.get('content-type') || '';
  if (ext === 'pdf' || /pdf/.test(mime))
    return {
      text: `${att.name} is attached below as a PDF.`,
      part: { type: 'input_file', filename: att.name.replace(/[^\w.\- ]+/g, '_'), file_data: `data:application/pdf;base64,${b64(buf)}` },
    };
  if (ext === 'docx' || ext === 'pptx') {
    const t = await officeText(buf, ext).catch(() => null);
    return { text: t ? clip(`${att.name} (converted to text):\n\n${t}`) : `Couldn't read ${att.name}.` };
  }
  if (IMAGE.test(ext) || /^image\//.test(mime))
    return { text: `${att.name} is attached below as an image.`, part: { type: 'input_image', image_url: `data:${mime || 'image/png'};base64,${b64(buf)}` } };
  if (TEXTY.test(ext) || /^text\//.test(mime)) {
    let t = new TextDecoder().decode(buf);
    if (/^html?$/.test(ext)) t = decode(t.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' ')).replace(/\s{3,}/g, '\n\n');
    return { text: clip(`${att.name}:\n\n${t}`) };
  }
  return { text: `${att.name} is a .${ext || '?'} file, which can't be read here. Link it instead.` };
}

// ---------------------------------------------------------------- Responses API stream
async function stream(port, body, signal, tier) {
  const key = await getKey();
  if (!key) return port.postMessage({ type: 'error', code: 'nokey', message: 'No OpenAI key set.' });
  const r = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: tier === 'fast' ? MODEL_FAST : MODEL, reasoning: REASONING, stream: true, ...body }),
    signal,
  });
  if (!r.ok) {
    let msg = `OpenAI error ${r.status}`;
    try {
      msg = (await r.json()).error.message || msg;
    } catch {}
    const code = r.status === 401 ? 'badkey' : /previous response/i.test(msg) ? 'noprev' : 'http';
    return port.postMessage({ type: 'error', code, message: msg });
  }
  const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = '';
  let id = null;
  const calls = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let cut;
    while ((cut = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, cut);
      buf = buf.slice(cut + 2);
      const data = chunk
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trim())
        .join('');
      if (!data || data === '[DONE]') continue;
      let ev;
      try {
        ev = JSON.parse(data);
      } catch {
        continue;
      }
      if (ev.type === 'response.created') id = ev.response.id;
      else if (ev.type === 'response.output_text.delta') port.postMessage({ type: 'delta', text: ev.delta });
      else if (ev.type === 'response.output_item.added' && ev.item.type === 'function_call') port.postMessage({ type: 'tool_start', name: ev.item.name });
      else if (ev.type === 'response.output_item.done' && ev.item.type === 'function_call')
        calls.push({ call_id: ev.item.call_id, name: ev.item.name, arguments: ev.item.arguments });
      else if (ev.type === 'response.failed' || ev.type === 'error')
        return port.postMessage({ type: 'error', code: 'failed', message: (ev.response && ev.response.error && ev.response.error.message) || ev.message || 'The model failed.' });
    }
  }
  const model = tier === 'fast' ? MODEL_FAST : MODEL;
  port.postMessage(calls.length ? { type: 'tool_calls', response_id: id, calls, model } : { type: 'done', response_id: id, model });
}

// The pill's "Add key" button: the key is entered on options.html, not on the Canvas page.
// A class cover picture from a prompt (the cover picker's Generate button). Wide, no lettering;
// the page crops and compresses it.
// Newest first; an older one only if the key can't use it. (gpt-image-1 is listed but no longer served.)
const IMAGE_MODELS = ['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1-mini'];
async function genCover(prompt, course) {
  const key = await getKey();
  if (!key) throw new Error('No OpenAI key is set');
  const full = `Wide banner illustration for a college class${course ? ` called "${course}"` : ''}: ${prompt}. Rich, tasteful, no text, no letters, no logos, works behind white title text.`;
  let last;
  for (const model of IMAGE_MODELS) {
    const body = { model, prompt: full, size: '1536x1024', quality: 'low', output_format: 'jpeg', output_compression: 80 };
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.data && j.data[0] && j.data[0].b64_json) return `data:image/jpeg;base64,${j.data[0].b64_json}`;
    last = new Error((j.error && j.error.message) || `HTTP ${r.status}`);
    // Only a model this key can't use is worth trying the next one for.
    if (!(r.status === 404 || r.status === 403 || (j.error && /model/i.test(j.error.message || '')))) break;
  }
  throw last;
}
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || msg.type !== 'genCover' || !sender.tab) return;
  genCover(String(msg.prompt || '').slice(0, 300), String(msg.course || '').slice(0, 120)).then(
    (data) => reply({ data }),
    (e) => reply({ error: e.message }),
  );
  return true;
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'openOptions') chrome.runtime.openOptionsPage();
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'gcx-ask') return;
  const ctrl = new AbortController();
  port.onDisconnect.addListener(() => ctrl.abort());
  port.onMessage.addListener(async (msg) => {
    try {
      if (msg.type === 'start') {
        const body = { instructions: msg.instructions, tools: msg.tools, input: msg.input };
        if (msg.previous_response_id) body.previous_response_id = msg.previous_response_id;
        await stream(port, body, ctrl.signal, msg.tier);
      } else if (msg.type === 'continue') {
        const input = [];
        const parts = [];
        for (const o of msg.outputs) {
          let output = o.output;
          if (o.attach) {
            const f = await readFile(o.attach).catch((e) => ({ text: `Couldn't read ${o.attach.name}: ${e.message}` }));
            output = JSON.stringify({ ...JSON.parse(output || '{}'), content: f.text });
            if (f.part) parts.push(f.part);
          }
          input.push({ type: 'function_call_output', call_id: o.call_id, output });
        }
        if (parts.length) input.push({ role: 'user', content: [{ type: 'input_text', text: '(Attached file contents for the tool call above.)' }, ...parts] });
        await stream(port, { instructions: msg.instructions, tools: msg.tools, input, previous_response_id: msg.previous_response_id }, ctrl.signal, msg.tier);
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        try {
          port.postMessage({ type: 'error', code: 'net', message: e.message });
        } catch {}
      }
    }
  });
});

// ---------------------------------------------------------------- Inbox suggestions (suggest.js)
// Gray autocomplete in Canvas's Inbox: how the message goes on from the cursor, or the whole reply
// when the box is empty. The model starts its answer by copying the last few words before the
// cursor (the "lead"), which tells this file exactly where its words join his: mid-word, after a
// space, or as a new word that needs one.
const SUGGEST_INSTRUCTIONS = `You write inline autocomplete for a message a university student is writing in Canvas's Inbox, like Gmail's Smart Compose.
When a "lead" is given, your reply must begin with it copied exactly (it is the end of the draft, possibly cut off mid-word), followed directly by your continuation. Output nothing else.
- Continue naturally: finish the word or sentence, and at most a sentence or two more. Stop where the message would end.
- With an empty draft, write the whole reply: short (one to three sentences), in the tone of the thread, starting with a greeting if the thread's messages use them. No sign-off if the draft already has a signature after the cursor.
- Don't make up specifics the writer hasn't given (times, reasons, promises) beyond what the thread says.
- Never repeat what the draft already says after the cursor.
- Plain text, no markdown, no quotes, no em dashes.`;
const suggestJobs = new Map();
async function suggest(m, signal) {
  const key = await getKey();
  if (!key) return { code: 'nokey' };
  const cut = (s, n) => String(s || '').slice(0, n);
  const before = cut(m.before, 4000);
  // The last few words, the last one possibly half-typed (and any spaces after it).
  const lead = before.trim() ? (before.match(/(?:\S+\s+){0,3}\S*\s*$/) || [''])[0] : '';
  const input = [
    m.me ? `Writer: ${cut(m.me, 80)}` : '',
    m.header ? `The message (course, people, subject):\n${cut(m.header, 1200)}` : '',
    m.thread ? `Earlier messages in the conversation, newest first:\n${cut(m.thread, 8000)}` : 'This is a new message, not a reply.',
    `Draft before the cursor:\n<<<${before}>>>`,
    `Draft after the cursor:\n<<<${cut(m.after, 1500)}>>>`,
    lead ? `Lead (begin with exactly this): <<<${lead}>>>` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
  const r = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL_FAST, reasoning: { effort: 'none' }, instructions: SUGGEST_INSTRUCTIONS, input, max_output_tokens: 300, store: false }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { code: r.status === 401 ? 'badkey' : 'http', error: (j.error && j.error.message) || `HTTP ${r.status}` };
  let out = (j.output || [])
    .filter((o) => o.type === 'message')
    .flatMap((o) => o.content || [])
    .filter((c) => c.type === 'output_text')
    .map((c) => c.text)
    .join('')
    .replace(/^<<<|>>>$/g, '');
  if (lead) {
    if (out.startsWith(lead)) out = out.slice(lead.length);
    else if (out.startsWith(lead.trimEnd())) {
      out = out.slice(lead.trimEnd().length);
      if (/\s$/.test(lead)) out = out.replace(/^\s+/, '');
    }
    // It didn't copy the lead, so where its words join his is a guess: offer nothing.
    else return { text: '' };
  }
  return { text: out };
}
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || msg.type !== 'gcxSuggest' || !sender.tab) return;
  // One at a time per tab: a newer draft makes the older request pointless.
  suggestJobs.get(sender.tab.id)?.abort();
  const ctrl = new AbortController();
  suggestJobs.set(sender.tab.id, ctrl);
  suggest(msg, ctrl.signal)
    .then(reply, (e) => reply({ code: e.name === 'AbortError' ? 'aborted' : e.name === 'TimeoutError' ? 'timeout' : 'net', error: e.message }))
    .finally(() => suggestJobs.get(sender.tab.id) === ctrl && suggestJobs.delete(sender.tab.id));
  return true;
});

// ---------------------------------------------------------------- pets (pets.js)
// The pet library is codex-pets.net (Codex's pet format; its API sends no CORS headers), so
// pets.js asks here. Only two kinds of URL are fetched: a page of the library's listing, built
// here from a page number and search text, and a pet's spritesheet on the library's own asset
// path (openpets.dev's too, for a pet picked before the switch). Sheets are stored in
// chrome.storage.local as data URLs (the extension has unlimitedStorage) so a page never
// downloads the same pet twice; the newest few are kept, plus every pet he imported himself.
const PET_API = 'https://codex-pets.net/api/pets';
const PET_PAGE_SIZE = 48;
const PET_JSON = /^https:\/\/codex-pets\.net\/api\/pets\?sort=views&pageSize=48&page=\d+(?:&q=[^&#]*)?$/;
const PET_ASSET = /^https:\/\/codex-pets\.net\/assets\/pets\/v\/\d+\/[A-Za-z0-9._-]+\/(?:spritesheet|poster)\.(?:webp|png)$/;
const PET_SHEET = /^https:\/\/(?:openpets\.dev\/pets\/[A-Za-z0-9._-]+|codex-pets\.net\/assets\/pets\/v\/\d+\/[A-Za-z0-9._-]+)\/spritesheet\.(?:webp|png)$/;
const PET_ID = /^[A-Za-z0-9._-]{1,80}$/;
const PET_HOME = `${PET_API}?sort=views&pageSize=${PET_PAGE_SIZE}&page=1`;
// Library pages saved before only the landing page was kept, and the old openpets.dev catalogue.
chrome.runtime.onInstalled.addListener(async () => {
  const keys = chrome.storage.local.getKeys ? await chrome.storage.local.getKeys() : Object.keys(await chrome.storage.local.get(null));
  const old = keys.filter((k) => k.startsWith('gcxPetJson:') && k !== 'gcxPetJson:' + PET_HOME);
  if (old.length) chrome.storage.local.remove(old);
});
const PET_JSON_TTL = 6 * 36e5;
const PET_SHEETS_KEPT = 4;
const petJsonMem = new Map();
async function petCapped(r, limit) {
  const reader = r.body.getReader();
  const parts = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.byteLength;
    if (n > limit) {
      reader.cancel().catch(() => {});
      throw new Error('too large');
    }
    parts.push(value);
  }
  const out = new Uint8Array(n);
  let at = 0;
  for (const p of parts) out.set(p, at), (at += p.byteLength);
  return out;
}
async function petJson(url) {
  if (!PET_JSON.test(url)) throw new Error('not a library URL');
  const mem = petJsonMem.get(url);
  if (mem && Date.now() - mem.t < PET_JSON_TTL) return mem.data;
  const key = 'gcxPetJson:' + url;
  const saved = (await chrome.storage.local.get(key))[key];
  if (saved && Date.now() - saved.t < PET_JSON_TTL) return petJsonMem.set(url, saved), saved.data;
  try {
    const r = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(`codex-pets.net answered ${r.status}`);
    const data = JSON.parse(new TextDecoder().decode(await petCapped(r, 4e6)));
    const rec = { t: Date.now(), data };
    petJsonMem.delete(url);
    petJsonMem.set(url, rec);
    if (petJsonMem.size > 40) petJsonMem.delete(petJsonMem.keys().next().value);
    if (url === PET_HOME) chrome.storage.local.set({ [key]: rec });
    return data;
  } catch (e) {
    // Offline: an old copy beats an empty picker.
    if (saved) return saved.data;
    throw e;
  }
}
async function petSheet(id, url) {
  if (!PET_SHEET.test(url) || !PET_ID.test(id) || /^mine-/.test(id)) throw new Error('not a spritesheet URL');
  const key = 'gcxPetSheet:' + id;
  const have = (await chrome.storage.local.get(key))[key];
  if (have && have.url === url) {
    chrome.storage.local.set({ [key]: { ...have, used: Date.now() } });
    return key;
  }
  const r = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`${new URL(url).hostname} answered ${r.status}`);
  const type = (r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!/^image\/(webp|png)$/.test(type)) throw new Error('that pet is not an image');
  const bytes = await petCapped(r, 12e6);
  const dim = imageSize(bytes);
  if (!dim || dim[0] > 4096 || dim[1] > 6144) throw new Error('that pet is too big');
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  await chrome.storage.local.set({ [key]: { url, dataUrl: `data:${type};base64,${btoa(bin)}`, used: Date.now() } });
  // Keep the newest few sheets; older ones are fetched again if he goes back to them. His own
  // imports can't be fetched again, so they stay until he removes them.
  const all = await chrome.storage.local.get(null);
  const sheets = Object.keys(all)
    .filter((k) => k.startsWith('gcxPetSheet:') && k !== key && !all[k].mine)
    .sort((a, b) => (all[b].used || 0) - (all[a].used || 0));
  if (sheets.length >= PET_SHEETS_KEPT) await chrome.storage.local.remove(sheets.slice(PET_SHEETS_KEPT - 1));
  return key;
}
// ----- a sheet shrunk to the size the pet is shown at, done here so the page never stutters.
// The browser's own shrink (mipmaps) blurs; this one averages the exact area each screen pixel
// covers (alpha-weighted, so edges don't pick up dark fringes), then sharpens lightly.
function shrinkSharp(src, sw, sh, dw, dh, amount) {
  const weights = (sn, dn) => {
    const r = sn / dn;
    const out = [];
    for (let d = 0; d < dn; d++) {
      const a = d * r;
      const b = a + r;
      const list = [];
      for (let i = Math.floor(a); i < Math.min(sn, Math.ceil(b)); i++) {
        const w = Math.min(i + 1, b) - Math.max(i, a);
        if (w > 1e-6) list.push(i, w / r);
      }
      out.push(list);
    }
    return out;
  };
  const wx = weights(sw, dw);
  const wy = weights(sh, dh);
  // pass 1: rows, premultiplying
  const tmp = new Float32Array(dw * sh * 4);
  for (let y = 0; y < sh; y++) {
    const row = y * sw * 4;
    const trow = y * dw * 4;
    for (let x = 0; x < dw; x++) {
      const list = wx[x];
      let r = 0, g = 0, b = 0, al = 0;
      for (let k = 0; k < list.length; k += 2) {
        const p = row + list[k] * 4;
        const w = list[k + 1];
        const aw = src[p + 3] * w;
        r += src[p] * aw;
        g += src[p + 1] * aw;
        b += src[p + 2] * aw;
        al += aw;
      }
      const o = trow + x * 4;
      tmp[o] = r / 255;
      tmp[o + 1] = g / 255;
      tmp[o + 2] = b / 255;
      tmp[o + 3] = al;
    }
  }
  // pass 2: columns
  const pm = new Float32Array(dw * dh * 4);
  for (let y = 0; y < dh; y++) {
    const list = wy[y];
    const o0 = y * dw * 4;
    for (let k = 0; k < list.length; k += 2) {
      const t0 = list[k] * dw * 4;
      const w = list[k + 1];
      for (let i = 0; i < dw * 4; i++) pm[o0 + i] += tmp[t0 + i] * w;
    }
  }
  // unsharp mask (3x3 binomial blur), on premultiplied values; then back to straight alpha
  const out = new Uint8ClampedArray(dw * dh * 4);
  const at = (x, y, c) => pm[((y < 0 ? 0 : y >= dh ? dh - 1 : y) * dw + (x < 0 ? 0 : x >= dw ? dw - 1 : x)) * 4 + c];
  for (let y = 0; y < dh; y++)
    for (let x = 0; x < dw; x++) {
      const o = (y * dw + x) * 4;
      const v = [0, 0, 0, 0];
      for (let c = 0; c < 4; c++) {
        const blur =
          (at(x - 1, y - 1, c) + 2 * at(x, y - 1, c) + at(x + 1, y - 1, c) + 2 * at(x - 1, y, c) + 4 * pm[o + c] + 2 * at(x + 1, y, c) + at(x - 1, y + 1, c) + 2 * at(x, y + 1, c) + at(x + 1, y + 1, c)) / 16;
        v[c] = pm[o + c] + amount * (pm[o + c] - blur);
      }
      const a = Math.min(255, Math.max(0, v[3]));
      out[o + 3] = a;
      if (a > 0) {
        out[o] = (v[0] * 255) / a;
        out[o + 1] = (v[1] * 255) / a;
        out[o + 2] = (v[2] * 255) / a;
      }
    }
  return out;
}
const scaledMem = new Map();
async function petScaled(id, w, h) {
  if (!PET_ID.test(id)) throw new Error('bad id');
  w = Math.trunc(w);
  h = Math.trunc(h);
  if (!(w > 0 && h > 0 && w <= 4096 && h <= 8192)) throw new Error('bad size');
  const key = 'gcxPetSheet:' + id;
  const rec = (await chrome.storage.local.get(key))[key];
  if (!rec || !rec.dataUrl) throw new Error('sheet missing');
  const memKey = `${id}|${w}x${h}|${rec.dataUrl.length}`;
  if (scaledMem.has(memKey)) return scaledMem.get(memKey);
  const bytes = fromDataUrl(rec.dataUrl);
  const bmp = await createImageBitmap(new Blob([bytes], { type: imageType(bytes) || 'image/png' }));
  const sw = bmp.width;
  const sh = bmp.height;
  // Only for shrinking; growing is left to the page.
  if (w > sw || h > sh) {
    bmp.close();
    return '';
  }
  const c = new OffscreenCanvas(sw, sh);
  const x = c.getContext('2d');
  x.drawImage(bmp, 0, 0);
  bmp.close();
  const px = shrinkSharp(x.getImageData(0, 0, sw, sh).data, sw, sh, w, h, 0.6);
  const d = new OffscreenCanvas(w, h);
  d.getContext('2d').putImageData(new ImageData(px, w, h), 0, 0);
  const url = `data:image/png;base64,${b64(new Uint8Array(await (await d.convertToBlob({ type: 'image/png' })).arrayBuffer()))}`;
  scaledMem.set(memKey, url);
  if (scaledMem.size > 3) scaledMem.delete(scaledMem.keys().next().value);
  return url;
}

// One page of the library, most viewed first, or what matches a search.
async function petList(page, q) {
  page = Math.max(1, Math.min(1000, Math.trunc(page) || 1));
  q = String(q || '').trim().slice(0, 80);
  const d = await petJson(`${PET_API}?sort=views&pageSize=${PET_PAGE_SIZE}&page=${page}${q ? `&q=${encodeURIComponent(q)}` : ''}`);
  const pets = (Array.isArray(d && d.pets) ? d.pets : [])
    .filter((p) => p && !p.ownerShadowbanned && PET_ID.test(String(p.id)) && !/^mine-/.test(p.id) && PET_ASSET.test(String(p.spritesheetUrl)) && PET_ASSET.test(String(p.posterUrl)))
    .map((p) => ({
      id: p.id,
      displayName: String(p.displayName || p.id).slice(0, 120),
      description: String(p.description || '').slice(0, 400),
      spriteVersionNumber: p.spriteVersionNumber === 2 ? 2 : 1,
      spritesheet: p.spritesheetUrl,
      thumbnail: p.posterUrl,
    }));
  return { pets, page, total: Number(d.total) || pets.length, totalPages: Number(d.totalPages) || 1 };
}

// ----- his own pets: imported in the settings (a codex-pets.net / Codex .zip, a pet folder's
// pet.json + spritesheet, or a bare spritesheet), plus any in the extension's pets.local folder
// (git-ignored; pets.local/index.json lists the folder names). Each is checked to be a real
// Codex sheet, stored for good, and listed in 'gcxPetsMine' with a small picture of it standing.
const MINE_KEY = 'gcxPetsMine';
const PET_MAX_BYTES = 12e6;
const fromDataUrl = (u) => {
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(String(u || ''));
  if (!m || !m[2]) throw new Error('unreadable file');
  const bin = atob(m[3]);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
const imageType = (b) =>
  b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
    ? 'image/png'
    : b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
      ? 'image/webp'
      : '';
// Width and height from a PNG or WebP header, so a huge image is refused before it's decoded.
function imageSize(b) {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b.length < 30) return null;
  if (b[0] === 0x89) return [v.getUint32(16), v.getUint32(20)];
  const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
  if (chunk === 'VP8X') return [1 + (b[24] | (b[25] << 8) | (b[26] << 16)), 1 + (b[27] | (b[28] << 8) | (b[29] << 16))];
  if (chunk === 'VP8L') {
    const n = v.getUint32(21, true);
    return [1 + (n & 0x3fff), 1 + ((n >> 14) & 0x3fff)];
  }
  if (chunk === 'VP8 ') return [v.getUint16(26, true) & 0x3fff, v.getUint16(28, true) & 0x3fff];
  return null;
}
// Adopting and forgetting read, change and write the same list: one at a time.
let mineQueue = Promise.resolve();
const mineLocked = (job) => {
  const run = mineQueue.then(job, job);
  mineQueue = run.catch(() => {});
  return run;
};
// files: [{ name, bytes }]. Returns the stored pet's entry. `fallbackId` names a pet whose files
// don't (a pets.local folder without an id in its pet.json).
async function petAdopt(files, source, fallbackId) {
  let manifest = null;
  let image = null;
  for (const f of files) {
    if (f.bytes.length > PET_MAX_BYTES) throw new Error(`${f.name} is too big for a pet`);
    if (f.bytes[0] === 0x50 && f.bytes[1] === 0x4b) {
      const z = await unzip(f.bytes);
      const names = Object.keys(z).filter((n) => !/(^|\/)(__MACOSX|\.)/.test(n));
      const jsonName = names.find((n) => /(^|\/)pet\.json$/i.test(n));
      if (jsonName && !manifest) manifest = JSON.parse(await z[jsonName](false, 1e6));
      const dir = jsonName ? jsonName.replace(/[^/]*$/, '') : '';
      const want = manifest && manifest.spritesheetPath ? dir + String(manifest.spritesheetPath).replace(/^\.\//, '') : '';
      const imgName = (want && z[want] && want) || names.find((n) => /spritesheet\.(webp|png)$/i.test(n)) || names.find((n) => /\.(webp|png)$/i.test(n));
      if (imgName && !image) image = { name: imgName, bytes: await z[imgName](true, PET_MAX_BYTES) };
    } else if (/\.json$/i.test(f.name)) manifest = manifest || JSON.parse(new TextDecoder().decode(f.bytes));
    else if (imageType(f.bytes)) image = image || f;
  }
  if (!image) throw new Error('no spritesheet in what was picked (a .webp or .png, or a .zip holding one)');
  const type = imageType(image.bytes);
  if (!type) throw new Error('the spritesheet must be a .webp or .png');
  if (image.bytes.length > PET_MAX_BYTES) throw new Error('that spritesheet is too big for a pet');
  const dim = imageSize(image.bytes);
  if (!dim || dim[0] > 4096 || dim[1] > 6144) throw new Error(dim ? `a ${dim[0]}x${dim[1]} image is too big for a pet` : "that image couldn't be read");
  const bmp = await createImageBitmap(new Blob([image.bytes], { type }));
  // A Codex sheet: 8 columns of 192x208-shaped cells, 9 rows (v1) or 11 (v2).
  const cellW = bmp.width / 8;
  const rows = bmp.height / (cellW * (208 / 192));
  const ver = Math.abs(rows - 11) < 0.05 ? 2 : Math.abs(rows - 9) < 0.05 ? 1 : 0;
  if (!ver) {
    const size = `${bmp.width}x${bmp.height}`;
    bmp.close();
    throw new Error(`a ${size} image isn't a pet spritesheet (8 columns by 9 or 11 rows of 192x208 cells)`);
  }
  const cellH = bmp.height / (ver === 2 ? 11 : 9);
  const c = new OffscreenCanvas(96, 104);
  c.getContext('2d').drawImage(bmp, 0, 0, cellW, cellH, 0, 0, 96, 104);
  bmp.close();
  const thumb = new Uint8Array(await (await c.convertToBlob({ type: 'image/webp', quality: 0.9 })).arrayBuffer());
  const m = manifest && typeof manifest === 'object' ? manifest : {};
  const stem = String(m.id || fallbackId || image.name.replace(/^.*[\\/]/, '').replace(/\.[^.]*$/, '').replace(/^spritesheet$/i, '') || 'pet');
  const slug = stem.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 56) || 'pet';
  return mineLocked(async () => {
  const have = (await chrome.storage.local.get(MINE_KEY))[MINE_KEY] || [];
  let id = 'mine-' + slug;
  // Same id from a pet.json (or folder) is the same pet, updated. Otherwise it's a new one.
  if (!m.id && !fallbackId) for (let i = 2; have.some((e) => e.id === id); i++) id = `mine-${slug}-${i}`;
  const entry = {
    id,
    displayName: String(m.displayName || m.name || stem).slice(0, 120),
    description: String(m.description || '').slice(0, 400),
    spriteVersionNumber: ver,
    thumbnail: `data:image/webp;base64,${b64(thumb)}`,
    source,
    dir: source === 'local' ? fallbackId : undefined,
  };
  const list = have.filter((e) => e.id !== id);
  await chrome.storage.local.set({
    ['gcxPetSheet:' + id]: { url: 'mine', dataUrl: `data:${type};base64,${b64(image.bytes)}`, used: Date.now(), mine: true },
    [MINE_KEY]: [entry, ...list],
  });
  return entry;
  });
}
// Picks up pets.local/ once per change to its index.
async function petsLocal() {
  let index;
  try {
    const r = await fetch(chrome.runtime.getURL('pets.local/index.json'));
    if (!r.ok) return;
    index = await r.text();
  } catch {
    return;
  }
  // { index, done: folders taken in, gone: folders he removed }; a new index starts over.
  let seen = (await chrome.storage.local.get('gcxPetsLocalSeen')).gcxPetsLocalSeen;
  if (!seen || typeof seen !== 'object' || seen.index !== index) seen = { index, done: typeof seen === 'string' && seen === index ? null : [], gone: [] };
  let dirs = [];
  try {
    dirs = JSON.parse(index);
  } catch {}
  dirs = (Array.isArray(dirs) ? dirs : []).map(String).filter((d) => PET_ID.test(d));
  if (seen.done === null) seen.done = dirs; // the old format: everything already taken in
  const todo = dirs.filter((d) => !seen.done.includes(d) && !seen.gone.includes(d) && Date.now() - (localFailedAt.get(d) || 0) > 10 * 6e4);
  if (!todo.length) return;
  const get = (p) => fetch(chrome.runtime.getURL(p)).catch(() => null);
  for (const dir of todo) {
    try {
      const files = [];
      const j = await get(`pets.local/${dir}/pet.json`);
      const manifest = j && j.ok ? await j.json() : {};
      if (j && j.ok) files.push({ name: 'pet.json', bytes: new TextEncoder().encode(JSON.stringify(manifest)) });
      const sheetName = String(manifest.spritesheetPath || 'spritesheet.webp').replace(/^\.\//, '');
      if (!/^[A-Za-z0-9._-]+\.(webp|png)$/.test(sheetName)) throw new Error('bad spritesheetPath');
      const s = await get(`pets.local/${dir}/${sheetName}`);
      if (!s || !s.ok) throw new Error(`no ${sheetName}`);
      files.push({ name: sheetName, bytes: new Uint8Array(await s.arrayBuffer()) });
      await petAdopt(files, 'local', dir);
      seen.done.push(dir);
    } catch (e) {
      localFailedAt.set(dir, Date.now());
      console.warn('[gcx pets] pets.local/' + dir, e.message);
    }
  }
  await chrome.storage.local.set({ gcxPetsLocalSeen: seen });
}
const localFailedAt = new Map();
// Only one look at pets.local at a time (the picker asks on every search).
let localRun = null;
const petsLocalOnce = () => localRun || (localRun = petsLocal().finally(() => (localRun = null)));
async function petsMine() {
  await petsLocalOnce();
  return (await chrome.storage.local.get(MINE_KEY))[MINE_KEY] || [];
}
async function petForget(id) {
  if (!/^mine-/.test(id)) throw new Error('not one of yours');
  return mineLocked(async () => {
    const all = (await chrome.storage.local.get(MINE_KEY))[MINE_KEY] || [];
    const was = all.find((e) => e.id === id);
    // One that came from pets.local stays removed (until pets.local/index.json changes).
    if (was && was.source === 'local' && was.dir) {
      const seen = (await chrome.storage.local.get('gcxPetsLocalSeen')).gcxPetsLocalSeen;
      if (seen && typeof seen === 'object') await chrome.storage.local.set({ gcxPetsLocalSeen: { ...seen, gone: [...new Set([...(seen.gone || []), was.dir])] } });
    }
    const list = all.filter((e) => e.id !== id);
    await chrome.storage.local.set({ [MINE_KEY]: list });
    await chrome.storage.local.remove('gcxPetSheet:' + id);
    return list;
  });
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || msg.type !== 'gcxPets' || !sender.tab) return;
  const files = () => (Array.isArray(msg.files) ? msg.files.slice(0, 4) : []).map((f) => ({ name: String(f.name || '').slice(0, 200), bytes: fromDataUrl(f.dataUrl) }));
  const job =
    msg.op === 'list'
      ? petList(msg.page, msg.q)
      : msg.op === 'sheet'
        ? petSheet(String(msg.id || ''), String(msg.url || '')).then((key) => ({ key }))
        : msg.op === 'scaled'
          ? petScaled(String(msg.id || ''), Number(msg.w), Number(msg.h)).then((data) => ({ data }))
        : msg.op === 'mine'
          ? petsMine().then((pets) => ({ pets }))
          : msg.op === 'import'
            ? Promise.resolve().then(() => petAdopt(files(), 'import')).then((pet) => ({ pet }))
            : msg.op === 'forget'
              ? petForget(String(msg.id || '')).then((pets) => ({ pets }))
              : null;
  if (!job) return;
  job.then(reply, (e) => reply({ error: e.message || String(e) }));
  return true;
});
