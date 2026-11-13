// US-22 (browser): the filters without JavaScript at 375×812, and their layout.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { fixtureGames, filterControlBoxes, pickFilter, pressFilter, pressReset, rowCount, userWithBothSites } from '../support/filters.mjs';
import { rowVisibility } from '../support/games.mjs';
import { startAppWithFakeSites } from '../support/links.mjs';
import { VIEWPORTS, horizontalScroll, launchBrowser, newVisitorPage } from '../support/pages.mjs';

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

const open = (viewport, javaScriptEnabled = true) =>
  newVisitorPage(browser, { baseUrl: env.app.url, acceptLanguage: 'en-US', session: user.token, viewport, javaScriptEnabled });

describe('with JavaScript disabled at 375×812', () => {
  test('picking Black and pressing games-filter-submit puts colour=black in the URL and lists only Black games; games-filter-reset goes back to /games with 13 games', async () => {
    const p = await open(VIEWPORTS.mobile, false);
    await p.goto(env.app.url + '/games');
    await p.getByTestId('games-filters').waitFor({ state: 'visible' });
    await pickFilter(p, 'colour', 'black');
    await pressFilter(p);
    await p.waitForURL((u) => u.pathname === '/games' && u.searchParams.get('colour') === 'black');
    const black = fixtureGames().filter((g) => g.colour === 'black').length;
    assert.ok(black > 0 && black < 13);
    assert.equal((await rowVisibility(p)).count, black);
    const rows = p.locator('[data-testid="games-row"]');
    for (let i = 0; i < black; i++) assert.ok(((await rows.nth(i).innerText()).split(/\s+/)).includes('Black'));
    await pressReset(p);
    await p.waitForURL((u) => u.pathname === '/games' && u.searchParams.get('colour') === null);
    assert.equal((await rowVisibility(p)).count, 13);
    await p.context().close();
  });
});

describe('the layout of games-filters', () => {
  test('at 1024×768 the filters fit on at most two rows', async () => {
    const p = await open(VIEWPORTS.desktop);
    await p.goto(env.app.url + '/games');
    await p.getByTestId('games-filters').waitFor({ state: 'visible' });
    const boxes = await filterControlBoxes(p);
    assert.ok(boxes.length >= 7, `controls found: ${boxes.length}`);
    assert.ok(rowCount(boxes) <= 2, JSON.stringify(boxes));
    await p.context().close();
  });

  test('at 375×812 there is no sideways scroll and every control is at least 44×44', async () => {
    const p = await open(VIEWPORTS.mobile);
    await p.goto(env.app.url + '/games');
    await p.getByTestId('games-filters').waitFor({ state: 'visible' });
    const s = await horizontalScroll(p);
    assert.ok(s.scrollWidth <= s.innerWidth + 1, JSON.stringify(s));
    const boxes = await filterControlBoxes(p);
    assert.ok(boxes.length >= 7, `controls found: ${boxes.length}`);
    const small = boxes.filter((b) => b.width < 43 || b.height < 43);
    assert.deepEqual(small, []);
    await p.context().close();
  });
});
