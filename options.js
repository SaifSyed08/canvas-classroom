// Settings page: where the OpenAI key is typed (never on the Canvas page itself).
const input = document.getElementById('key');
const status = document.getElementById('status');

// Mirrors background.js: a saved key wins, config.local.json is the fallback.
async function show() {
  const { openaiKey } = await chrome.storage.local.get('openaiKey');
  let fromFile = false;
  try {
    const r = await fetch(chrome.runtime.getURL('config.local.json'));
    fromFile = r.ok && !!(await r.json()).openaiKey;
  } catch {}
  status.textContent = openaiKey
    ? `Using your saved key ending in …${openaiKey.slice(-4)}.`
    : fromFile
      ? 'Using the key in config.local.json. A key saved here replaces it.'
      : 'No key saved yet.';
}

document.getElementById('save').addEventListener('click', async () => {
  const k = input.value.trim();
  if (!/^sk-/.test(k)) {
    status.textContent = "That doesn't look like an OpenAI key (they start with sk-).";
    return;
  }
  await chrome.storage.local.set({ openaiKey: k });
  input.value = '';
  await show();
  status.textContent += ' Go back to Canvas and ask again.';
});
document.getElementById('clear').addEventListener('click', async () => {
  await chrome.storage.local.remove('openaiKey');
  show();
});
show();
