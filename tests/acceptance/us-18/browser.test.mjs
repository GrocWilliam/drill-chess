// US-18 (browser): the page updates itself while importing, with and without JavaScript; no sideways scroll.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { signedUpUser } from '../support/accounts.mjs';
import { waitForImportEnd } from '../support/imports.mjs';
import {
  countNavigations, linkFromEmptyState, recordStatusPolls, rowCount, statusText, waitForStatusText,
} from '../support/import-status.mjs';
import { linkAccount, startAppWithFakeSites } from '../support/links.mjs';
import { VIEWPORTS, horizontalScroll, launchBrowser, newVisitorPage } from '../support/pages.mjs';

let env, browser;
before(async () => {
  env = await startAppWithFakeSites();
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
  await env?.stop();
});

const open = async (opts) => {
  const user = await signedUpUser(env.app.url);
  const page = await newVisitorPage(browser, { baseUrl: env.app.url, session: user.token, ...opts });
  return { user, page };
};

describe('the page while importing', () => {
  test('with JavaScript it polls /api/import/status about every 2 s and updates without a reload', async () => {
    const { page } = await open({});
    const polls = recordStatusPolls(page);
    await page.goto(env.app.url + '/games');
    await linkFromEmptyState(page, 'slow_knight');
    await page.waitForURL((u) => u.pathname === '/games');
    const nav = countNavigations(page);
    assert.equal(await waitForStatusText(page, '4 games imported, 0 skipped'), '4 games imported, 0 skipped');
    assert.equal(await rowCount(page), 4);
    assert.equal(nav.count, 0, 'the page was reloaded');
    assert.ok(polls.length >= 2, `only ${polls.length} polls`);
    const gaps = polls.slice(1).map((t, i) => t - polls[i]);
    for (const g of gaps) assert.ok(g >= 1200 && g <= 3500, `gap of ${g} ms between polls: ${gaps}`);
    await page.context().close();
  });

  test('without JavaScript the page refreshes by itself and shows the result', async () => {
    const { page } = await open({ javaScriptEnabled: false });
    await page.goto(env.app.url + '/games');
    await linkFromEmptyState(page, 'slow_knight');
    await page.waitForURL((u) => u.pathname === '/games');
    const nav = countNavigations(page);
    assert.equal(await waitForStatusText(page, '4 games imported, 0 skipped'), '4 games imported, 0 skipped');
    assert.ok(nav.count >= 1, 'the page never refreshed');
    assert.equal(await rowCount(page), 4);
    await page.context().close();
  });
});

describe('the status line at 375×812', () => {
  test('there is no sideways scroll', async () => {
    const { user, page } = await open({ viewport: VIEWPORTS.mobile });
    await linkAccount(env.app.url, user.token, { site: 'chesscom', username: 'alpha_pawn' });
    await waitForImportEnd(env.app.url, user.token, 'chesscom');
    await page.goto(env.app.url + '/games');
    await page.getByTestId('games-status').waitFor({ state: 'visible' });
    assert.ok((await statusText(page)).length > 0);
    const s = await horizontalScroll(page);
    assert.ok(s.scrollWidth <= s.innerWidth + 1, JSON.stringify(s));
    await page.context().close();
  });
});
