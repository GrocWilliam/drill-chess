// HTTP-level domain layer for a (signed-out) visitor. No assertions of a criterion here.

/** GET `path` as a visitor with optional Accept-Language and cookies → { status, location, html }. */
export async function visit(baseUrl, { path = '/', acceptLanguage, cookies = {} } = {}) {
  const headers = {};
  if (acceptLanguage !== undefined) headers['Accept-Language'] = acceptLanguage;
  const cookie = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  if (cookie) headers.Cookie = cookie;
  const r = await fetch(baseUrl + path, { headers, redirect: 'manual' });
  return { status: r.status, location: r.headers.get('location'), html: await r.text() };
}

/** The opening `<html ...>` tag of a page. */
export function htmlTag(html) {
  return /<html\b[^>]*>/i.exec(html)?.[0] ?? '';
}

/** The `lang` attribute of `<html>`, or null. */
export function pageLang(html) {
  return /\blang="([^"]*)"/.exec(htmlTag(html))?.[1] ?? null;
}

/** The `data-theme` attribute of `<html>`, or null when absent. */
export function pageTheme(html) {
  return /\bdata-theme="([^"]*)"/.exec(htmlTag(html))?.[1] ?? null;
}

/** Flattened keys (dot paths) of a messages object. */
export function messageKeys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? messageKeys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}
