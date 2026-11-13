// US-16 (browser): the list and a game's page at 375×812 and 1024×768.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { signedUpUser } from '../support/accounts.mjs';
import { gameRow, rowVisibility } from '../support/games.mjs';
import { waitForImportEnd } from '../support/imports.mjs';
import { linkAccount, startAppWithFakeSites } from '../support/links.mjs';
import { VIEWPORTS, horizontalScroll, launchBrowser, newVisitorPage, undersizedTargets } from '../support/pages.mjs';

let env, browser, user;
before(async () => {
  env = await startAppWithFakeSites();
  browser = await launchBrowser();
  user = await signedUpUser(env.app.url);
  await linkAccount(env.app.url, user.token, { site: 'chesscom', username: 'alpha_pawn' });
  const job = await waitForImportEnd(env.app.url, user.token, 'chesscom', 20000);
  assert.equal(job?.status, 'done', 'setup: the import did not finish');
});
after(async () => {
  await browser?.close();
  await env?.stop();
});

const open = (viewport) =>
  newVisitorPage(browser, { baseUrl: env.app.url, acceptLanguage: 'en-US', session: user.token, viewport });

for (const [name, viewport] of [['375×812', VIEWPORTS.mobile], ['1024×768', VIEWPORTS.desktop]]) {
  describe(`the games list at ${name}`, () => {
    test('every row is visible, no sideways scroll, targets of at least 44×44', async () => {
      const p = await open(viewport);
      await p.goto(env.app.url + '/games');
      await p.getByTestId('games-list').waitFor({ state: 'visible' });
      const v = await rowVisibility(p);
      assert.equal(v.count, 7);
      assert.equal(v.visible, 7);
      const s = await horizontalScroll(p);
      assert.ok(s.scrollWidth <= s.innerWidth + 1, JSON.stringify(s));
      assert.deepEqual(await undersizedTargets(p), []);
      await p.context().close();
    });

    test('clicking a row opens its /games/<id> page', async () => {
      const p = await open(viewport);
      await p.goto(env.app.url + '/games');
      const row = p.locator('[data-testid="games-row"]').first();
      const id = await row.getAttribute('data-game-id');
      await gameRow(p, id).click();
      await p.waitForURL((u) => u.pathname === `/games/${id}`);
      await p.getByTestId('game-details').waitFor({ state: 'visible' });
      await p.context().close();
    });
  });
}

describe('a game page at 375×812', () => {
  test('has no sideways scroll', async () => {
    const p = await open(VIEWPORTS.mobile);
    await p.goto(env.app.url + '/games');
    const id = await p.locator('[data-testid="games-row"]').first().getAttribute('data-game-id');
    await p.goto(`${env.app.url}/games/${id}`);
    await p.getByTestId('game-details').waitFor({ state: 'visible' });
    const s = await horizontalScroll(p);
    assert.ok(s.scrollWidth <= s.innerWidth + 1, JSON.stringify(s));
    await p.context().close();
  });
});
