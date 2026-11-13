/* =========================================================
   What Your Browser Tells Websites — script.js

   How this file is organised:
     1. collectFacts(): reads raw values from browser APIs
        into one plain object. Missing APIs give null.
     2. SIGNALS: how each raw signal is shown in the list,
        with an explanation and identifiability level.
     3. Rendering: prints everything into the terminal window.

   The inference itself lives in infer.js; lookup tables in
   data.js. Nothing here makes a network request.
   ========================================================= */

'use strict';

const NOT_AVAILABLE = 'not available in your browser';

/* ---------------------------------------------------------
   1. Raw facts
   --------------------------------------------------------- */

function safe(fn, fallback = null) {
  try {
    const v = fn();
    return v === undefined || v === '' ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

function detectOS() {
  const uaData = navigator.userAgentData;
  const ua = navigator.userAgent || '';
  const touch = navigator.maxTouchPoints || 0;
  if (uaData && uaData.platform) {
    const p = uaData.platform;
    if (/mac/i.test(p)) return 'macOS';
    if (/win/i.test(p)) return 'Windows';
    if (/android/i.test(p)) return 'Android';
    if (/chrome ?os/i.test(p)) return 'ChromeOS';
    if (/linux/i.test(p)) return 'Linux';
  }
  if (/iPhone|iPod/.test(ua)) return 'iOS';
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && touch > 1)) return 'iPadOS';
  if (/Macintosh|Mac OS X/.test(ua)) return 'macOS';
  if (/Android/.test(ua)) return 'Android';
  if (/Windows/.test(ua)) return 'Windows';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Linux/.test(ua)) return 'Linux';
  return null;
}

// Returns { name, version }. Client Hints first, user-agent string second.
function detectBrowser() {
  const uaData = navigator.userAgentData;
  if (uaData && uaData.brands && uaData.brands.length) {
    const real = uaData.brands.filter((b) => !/not.?a.?brand/i.test(b.brand));
    const best = real.find((b) => b.brand !== 'Chromium') || real[0];
    if (best) {
      const name = best.brand.replace(/^(Google|Microsoft) /, '');
      return { name, version: best.version };
    }
  }
  // Order matters: Edge's UA also contains "Chrome" and "Safari".
  const ua = navigator.userAgent || '';
  const patterns = [
    ['Edge', /Edg\/(\d+)/],
    ['Opera', /OPR\/(\d+)/],
    ['Samsung Internet', /SamsungBrowser\/(\d+)/],
    ['Firefox', /(?:Firefox|FxiOS)\/(\d+)/],
    ['Chrome', /(?:Chrome|CriOS)\/(\d+)/],
    ['Safari', /Version\/(\d+(?:\.\d+)?).*Safari/],
  ];
  for (const [name, regex] of patterns) {
    const match = ua.match(regex);
    if (match) return { name, version: match[1] };
  }
  return { name: null, version: null };
}

// Canvas fingerprint: draw text and shapes, then hash the pixels.
// GPU, driver, font and anti-aliasing differences change the hash.
function canvasHash() {
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 60;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#f60';
  ctx.fillRect(100, 5, 80, 30);
  ctx.fillStyle = '#069';
  ctx.font = '16px Arial';
  ctx.fillText('Browser tells all 🔍', 4, 10);
  ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
  ctx.font = 'italic 18px Georgia';
  ctx.fillText('fingerprint', 60, 30);
  ctx.beginPath();
  ctx.arc(210, 40, 15, 0, Math.PI * 2);
  ctx.stroke();
  const data = canvas.toDataURL();
  if (!data || data === 'data:,') return null; // blocked by a privacy mode
  return hashString(data);
}

// Graphics card name. The debug extension reveals the real
// ("unmasked") name where the browser allows it.
function webglRenderer() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) return null;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  const lose = gl.getExtension('WEBGL_lose_context');
  if (lose) lose.loseContext();
  return renderer || null;
}

// FNV-1a 32-bit hash. Not cryptographic; turns a long string into a short ID.
function hashString(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// User-Agent Client Hints "high entropy" values (Chromium only).
// Any script can request these without a permission prompt.
async function clientHints() {
  const uaData = navigator.userAgentData;
  if (!uaData || !uaData.getHighEntropyValues) return null;
  try {
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 1000));
    return await Promise.race([
      uaData.getHighEntropyValues(['model', 'platformVersion', 'architecture', 'bitness']),
      timeout,
    ]);
  } catch (e) {
    return null;
  }
}

// Expensive or async values are read once and reused on resize.
let cachedOnce = null;

async function readOnce() {
  if (!cachedOnce) {
    cachedOnce = {
      gpu: safe(webglRenderer),
      canvas: safe(canvasHash),
      hints: await clientHints(),
    };
  }
  return cachedOnce;
}

function collectFacts(once) {
  const conn = navigator.connection;
  const languages = safe(() => (navigator.languages && navigator.languages.length
    ? [...navigator.languages] : [navigator.language]).filter(Boolean), []);
  const browser = detectBrowser();
  const mq = (q) => safe(() => matchMedia(q).matches, false);
  return {
    screenW: safe(() => screen.width), screenH: safe(() => screen.height),
    availW: safe(() => screen.availWidth), availH: safe(() => screen.availHeight),
    dpr: window.devicePixelRatio || 1,
    innerW: window.innerWidth, innerH: window.innerHeight,
    colorDepth: safe(() => screen.colorDepth),
    isExtended: safe(() => (typeof screen.isExtended === 'boolean' ? screen.isExtended : null)),
    timezone: safe(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
    offsetMinutes: -new Date().getTimezoneOffset(),
    languages,
    os: detectOS(),
    browser: browser.name, browserVersion: browser.version,
    cores: safe(() => navigator.hardwareConcurrency),
    memory: safe(() => navigator.deviceMemory),
    touchPoints: safe(() => navigator.maxTouchPoints),
    dark: mq('(prefers-color-scheme: dark)'),
    light: mq('(prefers-color-scheme: light)'),
    reducedMotion: mq('(prefers-reduced-motion: reduce)'),
    connection: conn && conn.effectiveType ? conn : null,
    doNotTrack: safe(() => ('doNotTrack' in navigator ? navigator.doNotTrack
      : 'doNotTrack' in window ? window.doNotTrack : undefined), undefined),
    gpc: safe(() => navigator.globalPrivacyControl),
    cookies: safe(() => navigator.cookieEnabled),
    ...once,
  };
}

/* ---------------------------------------------------------
   2. Raw signal list (what is shown under --raw)
   Each read(f) returns a short string, or null if missing.
   --------------------------------------------------------- */
const SIGNALS = [
  {
    name: 'screen', level: 'Medium',
    read: (f) => f.screenW && `${f.screenW}×${f.screenH} @ ${f.dpr}x`,
    use: 'with the pixel ratio, screen size narrows down the exact device model',
  },
  {
    name: 'usable area', level: 'Medium',
    read: (f) => f.availW && `${f.availW}×${f.availH}`,
    use: 'the space taken by the Dock/taskbar reveals how you set up your desktop',
  },
  {
    name: 'window', level: 'Medium',
    read: (f) => f.innerW && `${f.innerW}×${f.innerH}`,
    use: 'few people share an exact window size, so it links tabs within a session',
  },
  {
    name: 'monitors', level: 'Low',
    read: (f) => (f.isExtended === null ? null : f.isExtended ? 'more than one' : 'one'),
    use: 'screen.isExtended tells any page whether a second display is attached',
  },
  {
    name: 'color depth', level: 'Low',
    read: (f) => f.colorDepth && `${f.colorDepth}-bit`,
    use: 'almost everyone reports 24-bit, so an unusual value stands out',
  },
  {
    name: 'time zone', level: 'Medium',
    read: (f) => {
      if (!f.timezone) return null;
      const m = Math.abs(f.offsetMinutes);
      return `${f.timezone} (UTC${f.offsetMinutes >= 0 ? '+' : '-'}${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')})`;
    },
    use: 'reveals your country without asking for location; a mismatch with your IP flags a VPN',
  },
  {
    name: 'languages', level: 'Medium',
    read: (f) => f.languages.length && f.languages.join(', '),
    use: 'the exact list and order you set is often distinctive',
  },
  {
    name: 'os', level: 'Low',
    read: (f) => f.os,
    use: 'serves the right downloads; also a basic fingerprint ingredient',
  },
  {
    name: 'browser', level: 'Medium',
    read: (f) => f.browser && `${f.browser} ${f.browserVersion || ''}`.trim(),
    use: 'older or rarer versions make you easier to single out',
  },
  {
    name: 'client hints', level: 'High',
    read: (f) => {
      const h = f.hints;
      if (!h) return null;
      const parts = [];
      if (h.model) parts.push(`model "${h.model}"`);
      if (h.platformVersion) parts.push(`OS version ${h.platformVersion}`);
      if (h.architecture) parts.push(`${h.architecture}${h.bitness ? ' ' + h.bitness + '-bit' : ''}`);
      return parts.length ? parts.join(', ') : null;
    },
    use: 'Chromium hands these out to any script that asks, including your phone model',
  },
  {
    name: 'cpu cores', level: 'Medium',
    read: (f) => f.cores && `${f.cores} logical cores`,
    use: 'hints at device class and separates otherwise identical devices',
  },
  {
    name: 'memory', level: 'Low',
    read: (f) => f.memory && `≈ ${f.memory} GB (rounded by the browser)`,
    use: 'lets sites serve lighter pages to low-end devices; also a fingerprint ingredient',
  },
  {
    name: 'touch', level: 'Low',
    read: (f) => (typeof f.touchPoints !== 'number' ? null
      : f.touchPoints > 0 ? `yes (${f.touchPoints} touch points)` : 'no touch screen'),
    use: 'separates phones, tablets and touch laptops from desktops',
  },
  {
    name: 'color scheme', level: 'Low',
    read: (f) => (f.dark ? 'dark' : f.light ? 'light' : 'no preference'),
    use: 'used for theming; adds a small bit of information',
  },
  {
    name: 'reduced motion', level: 'Low',
    read: (f) => (f.reducedMotion ? 'reduce' : 'no preference'),
    use: 'few people turn it on, so enabling it makes you rarer',
  },
  {
    name: 'connection', level: 'Low',
    read: (f) => {
      const c = f.connection;
      if (!c) return null;
      return [`${c.effectiveType} speed class`, c.type && `type: ${c.type}`, c.saveData && 'data saver on']
        .filter(Boolean).join(', ');
    },
    use: 'hints whether you are on mobile data or Wi-Fi',
  },
  {
    name: 'do not track', level: 'Low',
    read: (f) => (f.doNotTrack === undefined ? null
      : f.doNotTrack === '1' || f.doNotTrack === 'yes' ? 'enabled'
        : f.doNotTrack === '0' || f.doNotTrack === 'no' ? 'disabled' : 'not set'),
    use: 'mostly ignored; turning it on can make you more distinctive',
  },
  {
    name: 'gpc', level: 'Low',
    read: (f) => (typeof f.gpc !== 'boolean' ? null : f.gpc ? 'enabled' : 'not enabled'),
    use: 'Global Privacy Control: an opt-out some laws require sites to honour',
  },
  {
    name: 'cookies', level: 'Low',
    read: (f) => (typeof f.cookies !== 'boolean' ? null : f.cookies ? 'enabled' : 'disabled'),
    use: 'if cookies are off, trackers lean on fingerprinting instead',
  },
  {
    name: 'canvas hash', level: 'High',
    read: (f) => f.canvas,
    use: 'a hidden drawing renders slightly differently per device: a stable tracking ID',
  },
  {
    name: 'gpu', level: 'High',
    read: (f) => f.gpu,
    use: 'your exact graphics chip, which narrows down your device considerably',
  },
];

/* ---------------------------------------------------------
   3. Rendering. textContent only, never innerHTML, so no
   browser-supplied value can ever be treated as HTML.
   --------------------------------------------------------- */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

// [████████░░] style bar, 10 cells wide.
function bar(fraction, cells = 10) {
  const filled = Math.max(0, Math.min(cells, Math.round(fraction * cells)));
  return '█'.repeat(filled) + '░'.repeat(cells - filled);
}

function confidenceClass(c) {
  if (c >= 80) return 'c-high';
  if (c >= 60) return 'c-mid';
  return 'c-low';
}

function renderInference(item) {
  const li = el('li', 'inf');
  li.append(el('span', 'inf-label', item.label), el('span', 'inf-value', item.value));

  const conf = el('span', `inf-conf ${confidenceClass(item.confidence)}`);
  conf.textContent = `[${bar(item.confidence / 100)}] ${item.confidence}% ${confidenceWord(item.confidence)}`;
  li.append(conf);

  const details = el('details', 'inf-why');
  details.append(el('summary', null, 'why?'));
  const ul = el('ul', 'evidence');
  item.evidence.forEach((line) => ul.append(el('li', null, line)));
  details.append(ul);
  li.append(details);
  return li;
}

function renderProfile(result) {
  document.getElementById('summary').textContent = result.summary;
  document.getElementById('inferences').replaceChildren(...result.list.map(renderInference));
}

function renderRarity(rarity) {
  const rows = rarity.factors.map((x) => {
    const li = el('li', `rar${x.bits === 0 ? ' rar-hidden' : ''}`);
    li.append(
      el('span', 'rar-name', x.name),
      el('span', 'rar-value', x.value),
      el('span', 'rar-bits', `${x.bits.toFixed(1)} bits`),
      el('span', 'rar-bar', '█'.repeat(Math.min(16, Math.round(x.bits))) || '·'),
    );
    if (x.note) li.title = x.note;
    return li;
  });
  document.getElementById('rarity-rows').replaceChildren(...rows);
  document.getElementById('rarity-raw').textContent =
    `raw sum ${rarity.rawBits.toFixed(1)} bits, minus overlap between related signals`;
  document.getElementById('rarity-total').textContent =
    `${rarity.bits.toFixed(1)} bits → about 1 in ${formatOneIn(rarity.oneIn)} browsers`;
  const hidden = rarity.factors.filter((x) => x.bits === 0).map((x) => x.name);
  document.getElementById('rarity-hidden').textContent = hidden.length
    ? `Hidden by your browser (0 bits, good): ${hidden.join(', ')}.`
    : 'Your browser hides none of these signals.';
}

function renderSignals(facts) {
  const rows = SIGNALS.map((s) => {
    const value = safe(() => s.read(facts));
    const li = el('li', 'sig');
    li.append(
      el('span', 'sig-name', s.name),
      el('span', `sig-value${value ? '' : ' na'}`, value ? String(value) : NOT_AVAILABLE),
      el('span', `sig-tag tag-${s.level.toLowerCase()}`, `[${s.level.toUpperCase()}]`),
      el('span', 'sig-use', `# ${s.use}`),
    );
    return li;
  });
  document.getElementById('signals').replaceChildren(...rows);
  document.getElementById('signal-count').textContent = SIGNALS.length;
}

function renderChrome() {
  const now = new Date();
  const stamp = now.toString().split(' ').slice(0, 5).join(' '); // "Fri Nov 13 2026 22:20:13"
  const parts = stamp.split(' ');
  document.getElementById('last-login').textContent = `${parts[0]} ${parts[1]} ${parts[2]} ${parts[4]}`;
  document.getElementById('term-size').textContent = `${window.innerWidth}×${window.innerHeight}`;
}

async function render() {
  const facts = collectFacts(await readOnce());
  const result = inferAll(facts);
  renderChrome();
  renderProfile(result);
  renderRarity(result.rarity);
  renderSignals(facts);
  document.body.classList.add('ready');
}

function init() {
  render();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 250);
  });

  ['(prefers-color-scheme: dark)', '(prefers-reduced-motion: reduce)'].forEach((query) => {
    const mq = safe(() => matchMedia(query));
    if (mq && mq.addEventListener) mq.addEventListener('change', render);
  });
}

document.addEventListener('DOMContentLoaded', init);
