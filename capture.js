/* Prompt Library: Auto‑capture prompts from ChatGPT, Claude & Gemini
   Put this file on any HTTPS hosting you control (e.g. GitHub Pages, S3).
   Update ENDPOINT to your backend URL (Google Apps Script or Node). */

(() => {
  const ENDPOINT = 'https://YOUR_BACKEND_URL_HERE';

  /* =========================================================
     Section 1 — Provider signatures & fetch() interception
  ========================================================= */
  const providers = [
    {
      name: 'ChatGPT',
      test: url => url.includes('/backend-api/conversation'),
      grab: body => {
        const msg = body?.messages?.find(m => m.role === 'user');
        return msg?.content?.parts?.[0] || msg?.content;
      }
    },
    {
      name: 'Claude',
      test: url => url.includes('/api/app/conversation'),
      grab: body => body?.completion?.prompt
    },
    {
      name: 'Gemini',
      test: url => url.includes('/bardchatui') || url.includes('generativelanguage'),
      grab: body => (Array.isArray(body?.[0]) ? body[0][0] : null)
    }
  ];

  const { fetch: origFetch } = window;
  window.fetch = async (...args) => {
    const [resource, cfg] = args;
    const url = typeof resource === 'string' ? resource : resource.url;
    const sig = providers.find(p => p.test(url));
    if (sig && cfg?.method === 'POST' && cfg.body) {
      try {
        const bodyText = typeof cfg.body === 'string' ? cfg.body : await cfg.body.text();
        const body = JSON.parse(bodyText);
        const prompt = sig.grab(body);
        if (prompt) push({ prompt, provider: sig.name });
      } catch (_) {/* ignore JSON parse errors */}
    }
    return origFetch(...args);
  };

  /* =========================================================
     Section 2 — DOM fallbacks (Enter‑key listeners)
  ========================================================= */
  const domHooks = {
    ChatGPT: () => hookTextarea('textarea[data-id="prompt-textarea"]', 'ChatGPT'),
    Claude:  () => hookTextarea('textarea[placeholder*="Claude"]',  'Claude'),
    Gemini: () => hookTextarea('textarea[aria-label*="prompt"]',   'Gemini')
  };
  function hookTextarea(sel, provider) {
    const ta = document.querySelector(sel);
    if (!ta) return;
    ta.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey && ta.value.trim()) {
        push({ prompt: ta.value, provider });
      }
    }, { capture: true });
  }
  window.addEventListener('load', () => Object.values(domHooks).forEach(h => h()));

  /* =========================================================
     Section 3 — Comment UI + beacon sender
  ========================================================= */
  let cachedComment = null;
  function push({ prompt, provider }) {
    if (cachedComment === null) cachedComment = window.prompt('Optional note for Prompt‑Library:') || '';
    const payload = {
      prompt,
      provider,
      url: location.href,
      comments: cachedComment,
      ts: new Date().toISOString()
    };
    navigator.sendBeacon(ENDPOINT, JSON.stringify(payload));
  }
})();
