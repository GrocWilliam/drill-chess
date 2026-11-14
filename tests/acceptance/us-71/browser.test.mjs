// US-71 (browser): the openings toggle without JavaScript, and the layout of the block with long names.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { fixtureGames, userWithBothSites } from '../support/filters.mjs';
import { startAppWithFakeSites } from '../support/links.mjs';
import { VIEWPORTS, horizontalScroll, launchBrowser, newVisitorPage } from '../support/pages.mjs';
import { openingRows, pickOpeningsColour, pressStatsFilter, userWithManyOpenings } from '../support/stats-page.mjs';

let env, browser, both, owl;
before(async () => {
  env = await startAppWithFakeSites();
  browser = await launchBrowser();
  both = await userWithBothSites(env);
  owl = await userWithManyOpenings(env);
});
after(async () => {
  await browser?.close();
  await env?.stop();
});

const open = async (user, viewport, path, extra = {}) => {
  const page = await newVisitorPage(browser, { baseUrl: env.app.url, acceptLanguage: 'en-US', session: user.token, viewport, ...extra });
  await page.goto(env.app.url + path);
  return page;
};

describe('openings toggle without JavaScript', () => {
  test('given JavaScript disabled on /stats?site=lichess, picking Black and submitting keeps site=lichess, adds openingsColour=black and shows only the games played as Black', async () => {
    const page = await open(both, VIEWPORTS.desktop, '/stats?site=lichess', { javaScriptEnabled: false });
    try {
      const before = openingRows(await page.content());
      assert.ok(before.some((r) => r.eco === 'B01'), 'setup: the Lichess white game has opening B01');
      await pickOpeningsColour(page, 'black');
      await Promise.all([page.waitForURL(/openingsColour=black/), pressStatsFilter(page)]);
      const params = new URL(page.url()).searchParams;
      assert.equal(params.get('openingsColour'), 'black');
      assert.equal(params.get('site'), 'lichess');
      const rows = openingRows(await page.content());
      const blackGames = fixtureGames().filter((g) => g.site === 'lichess' && g.colour === 'black').length;
      assert.equal(rows.reduce((n, r) => n + r.games, 0), blackGames);
      assert.ok(!rows.some((r) => r.eco === 'B01'), 'the white game opening is gone');
    } finally {
      await page.context().close();
    }
  });
});

describe('layout of the openings block', () => {
  for (const [name, viewport] of [['375×812', VIEWPORTS.mobile], ['1024×768', VIEWPORTS.desktop]]) {
    test(`given 10 openings with long names, at ${name} the page has no sideways scroll`, async () => {
      const page = await open(owl, viewport, '/stats');
      try {
        await page.getByTestId('stats-openings').waitFor({ state: 'visible' });
        assert.equal(await page.locator('[data-testid="stats-opening-row"]').count(), 10);
        const s = await horizontalScroll(page);
        assert.ok(s.scrollWidth <= s.innerWidth, JSON.stringify(s));
        const box = await page.getByTestId('stats-openings').boundingBox();
        assert.ok(box.x + box.width <= s.innerWidth + 1, JSON.stringify(box));
      } finally {
        await page.context().close();
      }
    });
  }
});
