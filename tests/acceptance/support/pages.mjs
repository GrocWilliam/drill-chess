// Browser domain layer: Chromium through playwright-core, viewports, landing page reads, layout checks.
// No assertions of a criterion here: helpers return values, tests compare them.
import { createRequire } from 'node:module';

export const VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  desktop: { width: 1024, height: 768 },
};

export async function launchBrowser() {
  const { chromium } = createRequire(process.env.PLAYWRIGHT_DIR + '/')('playwright-core');
  return chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    args: ['--no-sandbox'],
  });
}

/**
 * A fresh page in its own context: cookies (lang, theme), Accept-Language, viewport.
 * opts: { baseUrl, lang, theme, viewport, acceptLanguage, javaScriptEnabled (default true), session (cookie token) }
 */
export async function newVisitorPage(browser, opts) {
  const url = new URL(opts.baseUrl);
  const context = await browser.newContext({
    viewport: opts.viewport ?? VIEWPORTS.desktop,
    locale: opts.acceptLanguage ?? 'en-US',
    extraHTTPHeaders: opts.acceptLanguage ? { 'Accept-Language': opts.acceptLanguage } : undefined,
    javaScriptEnabled: opts.javaScriptEnabled ?? true,
  });
  const cookies = [];
  if (opts.lang) cookies.push({ name: 'lang', value: opts.lang, domain: url.hostname, path: '/' });
  if (opts.theme) cookies.push({ name: 'theme', value: opts.theme, domain: url.hostname, path: '/' });
  if (opts.session) cookies.push({ name: 'session', value: opts.session, domain: url.hostname, path: '/', httpOnly: true });
  if (cookies.length) await context.addCookies(cookies);
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.setDefaultNavigationTimeout(10000);
  return page;
}

/** Records every request URL of the page. Returns the live array. */
export function recordRequests(page) {
  const urls = [];
  page.on('request', (r) => urls.push(r.url()));
  return urls;
}

export async function openLanding(page, baseUrl) {
  await page.goto(baseUrl + '/', { waitUntil: 'networkidle' });
}

/** The computed background colour of the page (body, else html when the body is transparent). */
export async function pageBackground(page) {
  return page.evaluate(() => {
    const clear = (c) => c === 'rgba(0, 0, 0, 0)' || c === 'transparent';
    const b = getComputedStyle(document.body).backgroundColor;
    return clear(b) ? getComputedStyle(document.documentElement).backgroundColor : b;
  });
}

/** Text of the top bar (the page's banner landmark). */
export async function topBarText(page) {
  return page.getByRole('banner').first().innerText();
}
export const loginLink = (page) => page.getByTestId('nav-login');
export const signupLink = (page) => page.getByTestId('nav-signup');

export async function linkInfo(locator) {
  return {
    text: (await locator.innerText()).trim(),
    path: new URL(await locator.getAttribute('href'), 'http://x').pathname,
  };
}

/** How many headings read exactly `title` (a feature card shows its title as a heading). */
export async function featureTitleCount(page, title) {
  return page.getByRole('heading', { name: title, exact: true }).count();
}

export async function pageLinks(page) {
  return page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')));
}

/** Sideways overflow: { scrollWidth, innerWidth }. */
export async function horizontalScroll(page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
}

/** Visible links and buttons smaller than 44×44 (1px tolerance): [{ label, width, height }]. */
export async function undersizedTargets(page) {
  return page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('a[href], button, [role="button"]')) {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || s.visibility === 'hidden' || s.display === 'none') continue;
      if (r.width < 43 || r.height < 43) {
        out.push({ label: (el.textContent || el.getAttribute('aria-label') || el.tagName).trim(), width: r.width, height: r.height });
      }
    }
    return out;
  });
}
