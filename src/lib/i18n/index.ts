import en from './en.json';
import fr from './fr.json';

export const LANGS = ['en', 'fr'] as const;
export type Lang = (typeof LANGS)[number];
export type Messages = Record<string, string>;

const catalogs: Record<Lang, Messages> = { en, fr };

export const isLang = (v: unknown): v is Lang => v === 'en' || v === 'fr';

/** Messages of a language. */
export const messagesFor = (lang: Lang): Messages => catalogs[lang];

/** `fr` when the first language of Accept-Language starts with `fr`, else `en`; a valid `lang` cookie wins. */
export function pickLang(acceptLanguage: string | null | undefined, cookie?: string | null): Lang {
  if (isLang(cookie)) return cookie;
  const first = (acceptLanguage ?? '').split(',')[0]?.trim().toLowerCase() ?? '';
  return first.startsWith('fr') ? 'fr' : 'en';
}

/** The `theme` cookie `light` or `dark`; anything else → null (follow the system). */
export function pickTheme(cookie: string | null | undefined): 'light' | 'dark' | null {
  return cookie === 'light' || cookie === 'dark' ? cookie : null;
}

/** A number with one decimal in the language: `87.3` (en), `87,3` (fr). */
export const formatOneDecimal = (n: number, lang: Lang): string =>
  new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);

/** Looks a key up, replacing `{name}` placeholders; a missing key returns the key itself. */
export function translate(messages: Messages, key: string, params: Record<string, string | number> = {}): string {
  const text = messages[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (m, n: string) => (n in params ? String(params[n]) : m));
}

/** `translate` with the plural form (`<key>_one` / `<key>_other`, CLDR rules of `lang`) chosen by `params.n`. */
export function translatePlural(messages: Messages, lang: Lang, key: string, n: number, params: Record<string, string | number> = {}): string {
  const form = new Intl.PluralRules(lang).select(n) === 'one' ? 'one' : 'other';
  return translate(messages, `${key}_${form}`, { ...params, n });
}
