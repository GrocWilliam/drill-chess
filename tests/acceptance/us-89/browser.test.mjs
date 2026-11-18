// US-89 (browser): the Openings link in the navigation and the layout of /openings at 375×812 and 1024×768.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { signedUpUser } from '../support/accounts.mjs';
import { startServer } from '../support/server.mjs';
import { addLine } from '../support/repertoire.mjs';
import { VIEWPORTS, horizontalScroll, launchBrowser, newVisitorPage, undersizedTargets } from '../support/pages.mjs';
import { visibleNavIds, navLink } from '../support/stats-page.mjs';
import { homePage, openHome } from '../support/openings-home.mjs';

let app, url, browser;
before(async () => { app = await startServer(); url = app.url; browser = await launchBrowser(); });
after(async () => { await browser?.close(); await app?.stop(); });

const open = async (user, viewport, path) => {
  const page = await homePage(browser, url, user, { viewport });
  await page.goto(url + path, { waitUntil: 'networkidle' });
  return page;
};

describe('navigation', () => {
  for (const [name, viewport, container] of [['375×812', VIEWPORTS.mobile, 'nav-tabs'], ['1024×768', VIEWPORTS.desktop, 'banner']]) {
    test(`at ${name}, Openings comes right after Stats in the ${container === 'nav-tabs' ? 'bottom tab bar' : 'top bar'}, is at least 44px, and is the current page only on /openings`, async () => {
      const user = await signedUpUser(url);
      for (const path of ['/openings', '/games', '/stats']) {
        const page = await open(user, viewport, path);
        try {
          await page.getByTestId('nav-stats').first().waitFor({ state: 'attached' });
          const ids = await visibleNavIds(page, container);
          assert.ok(ids.includes('nav-stats') && ids.includes('nav-openings'), `${path}: ${ids}`);
          assert.equal(ids.indexOf('nav-openings'), ids.indexOf('nav-stats') + 1, `${path}: ${ids}`);
          const box = await navLink(page, container, 'nav-openings').boundingBox();
          assert.ok(box.height >= 43 && box.width >= 43, JSON.stringify(box));
          const current = await navLink(page, container, 'nav-openings').getAttribute('aria-current');
          if (path === '/openings') assert.equal(current, 'page');
          else assert.notEqual(current, 'page', path);
        } finally {
          await page.context().close();
        }
      }
    });
  }
});

describe('layout of /openings', () => {
  for (const [name, viewport] of [['375×812', VIEWPORTS.mobile], ['1024×768', VIEWPORTS.desktop]]) {
    test(`at ${name}: no sideways scroll and every button and link is at least 44px`, async () => {
      const user = await signedUpUser(url);
      await addLine(url, user.token, 'white', ['e2e4', 'e7e5', 'g1f3']);
      const page = await homePage(browser, url, user, { viewport });
      try {
        await openHome(page, url);
        const s = await horizontalScroll(page);
        assert.ok(s.scrollWidth <= s.innerWidth, JSON.stringify(s));
        const small = await undersizedTargets(page);
        assert.deepEqual(small, [], 'targets smaller than 44px');
      } finally {
        await page.context().close();
      }
    });
  }
});
