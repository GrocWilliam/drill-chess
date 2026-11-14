// US-51 (browser): the games-analysed badge in its row of /games at 375×812 and 1024×768.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { signedUpUser } from '../support/accounts.mjs';
import { gameRow } from '../support/games.mjs';
import { startAppWithFakeSites } from '../support/links.mjs';
import { VIEWPORTS, horizontalScroll, launchBrowser, newVisitorPage } from '../support/pages.mjs';
import { WHITE_GAME, dropBodyOf, gameIdByNumber, importAlphaPawn, postAnalysis } from '../support/review.mjs';

let env, browser, user, analysedId;
before(async () => {
  env = await startAppWithFakeSites();
  browser = await launchBrowser();
  user = await signedUpUser(env.app.url);
  await importAlphaPawn(env.app.url, user);
  analysedId = await gameIdByNumber(env.app.url, user.token, WHITE_GAME);
  const posted = await postAnalysis(env.app.url, user.token, analysedId, dropBodyOf(WHITE_GAME, -300));
  assert.equal(posted.status, 201, JSON.stringify(posted.body));
});
after(async () => {
  await browser?.close();
  await env?.stop();
});

async function badgeOfRow(viewport) {
  const page = await newVisitorPage(browser, {
    baseUrl: env.app.url, acceptLanguage: 'en-US', session: user.token, viewport,
  });
  try {
    await page.goto(env.app.url + '/games');
    const badge = gameRow(page, analysedId).getByTestId('games-analysed');
    await badge.waitFor({ state: 'visible' });
    return {
      visible: await badge.isVisible(),
      scroll: await horizontalScroll(page),
    };
  } finally {
    await page.context().close();
  }
}

describe('the badge in its row', () => {
  test('given U with one analysed game at 375×812, when /games is shown, then the badge is visible in that game\'s row and there is no sideways scroll', async () => {
    const { visible, scroll } = await badgeOfRow(VIEWPORTS.mobile);
    assert.equal(visible, true);
    assert.ok(scroll.scrollWidth <= scroll.innerWidth + 1, JSON.stringify(scroll));
  });

  test('given U with one analysed game at 1024×768, when /games is shown, then the badge is visible in that game\'s row and there is no sideways scroll', async () => {
    const { visible, scroll } = await badgeOfRow(VIEWPORTS.desktop);
    assert.equal(visible, true);
    assert.ok(scroll.scrollWidth <= scroll.innerWidth + 1, JSON.stringify(scroll));
  });
});
