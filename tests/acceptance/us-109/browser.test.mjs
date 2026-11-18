// US-109 (browser): card click, the Endgames nav link, layout of /endgames.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { signedUpUser } from '../support/accounts.mjs';
import { startServer } from '../support/server.mjs';
import { VIEWPORTS, horizontalScroll, launchBrowser, undersizedTargets } from '../support/pages.mjs';
import { navLink, visibleNavIds } from '../support/stats-page.mjs';
import { clickCard, endgamesPage, openEndgames } from '../support/endgames-page.mjs';

let app, url, browser;
before(async () => { app = await startServer(); url = app.url; browser = await launchBrowser(); });
after(async () => { await browser?.close(); await app?.stop(); });

test('clicking a card goes to /endgames/<its id>', async () => {
  const user = await signedUpUser(url);
  const page = await endgamesPage(browser, url, user, { viewport: VIEWPORTS.desktop });
  try {
    await openEndgames(page, url);
    await clickCard(page, 'philidor');
    await page.waitForURL((u) => u.pathname === '/endgames/philidor');
  } finally {
    await page.context().close();
  }
});

describe('navigation', () => {
  for (const [name, viewport, container] of [['375×812', VIEWPORTS.mobile, 'nav-tabs'], ['1440×900', { width: 1440, height: 900 }, 'banner']]) {
    test(`at ${name}, Endgames comes right after Openings, leads to /endgames and is current there`, async () => {
      const user = await signedUpUser(url);
      for (const path of ['/games', '/endgames']) {
        const page = await endgamesPage(browser, url, user, { viewport });
        try {
          await page.goto(url + path, { waitUntil: 'networkidle' });
          await navLink(page, container, 'nav-endgames').waitFor({ state: 'visible' });
          const ids = await visibleNavIds(page, container);
          assert.equal(ids.indexOf('nav-endgames'), ids.indexOf('nav-openings') + 1, `${path}: ${ids}`);
          assert.ok(ids.includes('nav-openings'));
          const current = await navLink(page, container, 'nav-endgames').getAttribute('aria-current');
          if (path === '/endgames') assert.equal(current, 'page');
          else {
            assert.notEqual(current, 'page');
            await navLink(page, container, 'nav-endgames').click();
            await page.waitForURL((u) => u.pathname === '/endgames');
            assert.equal(await navLink(page, container, 'nav-endgames').getAttribute('aria-current'), 'page');
          }
        } finally {
          await page.context().close();
        }
      }
    });
  }
});

describe('layout of /endgames', () => {
  for (const [name, viewport, strictTargets] of [['375×812', VIEWPORTS.mobile, true], ['1024×768', VIEWPORTS.desktop, false]]) {
    test(`at ${name}: no sideways scroll${strictTargets ? ' and every link and button is at least 44px high' : ''}`, async () => {
      const user = await signedUpUser(url);
      const page = await endgamesPage(browser, url, user, { viewport });
      try {
        await openEndgames(page, url);
        const s = await horizontalScroll(page);
        assert.ok(s.scrollWidth <= s.innerWidth, JSON.stringify(s));
        if (strictTargets) {
          const small = (await undersizedTargets(page)).filter((t) => t.height < 43);
          assert.deepEqual(small, [], 'targets lower than 44px');
        }
      } finally {
        await page.context().close();
      }
    });
  }
});
