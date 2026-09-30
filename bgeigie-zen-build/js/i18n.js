// Locale loading, detection and lookup. Every locale is a JSON file in
// ../locales/ with identical keys (enforced by scripts/check_i18n.py); no
// language is built into the code or markup.

export const LOCALES = ['en', 'ja'];
const STORAGE_KEY = 'bgeigie-zen-build:lang';
const dictionaries = {};
const listeners = new Set();
let current = null;

export async function loadLocales() {
  await Promise.all(LOCALES.map(async (code) => {
    const response = await fetch(`locales/${code}.json`, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`locales/${code}.json: ${response.status}`);
    dictionaries[code] = await response.json();
  }));
}

// An explicit ?lang= or a previously chosen language wins; otherwise take the
// first browser preference we have a locale for. LOCALES[0] is only used when
// the browser lists none of them.
export function detectLocale() {
  const candidates = [
    new URLSearchParams(location.search).get('lang'),
    localStorage.getItem(STORAGE_KEY),
    ...(navigator.languages?.length ? navigator.languages : [navigator.language]),
  ];
  for (const tag of candidates) {
    const primary = tag?.toLowerCase().split('-')[0];
    if (LOCALES.includes(primary)) return primary;
  }
  return LOCALES[0];
}

export function setLocale(code, { remember = false } = {}) {
  if (!dictionaries[code]) throw new Error(`Unknown locale ${code}`);
  current = code;
  if (remember) localStorage.setItem(STORAGE_KEY, code);
  document.documentElement.lang = dictionaries[code].meta.lang;
  applyStatic();
  for (const listener of listeners) listener(code);
}

export const locale = () => current;
export const localeMeta = (code) => dictionaries[code].meta;
export const onLocaleChange = (listener) => listeners.add(listener);

// Raw value (string, array or object) at a dotted key in the current locale.
export function lookup(key) {
  let node = dictionaries[current];
  for (const part of key.split('.')) node = node?.[part];
  if (node === undefined) console.warn(`[i18n] ${current}: missing ${key}`);
  return node;
}

export function t(key, vars = {}) {
  const value = lookup(key);
  if (typeof value !== 'string') return key;
  return value.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? vars[name] : match));
}

// Fill markup that declares its text by key: data-i18n (text content),
// data-i18n-aria (aria-label), data-i18n-title (title), data-i18n-content (content).
export function applyStatic(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
  for (const el of root.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
  for (const el of root.querySelectorAll('[data-i18n-content]')) el.setAttribute('content', t(el.dataset.i18nContent));
}
