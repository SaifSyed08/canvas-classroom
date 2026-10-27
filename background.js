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
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = td.decode(buf.subarray(p + 46, p + 46 + nameLen));
    out[name] = async () => {
      const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
      const data = buf.subarray(start, start + csize);
      if (method !== 8) return td.decode(data);
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Response(stream).text();
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
