/* =========================================================
   infer.js — the inference engine.

   Takes the raw "facts" collected by script.js and works out
   things no single browser API tells you directly: which
   device you own, where you probably are, how your desk is set
   up, and roughly how rare your browser is.

   Every inference returns:
     { label, value, confidence (0–100), evidence: [strings] }
   so the page can always show WHY it concluded something.

   Pure functions only: no DOM, no network. Depends on the
   tables in data.js.
   ========================================================= */

'use strict';

/* ---------- small helpers ---------- */

function screenKey(w, h, dpr) {
  return `${w}x${h}@${dpr}`;
}

// Mobile screens are keyed portrait (short side first).
function portraitKey(w, h, dpr) {
  return screenKey(Math.min(w, h), Math.max(w, h), dpr);
}

function countryName(code) {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code;
  } catch (e) {
    return code;
  }
}

function languageName(code) {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) || code;
  } catch (e) {
    return code;
  }
}

// "en-IN" → { lang: "en", region: "IN" }
function parseLanguageTag(tag) {
  const parts = String(tag).split(/[-_]/);
  const region = parts.slice(1).find((p) => /^[A-Za-z]{2}$/.test(p));
  return { tag, lang: parts[0].toLowerCase(), region: region ? region.toUpperCase() : null };
}

// Hedge used inside the summary sentence.
function hedge(c) {
  if (c >= 80) return '';
  if (c >= 60) return 'probably ';
  if (c >= 40) return 'possibly ';
  return 'maybe ';
}

function confidenceWord(c) {
  if (c >= 80) return 'very likely';
  if (c >= 60) return 'likely';
  if (c >= 40) return 'possibly';
  return 'a weak guess';
}

function gpuEra(gpu) {
  if (!gpu) return null;
  for (const [regex, name, years] of GPU_ERAS) {
    if (regex.test(gpu)) return { name, years };
  }
  return null;
}

// Browsers with fingerprinting protection replace the real GPU name.
function gpuIsMasked(gpu) {
  return !gpu || /^Apple GPU$|Mozilla|Generic Renderer|SwiftShader|llvmpipe|Disabled/i.test(gpu);
}

function appleChip(gpu) {
  const m = gpu && gpu.match(/Apple (M\d)(?: (Pro|Max|Ultra))?/i);
  return m ? `Apple ${m[1]}${m[2] ? ' ' + m[2] : ''}` : null;
}

function windowsVersion(hints) {
  // Microsoft's documented rule for UA Client Hints: platformVersion
  // major >= 13 means Windows 11, 1–10 means Windows 10.
  if (!hints || !hints.platformVersion) return null;
  const major = parseInt(hints.platformVersion, 10);
  if (major >= 13) return 'Windows 11';
  if (major > 0) return 'Windows 10';
  return null;
}

/* ---------------------------------------------------------
   1. Device model
   --------------------------------------------------------- */
function inferDevice(f) {
  const ev = [];
  const sk = screenKey(f.screenW, f.screenH, f.dpr);
  const pk = portraitKey(f.screenW, f.screenH, f.dpr);
  const era = gpuEra(f.gpu);

  if (f.os === 'iOS' || f.os === 'iPadOS') {
    const table = f.os === 'iOS' ? IPHONE_SCREENS : IPAD_SCREENS;
    const kind = f.os === 'iOS' ? 'iPhone' : 'iPad';
    const pretty = `${Math.min(f.screenW, f.screenH)}×${Math.max(f.screenW, f.screenH)} at ${f.dpr}x`;
    if (f.os === 'iPadOS') {
      ev.push(`browser claims to be a Mac but reports ${f.touchPoints} touch points, which only iPads do`);
    }
    if (gpuIsMasked(f.gpu)) ev.push('Safari hides the exact chip (GPU reports "Apple GPU"), so the screen does the work');
    if (table[pk]) {
      ev.push(`screen ${pretty} matches only these models`);
      return { label: 'device', value: table[pk], confidence: 75, evidence: ev };
    }
    ev.push(`screen ${pretty} is not in my ${kind} table (zoom or a newer model?)`);
    return { label: 'device', value: `an ${kind}, exact model unclear`, confidence: 40, evidence: ev };
  }

  if (f.os === 'Android') {
    const model = f.hints && f.hints.model;
    if (model) {
      const brand = (ANDROID_BRANDS.find(([re]) => re.test(model)) || [])[1];
      const code = model.match(/^SM-([A-Z]\d{3})/i);
      const name = code && SAMSUNG_MODELS[code[1].toUpperCase()];
      ev.push(`your browser handed over the exact model code "${model}" to this page (User-Agent Client Hints), no permission asked`);
      if (name) ev.push(`"${code[1].toUpperCase()}" is Samsung's internal code for the ${name}`);
      const value = name ? `Samsung ${name} (${model})` : brand ? `${brand} phone, model ${model}` : `Android device, model ${model}`;
      return { label: 'device', value, confidence: 95, evidence: ev };
    }
    ev.push('this browser does not reveal the model code (good)');
    if (era) ev.push(`GPU "${f.gpu}" is a ${era.name}, typical of phones from ${era.years}`);
    const tablet = Math.min(f.screenW, f.screenH) >= 600;
    ev.push(`shortest screen side is ${Math.min(f.screenW, f.screenH)}px, so a ${tablet ? 'tablet' : 'phone'}`);
    return { label: 'device', value: `an Android ${tablet ? 'tablet' : 'phone'}`, confidence: 55, evidence: ev };
  }

  if (f.os === 'macOS') {
    const chip = appleChip(f.gpu);
    const intel = f.gpu && /Intel|AMD|Radeon/i.test(f.gpu);
    const match = APPLE_SCREENS[sk];
    if (chip) ev.push(`GPU reports "${f.gpu}", so this Mac has an ${chip} chip`);
    else if (intel) ev.push(`GPU reports "${f.gpu}", so this is an Intel Mac (made before 2021)`);
    else if (f.hints && f.hints.architecture === 'arm') ev.push('Chrome reports an "arm" CPU architecture, so this is an Apple Silicon Mac');
    else ev.push('the GPU name is hidden, so the chip is unknown');

    if (match) {
      ev.push(`screen ${f.screenW}×${f.screenH} at ${f.dpr}x is the default for the ${match.model}`);
      ev.push('assumes you kept the default display scaling');
      let confidence = chip || intel ? 85 : 65;
      if (intel && /2021|2022|2023/.test(match.model)) {
        ev.push('conflict: that screen size came after Intel Macs were discontinued, so confidence is lowered');
        confidence = 35;
      }
      if (chip && /Intel/.test(match.model)) {
        ev.push('conflict: that model was Intel-only, but the GPU is Apple Silicon, so confidence is lowered');
        confidence = 35;
      }
      return { label: 'device', value: match.model + (chip ? ` with ${chip}` : ''), confidence, evidence: ev };
    }
    if (f.dpr === 1 && f.screenW >= 1600) {
      ev.push(`screen is ${f.screenW}×${f.screenH} at 1x, which no Mac has built in, so this is an external monitor`);
      return { label: 'device', value: `a ${chip ? chip + ' ' : ''}Mac on an external monitor`, confidence: 70, evidence: ev };
    }
    ev.push(`screen ${f.screenW}×${f.screenH} at ${f.dpr}x does not match a default Mac display (custom scaling?)`);
    return { label: 'device', value: chip ? `a Mac with ${chip}` : 'a Mac, model unclear', confidence: chip ? 55 : 35, evidence: ev };
  }

  // Windows, Linux, ChromeOS: work out laptop vs desktop.
  let laptop = 0;
  let desktop = 0;
  if (f.gpu && /Laptop/i.test(f.gpu)) {
    laptop += 3; ev.push(`GPU name contains "Laptop": "${f.gpu}"`);
  } else if (f.gpu && /RTX|GTX|Radeon RX|Arc\(TM\) A\d/i.test(f.gpu)) {
    desktop += 2; ev.push(`dedicated graphics card without "Laptop" in its name: "${f.gpu}"`);
  } else if (f.gpu && /UHD|Iris|Radeon\(TM\) Graphics|Vega|Adreno/i.test(f.gpu)) {
    laptop += 1; ev.push(`integrated graphics ("${f.gpu}"), most common in laptops`);
  }
  const physW = Math.round(f.screenW * f.dpr);
  const physH = Math.round(f.screenH * f.dpr);
  if (f.os === 'Windows' && f.dpr > 1 && f.dpr < 2.5) {
    laptop += 1;
    ev.push(`${Math.round(f.dpr * 100)}% display scaling on a ${physW}×${physH} panel, which Windows picks by default for laptop-sized screens`);
  } else if (f.dpr === 1 && physW >= 1920) {
    desktop += 1;
    ev.push(`${physW}×${physH} at 100% scaling, typical of a desktop monitor`);
  }
  if (f.touchPoints > 0) {
    laptop += 1; ev.push(`touch screen with ${f.touchPoints} touch points: a 2-in-1 or touch laptop`);
  }
  if (f.isExtended) {
    desktop += 1; ev.push('more than one monitor is connected');
  }

  if (gpuIsMasked(f.gpu)) ev.push(f.gpu ? `GPU name is masked ("${f.gpu}"), so the graphics card can't help` : 'WebGL is unavailable, so the graphics card is unknown');
  if (laptop === 0 && desktop === 0) ev.push('no clear laptop or desktop clues');

  const osName = windowsVersion(f.hints) || f.os || 'an unknown OS';
  if (windowsVersion(f.hints)) {
    ev.push(`the browser reports platform version ${f.hints.platformVersion}, which Microsoft documents as ${osName}`);
  }
  const kind = laptop > desktop ? 'laptop' : desktop > laptop ? 'desktop PC' : 'computer';
  const gpuPart = era ? ` with ${era.name}` : '';
  const confidence = Math.min(85, 35 + Math.abs(laptop - desktop) * 15);
  return { label: 'device', value: `a ${osName} ${kind}${gpuPart}`, confidence, evidence: ev };
}

/* ---------------------------------------------------------
   2. Hardware age (from the GPU generation)
   --------------------------------------------------------- */
function inferHardwareAge(f) {
  if (gpuIsMasked(f.gpu)) {
    return {
      label: 'hardware age', value: 'hidden', confidence: 0,
      evidence: [f.gpu ? `your browser reports a generic GPU ("${f.gpu}") instead of the real one: that's fingerprinting protection working` : 'WebGL is unavailable, so the GPU is unknown'],
    };
  }
  const era = gpuEra(f.gpu);
  if (!era) {
    return { label: 'hardware age', value: 'unknown', confidence: 0, evidence: [`GPU "${f.gpu}" is not in my release-date table`] };
  }
  return {
    label: 'hardware age',
    value: `bought around ${era.years}`,
    confidence: 70,
    evidence: [`GPU reports "${f.gpu}"`, `the ${era.name} shipped in ${era.years}`, 'people often keep devices for years, so this is the earliest likely date'],
  };
}

/* ---------------------------------------------------------
   3. Location (country, sometimes region) — no IP address
   --------------------------------------------------------- */
function inferLocation(f) {
  const ev = [];
  const scores = {};
  const add = (code, pts) => { scores[code] = (scores[code] || 0) + pts; };

  const tz = TIMEZONE_COUNTRY[f.timezone];
  if (tz) {
    add(tz[0], 3);
    ev.push(`time zone "${f.timezone}" is only used in ${countryName(tz[0])}${tz[1] ? ` (${tz[1]})` : ''}`);
  } else if (/^(Etc\/)?(UTC|GMT|Universal)$/i.test(f.timezone || '')) {
    ev.push(`time zone is "${f.timezone}", which Tor Browser and Firefox's resist-fingerprinting mode report to hide your real one`);
  } else if (f.timezone) {
    ev.push(`time zone "${f.timezone}" is not in my table`);
  }

  const langs = (f.languages || []).map(parseLanguageTag);
  langs.forEach((l, i) => {
    const weight = i === 0 ? 2 : 1;
    if (l.region) {
      if (l.lang === 'en' && l.region === 'US') {
        add('US', 0.5);
        ev.push('"en-US" is the default English setting worldwide, so it barely points to the US');
      } else {
        add(l.region, weight);
        ev.push(`language "${l.tag}" is ${languageName(l.lang)} as used in ${countryName(l.region)}`);
      }
    } else if (LANGUAGE_COUNTRIES[l.lang]) {
      const list = LANGUAGE_COUNTRIES[l.lang];
      list.forEach((c) => add(c, weight / list.length));
      ev.push(`${languageName(l.lang)} is mainly spoken in ${list.map(countryName).join(', ')}`);
    }
  });

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (!ranked.length) {
    return { label: 'location', value: 'unknown', confidence: 0, evidence: ev.length ? ev : ['no usable time zone or language'] };
  }
  const [best, bestScore] = ranked[0];
  if (bestScore < 1) {
    ev.push('nothing else points anywhere, so no guess');
    return { label: 'location', value: 'unknown', confidence: 0, evidence: ev };
  }
  const runnerUp = ranked[1] ? ranked[1][1] : 0;
  const tzAgrees = tz && tz[0] === best;
  const langAgrees = langs.some((l) =>
    (l.region === best && !(l.lang === 'en' && l.region === 'US')) ||
    (!l.region && (LANGUAGE_COUNTRIES[l.lang] || []).includes(best)));

  let confidence;
  if (tzAgrees && langAgrees) confidence = 90;
  else if (tzAgrees) confidence = 70;
  else confidence = 45;
  if (bestScore - runnerUp < 1) confidence -= 15;

  const region = tzAgrees && tz[1] ? ` (${tz[1]})` : '';
  return { label: 'location', value: countryName(best) + region, confidence, evidence: ev };
}

/* Languages that point somewhere other than your clock. */
function inferMismatch(f) {
  const tz = TIMEZONE_COUNTRY[f.timezone];
  if (!tz) return null;
  const home = tz[0];
  const langs = (f.languages || []).map(parseLanguageTag).filter((l) => l.lang !== 'en');
  for (const l of langs) {
    const countries = l.region ? [l.region] : LANGUAGE_COUNTRIES[l.lang];
    if (countries && !countries.includes(home)) {
      return {
        label: 'background',
        value: `${languageName(l.lang)} speaker living in or visiting ${countryName(home)}`,
        confidence: 50,
        evidence: [
          `you set "${l.tag}" (${languageName(l.lang)}), which points to ${countries.map(countryName).join(', ')}`,
          `but your clock is set to ${countryName(home)}`,
          'trackers use this kind of mismatch to tag expats and travellers; comparing it with your IP address also exposes VPN users',
        ],
      };
    }
  }
  return null;
}

/* ---------------------------------------------------------
   4. Desk setup: monitors, dock/taskbar, window habits
   --------------------------------------------------------- */
function inferSetup(f) {
  const ev = [];
  const parts = [];
  const mobile = f.os === 'iOS' || f.os === 'Android' || f.os === 'iPadOS';
  if (mobile) return null;

  if (f.isExtended === true) {
    parts.push('2+ monitors'); ev.push('screen.isExtended = true: the browser says more than one display is attached');
  } else if (f.isExtended === false) {
    parts.push('a single screen'); ev.push('screen.isExtended = false: only one display attached');
  }

  const lostH = f.screenH - f.availH;
  const lostW = f.screenW - f.availW;
  if (f.os === 'macOS') {
    if (lostW > 0) {
      parts.push('Dock on the side'); ev.push(`${lostW}px of width is reserved, which is where a side Dock sits`);
    } else if (lostH > 45) {
      parts.push('Dock visible at the bottom'); ev.push(`${lostH}px of height is reserved: the menu bar plus a visible Dock`);
    } else if (lostH > 0) {
      parts.push('Dock auto-hidden'); ev.push(`only ${lostH}px of height is reserved, just the menu bar, so the Dock is hidden`);
    }
  } else if (f.os === 'Windows') {
    if (lostW > 0) {
      parts.push('taskbar on the side'); ev.push(`${lostW}px of width is reserved for a side taskbar`);
    } else if (lostH > 0) {
      parts.push('taskbar at the bottom'); ev.push(`${lostH}px of height is reserved for the taskbar`);
    } else {
      parts.push('taskbar auto-hidden'); ev.push('no screen space is reserved, so the taskbar hides itself');
    }
  }

  if (f.innerW && f.availW) {
    const share = f.innerW / f.availW;
    if (share < 0.7) {
      parts.push('browser in a half-width window');
      ev.push(`the page is ${f.innerW}px wide on a ${f.availW}px screen (${Math.round(share * 100)}%): split-screen or a tiled window`);
    } else if (share >= 0.97) {
      parts.push('browser maximised');
      ev.push(`the page fills ${Math.round(share * 100)}% of the screen width`);
    }
  }

  if (!parts.length) return null;
  return { label: 'desk setup', value: parts.join(', '), confidence: 70, evidence: ev };
}

/* ---------------------------------------------------------
   5. Rarity estimate: "about 1 in N browsers look like yours"
   Each factor's share p becomes -log2(p) bits of information.
   Signals that describe the same thing (screen, GPU, cores
   all follow from the device model) are grouped, and only
   partly counted within a group: see the overlap correction.
   --------------------------------------------------------- */
// Which signals overlap with each other (see the overlap correction).
const RARITY_GROUP = {
  'operating system': 'device', 'screen size': 'device', 'pixel ratio': 'device',
  'CPU cores': 'device', memory: 'device', 'touch points': 'device',
  'graphics card': 'device', 'canvas drawing': 'device',
  'time zone': 'locale', 'language list': 'locale',
};
const OVERLAP_KEEP = 0.25;

function computeRarity(f) {
  const factors = [];
  const add = (name, value, p, note) => {
    const group = RARITY_GROUP[name] || name;
    if (p === null) {
      factors.push({ name, group, value: 'hidden', p: 1, bits: 0, note: note || 'not exposed by your browser' });
      return;
    }
    const clamped = Math.min(1, Math.max(p, 1e-6));
    factors.push({ name, group, value, p: clamped, bits: -Math.log2(clamped), note });
  };

  const osKey = f.os === 'iPadOS' ? null : f.os;
  add('operating system', f.os || 'unknown', f.os === 'iPadOS' ? 0.03 : (SHARE.os[osKey] ?? 0.01));
  add('browser', f.browser || 'unknown', SHARE.browser[f.browser] ?? 0.01);

  const sizeKey = `${f.screenW}x${f.screenH}`;
  add('screen size', `${f.screenW}×${f.screenH}`, SHARE.screen[sizeKey] ?? 0.003);
  add('pixel ratio', `${f.dpr}x`, SHARE.dpr[f.dpr] ?? 0.02);

  add('CPU cores', f.cores ? String(f.cores) : 'hidden', f.cores ? (SHARE.cores[f.cores] ?? 0.02) : null);
  add('memory', f.memory ? `${f.memory} GB` : 'hidden', f.memory ? (SHARE.memory[f.memory] ?? 0.02) : null);
  add('touch points', String(f.touchPoints ?? 'unknown'), SHARE.touch[f.touchPoints] ?? 0.05);

  const tz = TIMEZONE_COUNTRY[f.timezone];
  const utc = /^(Etc\/)?(UTC|GMT|Universal)$/i.test(f.timezone || '');
  const tzP = tz ? (SHARE.country[tz[0]] ?? 0.004) * (SHARE.zoneWithinCountry[f.timezone] ?? 1)
    : utc ? 0.01 : 0.003;
  add('time zone', f.timezone || 'unknown', tzP);

  const langs = (f.languages || []).map(parseLanguageTag);
  if (langs.length) {
    const first = langs[0];
    const countFactor = SHARE.languageCount[langs.length] ?? 0.05;
    const home = tz && tz[0];
    const local = home && (first.region === home || (!first.region && (LANGUAGE_COUNTRIES[first.lang] || []).includes(home)));
    let p;
    if (local || (first.lang === 'en' && (!first.region || first.region === 'US'))) {
      // A local language (or default English) is normal for your time zone.
      p = 0.6 * countFactor;
    } else {
      const base = SHARE.language[first.lang] ?? 0.005;
      const main = SHARE.languageMainRegion[first.lang];
      const regionFactor = !first.region ? 0.3 : first.region === main ? 0.6 : 0.15;
      p = base * regionFactor * countFactor;
    }
    add('language list', f.languages.join(', '), p, 'first language (relative to your time zone) and how many you list');
  }

  add('dark mode', f.dark ? 'on' : 'off', f.dark ? 0.35 : 0.65);
  add('reduced motion', f.reducedMotion ? 'on' : 'off', f.reducedMotion ? 0.05 : 0.95);

  let gpuP;
  if (!f.gpu) gpuP = null;
  else if (/^Apple GPU$/i.test(f.gpu)) gpuP = 0.2;
  else if (gpuIsMasked(f.gpu)) gpuP = 0.05;
  else if (/Apple M\d (Pro|Max|Ultra)/i.test(f.gpu)) gpuP = 0.005;
  else if (/Apple M\d/i.test(f.gpu)) gpuP = 0.02;
  else if (/Mali|Adreno|PowerVR|Xclipse/i.test(f.gpu)) gpuP = 0.02;
  else if (/Intel/i.test(f.gpu)) gpuP = 0.03;
  else gpuP = 0.005;
  add('graphics card', f.gpu || 'hidden', gpuP);

  // Canvas: AmIUnique (Laperdrix et al., 2016) measured ~8 bits for
  // canvas, but much of that overlaps with GPU + OS, so count half.
  add('canvas drawing', f.canvas || 'blocked', f.canvas ? 1 / 16 : null, 'counted at 4 bits because it overlaps with GPU and OS');

  // Overlap correction. Signals in the same group mostly describe the
  // same thing (a MacBook Air always has a MacBook Air screen, GPU and
  // core count), so within a group we keep the strongest signal in full
  // and only a quarter of the rest. Crude, but it lands near the ~18 bits
  // that large studies (Panopticlick, AmIUnique) measured for real users.
  const groups = {};
  factors.forEach((x) => { (groups[x.group] = groups[x.group] || []).push(x.bits); });
  let bits = 0;
  Object.values(groups).forEach((list) => {
    const max = Math.max(...list);
    const rest = list.reduce((a, b) => a + b, 0) - max;
    bits += max + OVERLAP_KEEP * rest;
  });
  const rawBits = factors.reduce((sum, x) => sum + x.bits, 0);
  return { factors, bits, rawBits, oneIn: Math.pow(2, bits) };
}

function formatOneIn(n) {
  if (n >= 8e9) return 'more than 8 billion';
  const short = (x) => String(Number(x.toFixed(1)));
  if (n >= 1e9) return `${short(n / 1e9)} billion`;
  if (n >= 1e6) return `${short(n / 1e6)} million`;
  if (n >= 1e4) return `${Math.round(n / 1e3).toLocaleString('en')},000`;
  return Math.round(n).toLocaleString('en');
}

/* ---------------------------------------------------------
   Run everything, and write the one-paragraph summary.
   --------------------------------------------------------- */
function inferAll(f) {
  const device = inferDevice(f);
  const age = inferHardwareAge(f);
  const location = inferLocation(f);
  const mismatch = inferMismatch(f);
  const setup = inferSetup(f);
  const rarity = computeRarity(f);

  const list = [device, location, mismatch, setup, age].filter((x) => x && x.confidence > 0);

  const bits = [];
  bits.push(`${hedge(device.confidence)}using ${device.value}`);
  if (location.confidence > 0) bits.push(`${hedge(location.confidence)}in ${location.value}`);
  const spoken = [...new Set((f.languages || []).map((t) => languageName(parseLanguageTag(t).lang)))];
  if (spoken.length) bits.push(`reads ${spoken.join(' and ')}`);
  if (f.dark) bits.push('prefers dark mode');
  const last = bits.length > 1 ? bits.pop() : null;
  const sentence = last ? `${bits.join(', ')} and ${last}` : bits[0];
  const summary = `This visitor is ${sentence}. Roughly 1 in ${formatOneIn(rarity.oneIn)} browsers look exactly like theirs.`;

  return { summary, list, rarity };
}

// Allow Node to load this file for tests; harmless in the browser.
if (typeof module !== 'undefined') {
  module.exports = { inferAll, inferDevice, inferLocation, inferMismatch, inferSetup, computeRarity, formatOneIn };
}
