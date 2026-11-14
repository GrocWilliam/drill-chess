// US-73 (browser): the mistakes block of /stats at 375×812 and 1024×768.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { signedUpUser } from '../support/accounts.mjs';
import { startAppWithFakeSites } from '../support/links.mjs';
import { VIEWPORTS, horizontalScroll, launchBrowser, newVisitorPage } from '../support/pages.mjs';
import { importAlphaPawn, saveTwoAnalyses } from '../support/review.mjs';
import { requestStats } from '../support/stats.mjs';
import { mistakesBlockText, oneDecimal, visibleMistakeRows } from '../support/stats-page.mjs';

let env, browser, user, api;
before(async () => {
  env = await startAppWithFakeSites();
  browser = await launchBrowser();
  user = await signedUpUser(env.app.url);
  await importAlphaPawn(env.app.url, user);
  await saveTwoAnalyses(env.app.url, user);
  api = (await requestStats(env.app.url, user.token)).body.mistakes;
});
after(async () => {
  await browser?.close();
  await env?.stop();
});

for (const [name, viewport] of [['375×812', VIEWPORTS.mobile], ['1024×768', VIEWPORTS.desktop]]) {
  test(`at ${name}: the three phase rows and values are visible, each mark column shows its symbol, no sideways scroll`, async () => {
    const page = await newVisitorPage(browser, { baseUrl: env.app.url, acceptLanguage: 'en-US', session: user.token, viewport });
    try {
      await page.goto(env.app.url + '/stats');
      await page.getByTestId('stats-mistakes').waitFor({ state: 'visible' });
      await page.getByTestId('stats-mistakes').scrollIntoViewIfNeeded();
      const rows = await visibleMistakeRows(page);
      assert.deepEqual(rows.map((r) => r.phase).sort(), ['endgame', 'middlegame', 'opening']);
      for (const row of rows) {
        const p = api.byPhase[row.phase];
        for (const v of [p.inaccuracy, p.mistake, p.blunder]) assert.ok(row.text.includes(oneDecimal(v)), `${row.phase}: "${row.text}" lacks ${oneDecimal(v)}`);
      }
      const text = await mistakesBlockText(page);
      for (const symbol of ['?!', '??']) assert.ok(text.includes(symbol), `no ${symbol} in "${text}"`);
      assert.match(text, /(^|[^?])\?($|[^?!])/, 'no single ? mark');
      const s = await horizontalScroll(page);
      assert.ok(s.scrollWidth <= s.innerWidth, JSON.stringify(s));
    } finally {
      await page.context().close();
    }
  });
}
