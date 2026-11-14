// US-72 (browser): the series picker without JavaScript, the rating chart at 375×812 and 1024×768.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { startAppWithFakeSites } from '../support/links.mjs';
import { VIEWPORTS, horizontalScroll, launchBrowser, newVisitorPage } from '../support/pages.mjs';
import { EN, chartBox, chartVisible, pickSeries, pressFilters, ratingSummary, seriesPicker, userWithFourGames, userWithTwoSeries } from '../support/rating-page.mjs';

let env, browser, two, four;
before(async () => {
  env = await startAppWithFakeSites();
  browser = await launchBrowser();
  two = await userWithTwoSeries(env);
  four = await userWithFourGames(env);
});
after(async () => {
  await browser?.close();
  await env?.stop();
});

const open = async (user, viewport, extra = {}) => {
  const page = await newVisitorPage(browser, { baseUrl: env.app.url, acceptLanguage: 'en-US', session: user.token, viewport, ...extra });
  await page.goto(`${env.app.url}/stats`);
  return page;
};

describe('series picker without JavaScript', () => {
  test('given JavaScript disabled, picking Lichess rapid and submitting puts series=lichess-rapid in the URL and shows that series', async () => {
    const page = await open(two, VIEWPORTS.desktop, { javaScriptEnabled: false });
    try {
      await pickSeries(page, 'lichess-rapid');
      await Promise.all([page.waitForURL(/series=lichess-rapid/), pressFilters(page)]);
      assert.equal(new URL(page.url()).searchParams.get('series'), 'lichess-rapid');
      const html = await page.content();
      assert.equal(seriesPicker(html).selected, 'lichess-rapid');
      assert.deepEqual(ratingSummary(html, EN), { first: 1600, last: 1625, highest: 1625, lowest: 1600 });
      assert.ok(await chartVisible(page));
    } finally {
      await page.context().close();
    }
  });
});

describe('layout of the rating chart', () => {
  for (const [name, viewport] of [['375×812', VIEWPORTS.mobile], ['1024×768', VIEWPORTS.desktop]]) {
    test(`at ${name}, the chart of a 4-game series is visible, fits the viewport width and the page has no sideways scroll`, async () => {
      const page = await open(four, viewport);
      try {
        await page.getByTestId('stats-rating-chart').waitFor({ state: 'visible' });
        const box = await chartBox(page);
        assert.ok(box.width > 50 && box.height > 20, JSON.stringify(box));
        assert.ok(box.x >= -1 && box.x + box.width <= viewport.width + 1, JSON.stringify(box));
        const s = await horizontalScroll(page);
        assert.ok(s.scrollWidth <= s.innerWidth, JSON.stringify(s));
      } finally {
        await page.context().close();
      }
    });
  }
});
