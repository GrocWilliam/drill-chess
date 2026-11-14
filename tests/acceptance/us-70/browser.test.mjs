// US-70 (browser): navigation to Stats, layout of /stats at 375×812 and 1024×768, the filters without JavaScript.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { fixtureGames, userWithBothSites } from '../support/filters.mjs';
import { startAppWithFakeSites } from '../support/links.mjs';
import { VIEWPORTS, horizontalScroll, launchBrowser, newVisitorPage, undersizedTargets } from '../support/pages.mjs';
import { colourRows, figuresOf, navLink, pickStatsFilter, pressStatsFilter, resultBars, visibleNavIds } from '../support/stats-page.mjs';

let env, browser, user;
before(async () => {
  env = await startAppWithFakeSites();
  browser = await launchBrowser();
  user = await userWithBothSites(env);
});
after(async () => {
  await browser?.close();
  await env?.stop();
});

const open = (viewport, path, extra = {}) =>
  newVisitorPage(browser, { baseUrl: env.app.url, acceptLanguage: 'en-US', session: user.token, viewport, ...extra })
    .then(async (page) => { await page.goto(env.app.url + path); return page; });

describe('navigation', () => {
  for (const [name, viewport, container] of [['375×812', VIEWPORTS.mobile, 'nav-tabs'], ['1024×768', VIEWPORTS.desktop, 'banner']]) {
    test(`at ${name}, Stats comes right after Games in the ${container === 'nav-tabs' ? 'bottom tab bar' : 'top bar'}, on /games and /stats`, async () => {
      for (const path of ['/games', '/stats']) {
        const page = await open(viewport, path);
        try {
          const ids = await visibleNavIds(page, container);
          assert.equal(ids.indexOf('nav-stats'), ids.indexOf('nav-games') + 1, `${path}: ${ids}`);
          assert.ok(ids.includes('nav-games'));
          const box = await navLink(page, container, 'nav-stats').boundingBox();
          assert.ok(box.height >= 43 && box.width >= 43, JSON.stringify(box));
          const current = await navLink(page, container, 'nav-stats').getAttribute('aria-current');
          if (path === '/stats') assert.equal(current, 'page');
          else assert.notEqual(current, 'page');
        } finally {
          await page.context().close();
        }
      }
    });
  }
});

describe('layout of /stats', () => {
  for (const [name, viewport] of [['375×812', VIEWPORTS.mobile], ['1024×768', VIEWPORTS.desktop]]) {
    test(`at ${name}: no sideways scroll, result bars show their counts as text, every link and button is at least 44px high`, async () => {
      const page = await open(viewport, '/stats');
      try {
        await page.getByTestId('stats-colour').waitFor({ state: 'visible' });
        const s = await horizontalScroll(page);
        assert.ok(s.scrollWidth <= s.innerWidth, JSON.stringify(s));
        const bars = await resultBars(page);
        assert.ok(bars.length > 0, 'no result bar');
        for (const t of bars) assert.match(t, /\d/, `result bar without counts: "${t}"`);
        const small = await page.evaluate(() => [...document.querySelectorAll('a[href], button, [role="button"]')]
          .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; })
          .filter((el) => el.getBoundingClientRect().height < 43)
          .map((el) => (el.textContent || el.getAttribute('aria-label') || el.tagName).trim()));
        assert.deepEqual(small, []);
        assert.deepEqual((await undersizedTargets(page)).filter((t) => t.height < 43), []);
      } finally {
        await page.context().close();
      }
    });
  }
});

describe('filters without JavaScript', () => {
  test('given JavaScript disabled, picking site Lichess and submitting puts site=lichess in the URL and the counts change to the Lichess games', async () => {
    const page = await open(VIEWPORTS.desktop, '/stats', { javaScriptEnabled: false });
    try {
      await pickStatsFilter(page, 'site', 'lichess');
      await Promise.all([page.waitForURL(/site=lichess/), pressStatsFilter(page)]);
      assert.equal(new URL(page.url()).searchParams.get('site'), 'lichess');
      const rows = colourRows(await page.content());
      const lichess = fixtureGames().filter((g) => g.site === 'lichess');
      assert.ok(rows.length > 0);
      for (const row of rows) {
        assert.equal(row.games, lichess.filter((g) => g.colour === row.colour).length, row.colour);
      }
      assert.equal(rows.reduce((n, r) => n + r.games, 0), lichess.length);
    } finally {
      await page.context().close();
    }
  });
});
