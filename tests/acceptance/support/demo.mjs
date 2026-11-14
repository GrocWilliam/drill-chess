// HTTP reads of the public demo page and of the static engine files. No assertions of a criterion here.
import { visit } from './visitor.mjs';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Decodes HTML entities and collapses every kind of whitespace to one space. */
export function plainText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) =>
      e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTITIES[e.toLowerCase()] ?? m),
    )
    .replace(/[\s  ]+/g, ' ')
    .trim();
}

/** GET /games/demo as a signed-out visitor → { status, location, html, text } (text = plainText of the body). */
export async function openDemoPage(baseUrl, { lang } = {}) {
  const r = await visit(baseUrl, { path: '/games/demo', cookies: lang ? { lang } : {} });
  return { ...r, text: plainText(r.html) };
}

/** The plain text of every `<noscript>` block of a page. */
export function noscriptTexts(html) {
  return [...html.matchAll(/<noscript\b[^>]*>([\s\S]*?)<\/noscript>/gi)].map((m) => plainText(m[1]));
}

/** The plain text of the `<noscript>` blocks holding (or being) the `review-noscript` element. */
export function reviewNoscriptTexts(html) {
  return [...html.matchAll(/<noscript\b([^>]*)>([\s\S]*?)<\/noscript>/gi)]
    .filter((m) => /data-testid="review-noscript"/.test(m[1]) || /data-testid="review-noscript"/.test(m[2]))
    .map((m) => plainText(m[2]));
}

/** How many elements of the HTML carry data-testid=`id`. */
export function testIdCount(html, id) {
  return [...html.matchAll(new RegExp(`data-testid="${id}"`, 'g'))].length;
}

/** The links of the HTML with data-testid=`id` → [{ text, path }]. */
export function linksByTestId(html, id) {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
    .filter((m) => new RegExp(`data-testid="${id}"`).test(m[1]))
    .map((m) => {
      const href = /\bhref="([^"]*)"/.exec(m[1])?.[1] ?? '';
      return { text: plainText(m[2]), path: new URL(plainText(href) || '#', 'http://x').pathname };
    });
}

/** GET a static file → { status, contentType, size }. */
export async function fetchStatic(baseUrl, path) {
  const r = await fetch(baseUrl + path, { redirect: 'manual' });
  const body = await r.arrayBuffer();
  return { status: r.status, contentType: r.headers.get('content-type') ?? '', size: body.byteLength };
}
