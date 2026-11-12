/* =========================================================
   What Your Browser Tells Websites — script.js

   How this file is organised:
     1. One small function per signal. Each returns a short
        string, or null if the browser does not support it.
     2. SIGNALS: a list describing each card (name, reader
        function, explanation, identifiability level).
     3. Scoring: turns the results into a 0–100 heuristic score.
     4. Rendering: builds the cards and the meter in the DOM.

   Nothing here makes a network request. All values stay in
   the page and disappear when you close the tab.
   ========================================================= */

'use strict';

const NOT_AVAILABLE = 'Not available in your browser';

/* ---------------------------------------------------------
   1. Signal functions (one per signal)
   --------------------------------------------------------- */

// Physical screen size in CSS pixels, plus devicePixelRatio
// (e.g. 2 on most "Retina" / high-density screens).
function getScreen() {
  if (!window.screen || !screen.width) return null;
  const ratio = window.devicePixelRatio || 1;
  return `${screen.width} × ${screen.height} @ ${ratio}x pixel ratio`;
}

// Current size of the browser window's viewport.
function getWindowSize() {
  if (!window.innerWidth) return null;
  return `${window.innerWidth} × ${window.innerHeight}`;
}

// Bits per pixel the screen can display (usually 24 or 30).
function getColorDepth() {
  if (!window.screen || !screen.colorDepth) return null;
  return `${screen.colorDepth}-bit`;
}

// IANA time zone name, e.g. "Europe/London", plus UTC offset.
function getTimezone() {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!zone) return null;
  // getTimezoneOffset() is minutes *behind* UTC, so flip the sign.
  const offsetMinutes = -new Date().getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const hours = Math.floor(Math.abs(offsetMinutes) / 60);
  const minutes = String(Math.abs(offsetMinutes) % 60).padStart(2, '0');
  return `${zone} (UTC${sign}${hours}:${minutes})`;
}

// Preferred languages, in the order the user set them.
function getLanguages() {
  const list = navigator.languages && navigator.languages.length
    ? navigator.languages
    : [navigator.language];
  const clean = list.filter(Boolean);
  return clean.length ? clean.join(', ') : null;
}

// Operating system / platform. Prefers the newer User-Agent Client
// Hints API (Chromium), falls back to the older navigator.platform.
function getPlatform() {
  const uaData = navigator.userAgentData;
  if (uaData && uaData.platform) {
    return uaData.platform + (uaData.mobile ? ' (mobile)' : '');
  }
  return navigator.platform || null;
}

// Browser name and major version, read from the user-agent.
function getBrowser() {
  // Client Hints give a list of "brands". Skip the deliberately fake
  // "Not A Brand" entry and prefer a specific brand over "Chromium".
  const uaData = navigator.userAgentData;
  if (uaData && uaData.brands && uaData.brands.length) {
    const real = uaData.brands.filter((b) => !/not.?a.?brand/i.test(b.brand));
    const best = real.find((b) => b.brand !== 'Chromium') || real[0];
    if (best) return `${best.brand} ${best.version}`;
  }

  // Fallback: parse the classic user-agent string. Order matters,
  // because e.g. Edge's UA also contains "Chrome" and "Safari".
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
    if (match) return `${name} ${match[1]}`;
  }
  return ua ? 'Unknown browser' : null;
}

// Number of logical CPU cores (threads) the browser reports.
function getCpuCores() {
  const cores = navigator.hardwareConcurrency;
  return cores ? `${cores} logical cores` : null;
}

// Approximate RAM in GB. Chromium-only; deliberately rounded by the
// browser to a few buckets (e.g. 2, 4, 8) to limit fingerprinting.
function getDeviceMemory() {
  const gb = navigator.deviceMemory;
  return gb ? `≈ ${gb} GB (rounded by the browser)` : null;
}

// Whether the device has a touch screen, and how many touch points.
function getTouchSupport() {
  const points = navigator.maxTouchPoints;
  if (typeof points !== 'number') return null;
  return points > 0 ? `Yes (${points} touch points)` : 'No touch screen detected';
}

// Light / dark mode preference from the operating system.
function getColorScheme() {
  if (!window.matchMedia) return null;
  if (matchMedia('(prefers-color-scheme: dark)').matches) return 'Dark';
  if (matchMedia('(prefers-color-scheme: light)').matches) return 'Light';
  return 'No preference';
}

// Accessibility setting asking for less animation.
function getReducedMotion() {
  if (!window.matchMedia) return null;
  return matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'Reduce motion'
    : 'No preference';
}

// Network Information API (mostly Chromium). Gives a rough speed class.
function getConnection() {
  const conn = navigator.connection;
  if (!conn || !conn.effectiveType) return null;
  const parts = [`${conn.effectiveType} speed class`];
  if (conn.type) parts.push(`type: ${conn.type}`);
  if (conn.saveData) parts.push('data saver on');
  return parts.join(', ');
}

// Do Not Track. Older API, ignored by most sites and removed by some
// browsers. Different browsers expose it in different places.
function getDoNotTrack() {
  // Note: null means "supported but not set" (Chrome's default), so we
  // check whether the property exists rather than whether it has a value.
  let value;
  if ('doNotTrack' in navigator) value = navigator.doNotTrack;
  else if ('doNotTrack' in window) value = window.doNotTrack;
  else if ('msDoNotTrack' in navigator) value = navigator.msDoNotTrack;
  else return null;
  if (value === '1' || value === 'yes') return 'Enabled';
  if (value === '0' || value === 'no') return 'Disabled';
  return 'Not set';
}

// Global Privacy Control: a newer "do not sell my data" signal.
function getGlobalPrivacyControl() {
  const gpc = navigator.globalPrivacyControl;
  if (typeof gpc !== 'boolean') return null;
  return gpc ? 'Enabled' : 'Not enabled';
}

// Whether the browser accepts cookies at all.
function getCookiesEnabled() {
  if (typeof navigator.cookieEnabled !== 'boolean') return null;
  return navigator.cookieEnabled ? 'Enabled' : 'Disabled';
}

// Canvas fingerprint: draw text and shapes, then hash the pixels.
// Tiny differences in GPU, drivers, fonts and anti-aliasing make the
// image (and so the hash) differ between devices.
function getCanvasHash() {
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
  // Some privacy modes block canvas reads and return an empty image.
  if (!data || data === 'data:,') return null;
  return hashString(data);
}

// Graphics card name reported by WebGL. Highly identifying.
function getWebglRenderer() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) return null;

  // The debug extension reveals the real ("unmasked") GPU name where allowed.
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = ext
    ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
    : gl.getParameter(gl.RENDERER);

  // Free the GPU context straight away; we only needed one value.
  const lose = gl.getExtension('WEBGL_lose_context');
  if (lose) lose.loseContext();
  return renderer || null;
}

/* ---------------------------------------------------------
   Helper: FNV-1a 32-bit hash. Small, fast, synchronous.
   Not cryptographic — only used to turn a long string into
   a short, comparable ID.
   --------------------------------------------------------- */
function hashString(text) {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime, 32-bit multiply
  }
  // >>> 0 converts to an unsigned 32-bit number before printing as hex.
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/* ---------------------------------------------------------
   2. Signal definitions
   level = how much this signal tends to narrow down who you
   are, on its own: Low, Medium or High.
   --------------------------------------------------------- */
const SIGNALS = [
  {
    name: 'Screen size & pixel ratio',
    read: getScreen,
    use: 'Combined with other values, screen dimensions split visitors into smaller groups and help tell device models apart.',
    level: 'Medium',
  },
  {
    name: 'Browser window size',
    read: getWindowSize,
    use: 'Can link activity across tabs and sites during a session, since few people have exactly the same window size.',
    level: 'Medium',
  },
  {
    name: 'Color depth',
    read: getColorDepth,
    use: 'Almost everyone reports 24-bit, so it adds little alone, but an unusual value stands out.',
    level: 'Low',
  },
  {
    name: 'Time zone',
    read: getTimezone,
    use: 'Reveals your rough region without asking for location, and a mismatch with your IP can flag a VPN.',
    level: 'Medium',
  },
  {
    name: 'Languages',
    read: getLanguages,
    use: 'Used to pick page language, but the exact list and order you set is often distinctive.',
    level: 'Medium',
  },
  {
    name: 'Platform / OS',
    read: getPlatform,
    use: 'Used to serve the right downloads and layouts, and as a basic fingerprint ingredient.',
    level: 'Low',
  },
  {
    name: 'Browser & version',
    read: getBrowser,
    use: 'Used for compatibility and analytics; older or rarer versions make you easier to single out.',
    level: 'Medium',
  },
  {
    name: 'CPU cores',
    read: getCpuCores,
    use: 'Hints at your device class and helps separate devices that otherwise look identical.',
    level: 'Medium',
  },
  {
    name: 'Device memory',
    read: getDeviceMemory,
    use: 'Lets sites serve lighter pages to low-end devices; also a small extra fingerprint ingredient.',
    level: 'Low',
  },
  {
    name: 'Touch support',
    read: getTouchSupport,
    use: 'Distinguishes phones, tablets and touch laptops from desktop computers.',
    level: 'Low',
  },
  {
    name: 'Color scheme preference',
    read: getColorScheme,
    use: 'Used to switch light or dark themes; it also adds a small bit of information about you.',
    level: 'Low',
  },
  {
    name: 'Reduced-motion preference',
    read: getReducedMotion,
    use: 'Lets sites tone down animations; because few people turn it on, enabling it makes you rarer.',
    level: 'Low',
  },
  {
    name: 'Connection type',
    read: getConnection,
    use: 'Lets sites adapt video quality; also hints whether you are on mobile data or Wi-Fi.',
    level: 'Low',
  },
  {
    name: 'Do Not Track',
    read: getDoNotTrack,
    use: 'A request not to be tracked that most sites ignore. Ironically, turning it on can make you more distinctive.',
    level: 'Low',
  },
  {
    name: 'Global Privacy Control',
    read: getGlobalPrivacyControl,
    use: 'An opt-out signal some laws require sites to honour; like any setting, it is also readable by trackers.',
    level: 'Low',
  },
  {
    name: 'Cookies enabled',
    read: getCookiesEnabled,
    use: 'Tells a site whether it can store an ID on your device. If not, it may lean on fingerprinting instead.',
    level: 'Low',
  },
  {
    name: 'Canvas fingerprint',
    read: getCanvasHash,
    use: 'A hidden drawing renders slightly differently per device; its hash is a common, stable tracking ID.',
    level: 'High',
  },
  {
    name: 'Graphics card (WebGL)',
    read: getWebglRenderer,
    use: 'Your exact GPU model, often with driver details, which narrows down your device considerably.',
    level: 'High',
  },
];

// Points per identifiability level, used by the heuristic score.
const LEVEL_POINTS = { Low: 1, Medium: 2, High: 3 };

/* ---------------------------------------------------------
   Run every signal safely. If an API throws or is missing,
   the value is null and the card shows NOT_AVAILABLE.
   --------------------------------------------------------- */
function readSignal(signal) {
  try {
    const value = signal.read();
    if (value === null || value === undefined || value === '') return null;
    return String(value);
  } catch (error) {
    return null;
  }
}

function collectSignals() {
  return SIGNALS.map((signal) => ({ ...signal, value: readSignal(signal) }));
}

/* ---------------------------------------------------------
   3. Heuristic uniqueness score (0–100)
   Each exposed signal earns points by level. The score is the
   share of the maximum possible points. It measures how much
   your browser exposes, NOT how rare your values are.
   --------------------------------------------------------- */
function calculateScore(results) {
  let earned = 0;
  let possible = 0;
  for (const result of results) {
    const points = LEVEL_POINTS[result.level];
    possible += points;
    if (result.value !== null) earned += points;
  }
  return Math.round((earned / possible) * 100);
}

function scoreBand(score) {
  if (score < 40) return { key: 'low', label: 'Lower exposure' };
  if (score < 75) return { key: 'medium', label: 'Moderate exposure' };
  return { key: 'high', label: 'High exposure: your browser shares most signals' };
}

/* ---------------------------------------------------------
   4. Rendering
   textContent is used everywhere (never innerHTML), so no
   value from the browser can ever be interpreted as HTML.
   --------------------------------------------------------- */
function createCard(result) {
  const item = document.createElement('li');

  const card = document.createElement('article');
  card.className = 'card';

  const head = document.createElement('div');
  head.className = 'card-head';

  const title = document.createElement('h3');
  title.textContent = result.name;

  const tag = document.createElement('span');
  tag.className = `tag tag-${result.level.toLowerCase()}`;
  tag.textContent = result.level;
  // Screen readers hear "Identifiability: High" rather than just "High".
  tag.setAttribute('aria-label', `Identifiability: ${result.level}`);
  tag.title = 'How identifying this signal is on its own';

  head.append(title, tag);

  const value = document.createElement('p');
  value.className = 'card-value';
  if (result.value === null) {
    value.classList.add('unavailable');
    value.textContent = NOT_AVAILABLE;
  } else {
    value.textContent = result.value;
  }

  const use = document.createElement('p');
  use.className = 'card-use';
  const label = document.createElement('strong');
  label.textContent = 'How sites use this: ';
  use.append(label, result.use);

  card.append(head, value, use);
  item.append(card);
  return item;
}

function renderCards(results) {
  const list = document.getElementById('signals');
  list.replaceChildren(...results.map(createCard));
}

function renderMeter(score) {
  const band = scoreBand(score);
  const meter = document.getElementById('meter');
  const fill = document.getElementById('meter-fill');

  document.getElementById('meter-value').textContent = score;
  document.getElementById('meter-label').textContent = band.label;
  meter.setAttribute('aria-valuenow', score);
  meter.setAttribute('aria-valuetext', `${score} out of 100, ${band.label}`);
  fill.className = `meter-fill band-${band.key}`;
  fill.style.width = `${score}%`;
}

function render() {
  const results = collectSignals();
  renderCards(results);
  renderMeter(calculateScore(results));
}

/* ---------------------------------------------------------
   Start-up, plus live updates: re-render when the window is
   resized or the user changes light/dark or motion settings.
   --------------------------------------------------------- */
function init() {
  render();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 250); // debounce: wait until resizing stops
  });

  if (window.matchMedia) {
    ['(prefers-color-scheme: dark)', '(prefers-reduced-motion: reduce)'].forEach((query) => {
      const mq = matchMedia(query);
      if (mq.addEventListener) mq.addEventListener('change', render);
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
