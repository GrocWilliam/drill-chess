// US-23 (browser): games-next and games-prev at 375×812.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { startAppWithFakeSites } from '../support/links.mjs';
import { VIEWPORTS, horizontalScroll, launchBrowser, newVisitorPage } from '../support/pages.mjs';
import { firstRowGameId, pagingBoxes, pressNext, pressPrev, rowsCount, userWithManyGames } from '../support/paging.mjs';

let env, browser, user;
before(async () => {
  env = await startAppWithFakeSites();
  browser = await launchBrowser();
  ({ user } = await userWithManyGames(env));
});
after(async () => {
  await browser?.close();
  await env?.stop();
});

describe('paging at 375×812', () => {
  test('pressing games-next then games-prev shows page 2 then page 1, with no sideways scroll and buttons of at least 44×44', async () => {
    const p = await newVisitorPage(browser, { baseUrl: env.app.url, acceptLanguage: 'en-US', session: user.token, viewport: VIEWPORTS.mobile });
    await p.goto(env.app.url + '/games');
    await p.getByTestId('games-next').waitFor({ state: 'visible' });
    const first = await firstRowGameId(p);
    assert.equal(await rowsCount(p), 50);
    let s = await horizontalScroll(p);
    assert.ok(s.scrollWidth <= s.innerWidth + 1, JSON.stringify(s));
    const boxes1 = await pagingBoxes(p);
    assert.equal(boxes1.length, 1);

    await pressNext(p);
    await p.getByTestId('games-prev').waitFor({ state: 'visible' });
    const second = await firstRowGameId(p);
    assert.notEqual(second, first);
    assert.equal(await rowsCount(p), 50);
    s = await horizontalScroll(p);
    assert.ok(s.scrollWidth <= s.innerWidth + 1, JSON.stringify(s));
    const boxes2 = await pagingBoxes(p);
    assert.equal(boxes2.length, 2);
    for (const b of [...boxes1, ...boxes2]) assert.ok(b.width >= 43 && b.height >= 43, JSON.stringify(b));

    await pressPrev(p);
    await p.waitForFunction((id) => document.querySelector('[data-testid="games-row"]')?.getAttribute('data-game-id') === id, first);
    assert.equal(await rowsCount(p), 50);
    assert.equal((await pagingBoxes(p)).length, 1);
    await p.context().close();
  });
});
