// US-70: the /stats page over HTTP against the built app wired to the fake chess.com (alpha_pawn, 7 games) and
// Lichess (beta_rook, 6 games). Expected figures come from the fixture games (support/filters.mjs fixtureGames).
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { signedUpUser } from '../support/accounts.mjs';
import { fixtureGames, userWithBothSites } from '../support/filters.mjs';
import { waitForImportEnd } from '../support/imports.mjs';
import { linkAccount, startAppWithFakeSites } from '../support/links.mjs';
import { requestStats } from '../support/stats.mjs';
import { blockText, colourRows, emptyState, figuresOf, filterValues, hasBlock, openStats, timeRows } from '../support/stats-page.mjs';
import { visit } from '../support/visitor.mjs';

let env, url, U;
after(async () => env?.stop());
before(async () => {
  env = await startAppWithFakeSites();
  url = env.app.url;
  U = await userWithBothSites(env);
});

const tally = (games) => {
  const wins = games.filter((g) => g.result === 'win').length;
  const draws = games.filter((g) => g.result === 'draw').length;
  return { games: games.length, wins, draws, losses: games.length - wins - draws, score: Math.round(((wins + draws / 2) / games.length) * 100) };
};

describe('access', () => {
  test('given a signed-out visitor, GET /stats?site=lichess → 303 to /login?next=%2Fstats%3Fsite%3Dlichess', async () => {
    const r = await visit(url, { path: '/stats?site=lichess' });
    assert.equal(r.status, 303);
    assert.equal(r.location, '/login?next=%2Fstats%3Fsite%3Dlichess');
  });
});

describe('colour block', () => {
  test('given the imported games, GET /stats shows each colour row with games, wins, draws, losses and the score with %', async () => {
    const r = await openStats(url, U.token, '', { acceptLanguage: 'en' });
    assert.equal(r.status, 200);
    const rows = colourRows(r.html);
    const all = fixtureGames();
    for (const colour of ['white', 'black']) {
      const row = rows.find((x) => x.colour === colour);
      assert.ok(row, `no ${colour} row`);
      const expected = tally(all.filter((g) => g.colour === colour));
      assert.deepEqual(figuresOf(row), expected, colour);
      assert.equal(row.scoreText, `${expected.score}%`);
    }
    assert.equal(rows.filter((x) => x.colour === 'white').length, 1);
  });

  test('the colour rows match GET /api/stats for each colour', async () => {
    const r = await openStats(url, U.token, '', { acceptLanguage: 'en' });
    const api = await requestStats(url, U.token);
    for (const a of api.body.colour) {
      const row = colourRows(r.html).find((x) => x.colour === a.colour);
      assert.deepEqual(figuresOf(row), figuresOf(a), a.colour);
    }
  });
});

describe('filters', () => {
  test('GET /stats?site=lichess&time=blitz&period=90d shows the numbers of /api/stats with the same query, values selected', async () => {
    const q = 'site=lichess&time=blitz&period=90d';
    const r = await openStats(url, U.token, q, { acceptLanguage: 'en' });
    const api = await requestStats(url, U.token, q);
    assert.equal(r.status, 200);
    assert.deepEqual(filterValues(r.html), { site: 'lichess', time: 'blitz', period: '90d' });
    const colours = colourRows(r.html);
    assert.equal(colours.length, api.body.colour.length);
    for (const a of api.body.colour) assert.deepEqual(figuresOf(colours.find((x) => x.colour === a.colour)), figuresOf(a));
    const times = timeRows(r.html);
    assert.equal(times.length, api.body.time.length);
    for (const a of api.body.time) assert.deepEqual(figuresOf(times.find((x) => x.time === a.time)), figuresOf(a));
  });

  test('GET /stats?site=foo&period=7d shows the same numbers as GET /stats, with period All time (all) selected', async () => {
    const plain = await openStats(url, U.token, '', { acceptLanguage: 'en' });
    const odd = await openStats(url, U.token, 'site=foo&period=7d', { acceptLanguage: 'en' });
    assert.equal(odd.status, 200);
    assert.deepEqual(colourRows(odd.html), colourRows(plain.html));
    assert.deepEqual(timeRows(odd.html), timeRows(plain.html));
    assert.equal(filterValues(odd.html).period, 'all');
    assert.equal(filterValues(odd.html).site, 'all');
  });

  test('the form is a GET form with a submit button', async () => {
    const r = await openStats(url, U.token, '', { acceptLanguage: 'en' });
    const form = /<form\b[^>]*\bdata-testid="stats-filters"[^>]*>/.exec(r.html)?.[0] ?? '';
    assert.match(form, /method="get"/i);
    assert.ok(hasBlock(r.html, 'stats-filter-submit'));
  });
});

describe('time-control block', () => {
  test('given blitz and rapid games, one row per class, blitz before rapid, linking to /games?time=<class>', async () => {
    const r = await openStats(url, U.token, '', { acceptLanguage: 'en' });
    const rows = timeRows(r.html);
    const classes = rows.map((x) => x.time);
    assert.equal(new Set(classes).size, classes.length, 'one row per class');
    assert.ok(classes.includes('blitz') && classes.includes('rapid'));
    assert.ok(classes.indexOf('blitz') < classes.indexOf('rapid'));
    const all = fixtureGames();
    for (const row of rows) {
      assert.ok(row.hrefs.includes(`/games?time=${row.time}`), `${row.time} links to ${row.hrefs}`);
      assert.deepEqual(figuresOf(row), tally(all.filter((g) => g.timeClass === row.time)), row.time);
    }
  });
});

describe('empty states', () => {
  test('given no linked account, /stats reads "No games yet" with a link to /games and no colour or time block', async () => {
    const u = await signedUpUser(url);
    const r = await openStats(url, u.token, '', { acceptLanguage: 'en' });
    assert.equal(r.status, 200);
    const e = emptyState(r.html);
    assert.ok(e, 'no stats-empty');
    assert.match(e.text, /No games yet/);
    assert.ok(e.hrefs.includes('/games'), e.hrefs.join());
    assert.equal(hasBlock(r.html, 'stats-colour'), false);
    assert.equal(hasBlock(r.html, 'stats-time'), false);
  });

  test('given linked accounts and games, /stats?site=lichess matching no game reads "No games match these filters" linking to /stats', async () => {
    const u = await signedUpUser(url);
    const l = await linkAccount(url, u.token, { site: 'chesscom', username: 'alpha_pawn' });
    assert.equal(l.status, 303);
    assert.equal((await waitForImportEnd(url, u.token, 'chesscom', 20000))?.status, 'done');
    const ok = await openStats(url, u.token, '', { acceptLanguage: 'en' });
    assert.equal(emptyState(ok.html), null, 'setup: chess.com games exist');
    const r = await openStats(url, u.token, 'site=lichess', { acceptLanguage: 'en' });
    const e = emptyState(r.html);
    assert.ok(e, 'no stats-empty');
    assert.match(e.text, /No games match these filters/);
    assert.ok(e.hrefs.includes('/stats'), e.hrefs.join());
    assert.equal(hasBlock(r.html, 'stats-colour'), false);
    assert.equal(hasBlock(r.html, 'stats-time'), false);
  });
});

describe('language', () => {
  test('given the lang cookie fr, the headings read "Résultats par couleur" and "Cadences", the rows "Blancs" and "Noirs"', async () => {
    const fr = await userWithBothSites(env, { acceptLanguage: 'fr' });
    const r = await openStats(url, fr.token, '', { cookies: { lang: 'fr' } });
    assert.equal(r.status, 200);
    assert.ok(blockText(r.html, 'stats-colour').includes('Résultats par couleur'));
    assert.ok(blockText(r.html, 'stats-time').includes('Cadences'));
    const rows = colourRows(r.html);
    assert.ok(rows.find((x) => x.colour === 'white')?.text.includes('Blancs'));
    assert.ok(rows.find((x) => x.colour === 'black')?.text.includes('Noirs'));
  });
});
