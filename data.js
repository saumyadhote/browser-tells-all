/* =========================================================
   data.js — lookup tables used by the inference engine.

   Everything here is hand-built and approximate. Shares are
   rough global web-usage figures, rounded and simplified, in
   the spirit of public stats such as StatCounter. They are
   good enough to say "common" vs "rare", not to be exact.
   ========================================================= */

'use strict';

/* ---------------------------------------------------------
   Apple displays. Key = "width×height@dpr" as reported in
   CSS pixels at macOS's DEFAULT display scaling. Anyone who
   changed scaling won't match, and the engine says so.
   --------------------------------------------------------- */
const APPLE_SCREENS = {
  '1440x900@2': { model: 'MacBook Air 13" or 13" MacBook Pro (2016–2022)', kind: 'laptop' },
  '1470x956@2': { model: 'MacBook Air 13.6" (2022 or later)', kind: 'laptop' },
  '1710x1107@2': { model: 'MacBook Air 15" (2023 or later)', kind: 'laptop' },
  '1512x982@2': { model: 'MacBook Pro 14" (2021 or later)', kind: 'laptop' },
  '1728x1117@2': { model: 'MacBook Pro 16" (2021 or later)', kind: 'laptop' },
  '1536x960@2': { model: 'MacBook Pro 16" (2019, Intel)', kind: 'laptop' },
  '1440x900@1': { model: 'older non-Retina MacBook Air 13"', kind: 'laptop' },
  '2240x1260@2': { model: 'iMac 24" (2021 or later)', kind: 'desktop' },
  '2048x1152@2': { model: 'iMac 21.5" 4K (2015–2019)', kind: 'desktop' },
  '2560x1440@2': { model: 'iMac 27" 5K or Apple Studio Display', kind: 'desktop' },
  '3008x1692@2': { model: 'Apple Pro Display XDR', kind: 'desktop' },
};

/* iPhone: key = "shortSide×longSide@dpr" (portrait CSS pixels). */
const IPHONE_SCREENS = {
  '320x568@2': 'iPhone SE (1st gen) or iPhone 5s',
  '375x667@2': 'iPhone SE (2nd/3rd gen) or iPhone 6/7/8',
  '414x736@3': 'iPhone 6/7/8 Plus',
  '375x812@3': 'iPhone X/XS/11 Pro or 12/13 mini',
  '414x896@2': 'iPhone XR or iPhone 11',
  '414x896@3': 'iPhone XS Max or 11 Pro Max',
  '390x844@3': 'iPhone 12/13/14 or 12/13 Pro',
  '428x926@3': 'iPhone 12/13 Pro Max or 14 Plus',
  '393x852@3': 'iPhone 14 Pro, 15, 15 Pro or 16',
  '430x932@3': 'iPhone 14/15 Pro Max or 15/16 Plus',
  '402x874@3': 'iPhone 16 Pro or iPhone 17',
  '440x956@3': 'iPhone 16 Pro Max or 17 Pro Max',
};

/* iPad: key = "shortSide×longSide@dpr". */
const IPAD_SCREENS = {
  '768x1024@2': 'iPad (older 9.7") or iPad mini 2–5',
  '810x1080@2': 'iPad 10.2" (7th–9th gen)',
  '744x1133@2': 'iPad mini (6th gen or later)',
  '820x1180@2': 'iPad Air (4th gen or later) or iPad (10th gen)',
  '834x1194@2': 'iPad Pro 11"',
  '834x1210@2': 'iPad Pro 11" (M4)',
  '1024x1366@2': 'iPad Pro 12.9" or iPad Air 13"',
};

/* Samsung model codes → marketing names (common flagships only). */
const SAMSUNG_MODELS = {
  S911: 'Galaxy S23', S916: 'Galaxy S23+', S918: 'Galaxy S23 Ultra',
  S921: 'Galaxy S24', S926: 'Galaxy S24+', S928: 'Galaxy S24 Ultra',
  S931: 'Galaxy S25', S936: 'Galaxy S25+', S938: 'Galaxy S25 Ultra',
  A546: 'Galaxy A54', A556: 'Galaxy A55', A346: 'Galaxy A34', A356: 'Galaxy A35',
  F946: 'Galaxy Z Fold5', F731: 'Galaxy Z Flip5', F956: 'Galaxy Z Fold6', F741: 'Galaxy Z Flip6',
};

/* Android model-code prefixes → brand. */
const ANDROID_BRANDS = [
  [/^SM-/i, 'Samsung'],
  [/^Pixel/i, 'Google'],
  [/^CPH/i, 'OPPO / OnePlus'],
  [/^RMX/i, 'Realme'],
  [/^V2\d{3}/i, 'Vivo'],
  [/^(M2|2[0-9]{3})\d+[A-Z]/i, 'Xiaomi / Redmi / POCO'],
  [/^moto/i, 'Motorola'],
  [/^(IN|LE|NE|KB|GM|HD)\d{4}/i, 'OnePlus'],
  [/^Nokia/i, 'Nokia'],
];

/* GPU name patterns → rough release window. First match wins. */
const GPU_ERAS = [
  [/Apple M5/i, 'Apple M5 chip', '2025'],
  [/Apple M4/i, 'Apple M4 chip', '2024–2025'],
  [/Apple M3/i, 'Apple M3 chip', '2023–2024'],
  [/Apple M2/i, 'Apple M2 chip', '2022–2023'],
  [/Apple M1/i, 'Apple M1 chip', '2020–2022'],
  [/RTX 50\d0/i, 'NVIDIA RTX 50-series', '2025'],
  [/RTX 40\d0/i, 'NVIDIA RTX 40-series', '2022–2024'],
  [/RTX 30\d0/i, 'NVIDIA RTX 30-series', '2020–2022'],
  [/RTX 20\d0/i, 'NVIDIA RTX 20-series', '2018–2020'],
  [/GTX 16\d0/i, 'NVIDIA GTX 16-series', '2019–2021'],
  [/GTX 10\d0/i, 'NVIDIA GTX 10-series', '2016–2018'],
  [/RX 9\d{3}/i, 'AMD Radeon RX 9000', '2025'],
  [/RX 7\d{3}/i, 'AMD Radeon RX 7000', '2022–2024'],
  [/RX 6\d{3}/i, 'AMD Radeon RX 6000', '2020–2022'],
  [/RX 5\d{3}/i, 'AMD Radeon RX 5000', '2019–2020'],
  [/Arc\(TM\)|Intel.*Arc/i, 'Intel Arc graphics', '2022 or later'],
  [/Iris\(R\) Xe|Iris Xe/i, 'Intel Iris Xe (11th gen Core or later)', '2020 or later'],
  [/UHD Graphics 6\d\d/i, 'Intel UHD 600-series (8th–10th gen Core)', '2017–2020'],
  [/HD Graphics [56]\d\d/i, 'Intel HD 500/600 (6th–7th gen Core)', '2015–2017'],
  [/Adreno.*7\d\d/i, 'Qualcomm Adreno 700-series', '2022 or later'],
  [/Adreno.*6\d\d/i, 'Qualcomm Adreno 600-series', '2018–2022'],
];

/* ---------------------------------------------------------
   Time zone → country (ISO 3166 code), with an optional
   region label for countries that span several zones.
   Covers the most common zones, not all ~400.
   --------------------------------------------------------- */
const TIMEZONE_COUNTRY = {
  'Asia/Kolkata': ['IN'], 'Asia/Calcutta': ['IN'],
  'America/New_York': ['US', 'Eastern US'], 'America/Detroit': ['US', 'Eastern US'],
  'America/Indiana/Indianapolis': ['US', 'Eastern US'],
  'America/Chicago': ['US', 'Central US'], 'America/Denver': ['US', 'Mountain US'],
  'America/Boise': ['US', 'Mountain US'], 'America/Phoenix': ['US', 'Arizona'],
  'America/Los_Angeles': ['US', 'US West Coast'], 'America/Anchorage': ['US', 'Alaska'],
  'Pacific/Honolulu': ['US', 'Hawaii'],
  'America/Toronto': ['CA', 'Eastern Canada'], 'America/Vancouver': ['CA', 'British Columbia'],
  'America/Edmonton': ['CA', 'Alberta'], 'America/Winnipeg': ['CA', 'Manitoba'],
  'America/Halifax': ['CA', 'Atlantic Canada'], 'America/St_Johns': ['CA', 'Newfoundland'],
  'America/Regina': ['CA', 'Saskatchewan'],
  'America/Mexico_City': ['MX'], 'America/Tijuana': ['MX', 'Baja California'],
  'America/Monterrey': ['MX'], 'America/Cancun': ['MX', 'Quintana Roo'],
  'America/Sao_Paulo': ['BR'], 'America/Manaus': ['BR', 'Amazonas'],
  'America/Fortaleza': ['BR'], 'America/Recife': ['BR'], 'America/Bahia': ['BR'], 'America/Belem': ['BR'],
  'America/Argentina/Buenos_Aires': ['AR'], 'America/Buenos_Aires': ['AR'],
  'America/Santiago': ['CL'], 'America/Bogota': ['CO'], 'America/Lima': ['PE'], 'America/Caracas': ['VE'],
  'Europe/London': ['GB'], 'Europe/Dublin': ['IE'], 'Europe/Paris': ['FR'], 'Europe/Berlin': ['DE'],
  'Europe/Madrid': ['ES'], 'Atlantic/Canary': ['ES', 'Canary Islands'], 'Europe/Rome': ['IT'],
  'Europe/Amsterdam': ['NL'], 'Europe/Brussels': ['BE'], 'Europe/Zurich': ['CH'], 'Europe/Vienna': ['AT'],
  'Europe/Stockholm': ['SE'], 'Europe/Oslo': ['NO'], 'Europe/Copenhagen': ['DK'], 'Europe/Helsinki': ['FI'],
  'Europe/Warsaw': ['PL'], 'Europe/Prague': ['CZ'], 'Europe/Lisbon': ['PT'], 'Europe/Athens': ['GR'],
  'Europe/Bucharest': ['RO'], 'Europe/Budapest': ['HU'], 'Europe/Kyiv': ['UA'], 'Europe/Kiev': ['UA'],
  'Europe/Moscow': ['RU'], 'Asia/Yekaterinburg': ['RU', 'Urals'], 'Asia/Novosibirsk': ['RU', 'Siberia'],
  'Asia/Vladivostok': ['RU', 'Russian Far East'], 'Europe/Istanbul': ['TR'],
  'Asia/Shanghai': ['CN'], 'Asia/Urumqi': ['CN', 'Xinjiang'], 'Asia/Hong_Kong': ['HK'], 'Asia/Taipei': ['TW'],
  'Asia/Tokyo': ['JP'], 'Asia/Seoul': ['KR'], 'Asia/Singapore': ['SG'], 'Asia/Kuala_Lumpur': ['MY'],
  'Asia/Jakarta': ['ID', 'western Indonesia'], 'Asia/Makassar': ['ID', 'central Indonesia'],
  'Asia/Manila': ['PH'], 'Asia/Bangkok': ['TH'], 'Asia/Ho_Chi_Minh': ['VN'], 'Asia/Saigon': ['VN'],
  'Asia/Karachi': ['PK'], 'Asia/Dhaka': ['BD'], 'Asia/Colombo': ['LK'], 'Asia/Kathmandu': ['NP'],
  'Asia/Dubai': ['AE'], 'Asia/Riyadh': ['SA'], 'Asia/Qatar': ['QA'], 'Asia/Jerusalem': ['IL'],
  'Asia/Tehran': ['IR'],
  'Australia/Sydney': ['AU', 'New South Wales'], 'Australia/Melbourne': ['AU', 'Victoria'],
  'Australia/Brisbane': ['AU', 'Queensland'], 'Australia/Perth': ['AU', 'Western Australia'],
  'Australia/Adelaide': ['AU', 'South Australia'], 'Australia/Hobart': ['AU', 'Tasmania'],
  'Australia/Darwin': ['AU', 'Northern Territory'], 'Pacific/Auckland': ['NZ'],
  'Africa/Johannesburg': ['ZA'], 'Africa/Lagos': ['NG'], 'Africa/Nairobi': ['KE'], 'Africa/Cairo': ['EG'],
  'Africa/Casablanca': ['MA'], 'Africa/Accra': ['GH'],
};

/* Languages with no region tag → the countries they point to. */
const LANGUAGE_COUNTRIES = {
  hi: ['IN'], mr: ['IN'], ta: ['IN', 'LK'], te: ['IN'], gu: ['IN'], kn: ['IN'], ml: ['IN'],
  pa: ['IN', 'PK'], ur: ['PK', 'IN'], bn: ['BD', 'IN'], ne: ['NP'], si: ['LK'],
  ja: ['JP'], ko: ['KR'], zh: ['CN', 'TW', 'HK', 'SG'], th: ['TH'], vi: ['VN'], id: ['ID'],
  ms: ['MY'], fil: ['PH'], tl: ['PH'],
  de: ['DE', 'AT', 'CH'], fr: ['FR', 'BE', 'CA', 'CH'], it: ['IT'], nl: ['NL', 'BE'],
  pl: ['PL'], cs: ['CZ'], sk: ['SK'], hu: ['HU'], ro: ['RO'], el: ['GR'], sv: ['SE'],
  nb: ['NO'], no: ['NO'], da: ['DK'], fi: ['FI'], pt: ['BR', 'PT'], es: ['ES', 'MX', 'AR', 'CO'],
  ru: ['RU'], uk: ['UA'], tr: ['TR'], he: ['IL'], ar: ['SA', 'EG', 'AE', 'MA'], fa: ['IR'], sw: ['KE'],
};

/* ---------------------------------------------------------
   Rough population shares used by the rarity estimate.
   p = probability a random web user shares your value.
   --------------------------------------------------------- */
const SHARE = {
  os: { Android: 0.45, Windows: 0.25, iOS: 0.18, macOS: 0.06, Linux: 0.015, ChromeOS: 0.01 },
  browser: { Chrome: 0.65, Safari: 0.18, Edge: 0.05, Firefox: 0.025, 'Samsung Internet': 0.025, Opera: 0.02 },
  screen: {
    '1920x1080': 0.09, '360x800': 0.06, '1536x864': 0.04, '412x915': 0.04, '390x844': 0.04,
    '393x852': 0.035, '1366x768': 0.03, '393x873': 0.03, '414x896': 0.025, '430x932': 0.02,
    '1440x900': 0.015, '375x812': 0.015, '1280x720': 0.01, '1280x800': 0.01, '1600x900': 0.01,
    '2560x1440': 0.01, '1470x956': 0.008, '1512x982': 0.005, '1728x1117': 0.003,
  },
  dpr: { 1: 0.3, 2: 0.25, 3: 0.2, 2.625: 0.06, 2.75: 0.04, 1.25: 0.08, 1.5: 0.05 },
  cores: { 8: 0.35, 4: 0.2, 6: 0.08, 12: 0.08, 16: 0.06, 10: 0.05, 2: 0.03, 20: 0.02 },
  memory: { 8: 0.45, 4: 0.2, 2: 0.05, 16: 0.05, 32: 0.02, 1: 0.01 },
  touch: { 0: 0.45, 5: 0.45, 10: 0.05 },
  // Share of web users by country (rough). The time zone factor uses this.
  country: {
    IN: 0.12, US: 0.1, CN: 0.08, BR: 0.04, ID: 0.04, JP: 0.025, RU: 0.025, DE: 0.02, GB: 0.02,
    MX: 0.02, FR: 0.015, PH: 0.015, VN: 0.015, TR: 0.015, NG: 0.015, PK: 0.015, BD: 0.012,
    IT: 0.012, ES: 0.012, KR: 0.012, EG: 0.01, CA: 0.01, TH: 0.01, AU: 0.006,
  },
  // Share of a country's users in each zone, where a country has several.
  zoneWithinCountry: {
    'America/New_York': 0.47, 'America/Chicago': 0.29, 'America/Denver': 0.05,
    'America/Phoenix': 0.02, 'America/Los_Angeles': 0.17, 'America/Toronto': 0.6,
    'America/Vancouver': 0.15, 'America/Sao_Paulo': 0.8, 'Australia/Sydney': 0.35,
    'Australia/Melbourne': 0.3, 'Europe/Moscow': 0.7, 'America/Mexico_City': 0.8,
  },
  // First-language share among web users (language only, region ignored).
  language: {
    en: 0.35, es: 0.08, zh: 0.08, pt: 0.05, ru: 0.04, ja: 0.03, de: 0.03, fr: 0.03,
    id: 0.03, ar: 0.03, hi: 0.02, ko: 0.015, tr: 0.015, it: 0.015, vi: 0.015, pl: 0.01, nl: 0.01,
  },
  // Most common region for a language; anything else is rarer.
  languageMainRegion: { en: 'US', es: 'ES', pt: 'BR', zh: 'CN', fr: 'FR', de: 'DE' },
  languageCount: { 1: 0.55, 2: 0.3, 3: 0.1 },
};
