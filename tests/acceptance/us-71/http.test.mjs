// US-71: the openings block of /stats over HTTP. `opening_owl` (chess.com fake) has 18 games in 13 opening groups:
// no opening x3, C50 "Italian Game" x3 (white win blitz, black win blitz, black loss rapid), "Polish Opening" x2 (no ECO), 10 singles.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { visitAs } from '../support/accounts.mjs';
import { startAppWithFakeSites } from '../support/links.mjs';
import { listedGames } from '../support/games.mjs';
import { requestStats } from '../support/stats.mjs';
import { blockText, colourRows, figuresOf, hasBlock, hrefParts, openStats, openingLink, openingRows, userWithManyOpenings } from '../support/stats-page.mjs';
import { userWithBothSites } from '../support/filters.mjs';
import { expectedOpeningOfMoves } from '../support/openings.mjs';

let env, url, U;
after(async () => env?.stop());
before(async () => {
  env = await startAppWithFakeSites();
  url = env.app.url;
  U = await userWithManyOpenings(env);
});

const UNKNOWN = /Unknown opening/;
// US-86: the 3 games with no site opening (1. e4 e5 2. Nf3 Nc6) get the dataset's ECO and name (C44, King's Knight Opening: Normal Variation).
const NAMED = expectedOpeningOfMoves('1. e4 e5 2. Nf3 Nc6');

/** Asserts that the page rows are the API rows: same order, ECO, name, games, wins, draws, losses, score. */
function assertRowsMatch(rows, api) {
  assert.equal(rows.length, api.length);
  api.forEach((a, i) => {
    const row = rows[i];
    assert.deepEqual(figuresOf(row), figuresOf(a), `row ${i}`);
    assert.equal(row.scoreText, `${a.score}%`, `row ${i} score text`);
    assert.equal(row.eco, a.eco ?? null, `row ${i} eco`);
    if (a.opening) assert.ok(row.text.includes(a.opening), `row ${i}: "${row.text}" lacks "${a.opening}"`);
    else assert.match(row.text, UNKNOWN, `row ${i}`);
  });
}

describe('openings block rows', () => {
  test('given imported games, GET /stats opening rows match GET /api/stats openings: order, ECO, name, games, wins, draws, losses, score', async () => {
    const r = await openStats(url, U.token, '', { acceptLanguage: 'en' });
    const api = await requestStats(url, U.token);
    assert.equal(r.status, 200);
    assert.ok(hasBlock(r.html, 'stats-openings'));
    assertRowsMatch(openingRows(r.html), api.body.openings);
    assert.ok(openingRows(r.html).length > 0);
  });

  test('the block comes after the colour block and its heading reads "Openings"', async () => {
    const r = await openStats(url, U.token, '', { acceptLanguage: 'en' });
    assert.ok(r.html.indexOf('data-testid="stats-colour"') < r.html.indexOf('data-testid="stats-openings"'));
    assert.ok(blockText(r.html, 'stats-openings').includes('Openings'));
  });

  test('given more than 10 distinct openings, exactly 10 opening rows are shown', async () => {
    const api = await requestStats(url, U.token);
    assert.equal(api.body.openings.length, 10, 'setup: the API caps at 10 although 13 groups exist');
    const r = await openStats(url, U.token, '', { acceptLanguage: 'en' });
    assert.equal(openingRows(r.html).length, 10);
  });

  test('given games with no site opening, no row reads "Unknown opening": one row with the dataset ECO and name counts 3 games and links to /games', async () => {
    assert.ok(NAMED?.eco && NAMED.name, 'setup: the dataset has no line for 1. e4 e5 2. Nf3 Nc6');
    const r = await openStats(url, U.token, '', { acceptLanguage: 'en' });
    const rows = openingRows(r.html);
    assert.equal(rows.filter((x) => UNKNOWN.test(x.text)).length, 0);
    const named = rows.filter((x) => x.eco === NAMED.eco && x.text.includes(NAMED.name));
    assert.equal(named.length, 1);
    assert.equal(named[0].games, 3);
    assert.ok(openingLink(named[0]), named[0].hrefs.join());
    assert.equal(openingLink(named[0]).path, '/games');
  });
});

describe('openings toggle', () => {
  test('GET /stats?openingsColour=white: opening rows match /api/stats?openingsColour=white, colour block matches /api/stats', async () => {
    const r = await openStats(url, U.token, 'openingsColour=white', { acceptLanguage: 'en' });
    const whiteApi = await requestStats(url, U.token, 'openingsColour=white');
    const plainApi = await requestStats(url, U.token);
    assert.equal(r.status, 200);
    assertRowsMatch(openingRows(r.html), whiteApi.body.openings);
    const colours = colourRows(r.html);
    assert.equal(colours.length, plainApi.body.colour.length);
    for (const a of plainApi.body.colour) assert.deepEqual(figuresOf(colours.find((x) => x.colour === a.colour)), figuresOf(a), a.colour);
    assert.notDeepEqual(whiteApi.body.openings.map(figuresOf), plainApi.body.openings.map(figuresOf), 'setup: the toggle changes the openings');
  });

  test('the toggle sits in the stats-filters form with the choices both, white and black', async () => {
    const r = await openStats(url, U.token, 'openingsColour=black', { acceptLanguage: 'en' });
    const form = /<form\b[^>]*\bdata-testid="stats-filters"[^>]*>([\s\S]*?)<\/form>/.exec(r.html)?.[1] ?? '';
    assert.match(form, /data-testid="stats-openings-colour"/);
    for (const v of ['both', 'white', 'black']) assert.match(form, new RegExp(`value="${v}"`), v);
  });
});

describe('links to /games', () => {
  const paramsOf = (query) => hrefParts(`/games?${query}`).params;

  test('GET /stats?openingsColour=black&site=chesscom&time=blitz: the C50 row links to /games with exactly opening, colour, site and time', async () => {
    const r = await openStats(url, U.token, 'openingsColour=black&site=chesscom&time=blitz', { acceptLanguage: 'en' });
    const row = openingRows(r.html).find((x) => x.eco === 'C50');
    assert.ok(row, 'no C50 row');
    const link = openingLink(row);
    assert.ok(link, row.hrefs.join());
    assert.equal(link.path, '/games');
    assert.deepEqual(link.params, paramsOf('opening=C50&colour=black&site=chesscom&time=blitz'));
  });

  test('GET /stats (toggle both, no site or time): the C50 row links to /games?opening=C50 and nothing else', async () => {
    const r = await openStats(url, U.token, '', { acceptLanguage: 'en' });
    const row = openingRows(r.html).find((x) => x.eco === 'C50');
    assert.ok(row, 'no C50 row');
    assert.deepEqual(openingLink(row), { path: '/games', params: paramsOf('opening=C50') });
  });

  test('an opening named "Polish Opening" with no ECO links to /games with opening=Polish Opening (URL-encoded)', async () => {
    const r = await openStats(url, U.token, '', { acceptLanguage: 'en' });
    const row = openingRows(r.html).find((x) => x.text.includes('Polish Opening'));
    assert.ok(row, 'no Polish Opening row');
    assert.equal(row.eco, null);
    const link = openingLink(row);
    assert.deepEqual(link, { path: '/games', params: [['opening', 'Polish Opening']] });
    const raw = row.hrefs.find((h) => h.startsWith('/games'));
    assert.ok(!raw.includes(' '), `href is not URL-encoded: ${raw}`);
  });

  for (const [name, find, expected] of [
    ['C50', (x) => x.eco === 'C50', 3],
    ['Polish Opening', (x) => x.text.includes('Polish Opening'), 2],
  ]) {
    test(`following the ${name} link, /games lists only the games of that opening (${expected})`, async () => {
      const stats = await openStats(url, U.token, '', { acceptLanguage: 'en' });
      const row = openingRows(stats.html).find(find);
      const href = row.hrefs.find((h) => h.startsWith('/games'));
      assert.equal(row.games, expected);
      const listed = [];
      let path = href;
      for (let i = 0; i < 5 && path; i++) {
        const { html } = await visitAs(url, U.token, { path, acceptLanguage: 'en' });
        listed.push(...listedGames(html));
        const next = /data-testid="games-next"[^>]*href="([^"]*)"|href="([^"]*)"[^>]*data-testid="games-next"/.exec(html);
        path = next ? (next[1] ?? next[2]).replaceAll('&amp;', '&') : null;
      }
      assert.equal(listed.length, expected);
      assert.ok(listed.length < 18, 'the other games are not listed');
    });
  }
});

describe('language', () => {
  test('given the lang cookie fr, the heading reads "Ouvertures" and no row reads "Ouverture inconnue"', async () => {
    const fr = await userWithManyOpenings(env, { acceptLanguage: 'fr' });
    const r = await openStats(url, fr.token, '', { cookies: { lang: 'fr' } });
    assert.equal(r.status, 200);
    assert.ok(blockText(r.html, 'stats-openings').includes('Ouvertures'));
    assert.equal(openingRows(r.html).filter((x) => /Ouverture inconnue/.test(x.text)).length, 0);
  });
});

describe('fixture user with both sites', () => {
  test('rows still match the API for the chess.com + Lichess fixtures (openings with ECO, a name only, none)', async () => {
    const both = await userWithBothSites(env);
    for (const q of ['', 'site=lichess', 'openingsColour=black']) {
      const r = await openStats(url, both.token, q, { acceptLanguage: 'en' });
      const api = await requestStats(url, both.token, q);
      assertRowsMatch(openingRows(r.html), api.body.openings);
    }
  });
});
