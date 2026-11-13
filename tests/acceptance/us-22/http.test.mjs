// US-22: filter the games list (HTTP, against the fake sites of support/fakes/).
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { signedUpUser } from '../support/accounts.mjs';
import { hasToken } from '../support/games.mjs';
import { hasTestId, startAppWithFakeSites } from '../support/links.mjs';
import {
  filterControlText, filterFormState, fixtureGames, hasNone, noneResetHref, noneText, openFiltered, userWithBothSites,
} from '../support/filters.mjs';

let env, user, frUser, games;
after(async () => env?.stop());
before(async () => {
  env = await startAppWithFakeSites();
  user = await userWithBothSites(env);
  frUser = await userWithBothSites(env, { acceptLanguage: 'fr' });
  games = fixtureGames();
});

const keysOf = (pred) => games.filter(pred).map((g) => g.key);
const get = (q, opts) => openFiltered(env.app.url, user.token, q, opts);
const getFr = (q) => openFiltered(env.app.url, frUser.token, q, { acceptLanguage: 'fr' });

describe('filter by site', () => {
  test('?site=lichess lists exactly the 6 Lichess games', async () => {
    const r = await get('site=lichess');
    assert.equal(r.status, 200);
    assert.equal(r.keys.length, 6);
    assert.deepEqual(r.keys, keysOf((g) => g.site === 'lichess'));
  });
  test('?site=chesscom lists exactly the 7 chess.com games', async () => {
    const r = await get('site=chesscom');
    assert.equal(r.keys.length, 7);
    assert.deepEqual(r.keys, keysOf((g) => g.site === 'chesscom'));
  });
});

describe('filter by colour, result and time class', () => {
  test('?colour=black lists the Black games, newest first', async () => {
    const r = await get('colour=black');
    assert.ok(r.keys.length > 0);
    assert.deepEqual(r.keys, keysOf((g) => g.colour === 'black'));
  });
  test('?result=draw lists the games drawn by the player, newest first', async () => {
    const r = await get('result=draw');
    assert.ok(r.keys.length > 0);
    assert.deepEqual(r.keys, keysOf((g) => g.result === 'draw'));
  });
  test('?time=blitz lists the Blitz games, newest first', async () => {
    const r = await get('time=blitz');
    assert.ok(r.keys.length > 0);
    assert.deepEqual(r.keys, keysOf((g) => g.timeClass === 'blitz'));
  });
  test('?time=daily lists the chess.com 1/86400 game(s) and the Lichess correspondence game', async () => {
    const r = await get('time=daily');
    assert.deepEqual(r.keys, keysOf((g) => g.timeClass === 'daily'));
    assert.ok(r.rows.some((x) => x.text.includes('1/86400')), 'the 1/86400 game is missing');
    assert.ok(r.rows.some((x) => hasToken(x.text, 'Lichess')), 'the correspondence game is missing');
  });
});

describe('filter by opening', () => {
  test('?opening=najdorf lists the Sicilian Defense Najdorf Variation game', async () => {
    const r = await get('opening=najdorf');
    assert.equal(r.rows.length, 1);
    assert.ok(r.rows[0].text.includes('Najdorf'), r.rows[0].text);
  });
  test('?opening=b90 matches the exact ECO, case-insensitive', async () => {
    const r = await get('opening=b90');
    assert.equal(r.rows.length, 1);
    assert.ok(r.rows[0].text.includes('Najdorf'), r.rows[0].text);
  });
  test('?opening=Scandinavian lists the Lichess game AbCdEf12', async () => {
    const r = await get('opening=Scandinavian');
    assert.equal(r.rows.length, 1);
    assert.ok(hasToken(r.rows[0].text, 'Lichess'));
    assert.ok(r.rows[0].text.includes('made_up_foe'), r.rows[0].text);
  });
  test('?opening=%25 (a literal %) matches no game and shows games-none with games-filter-reset to /games', async () => {
    const r = await get('opening=%25');
    assert.equal(r.status, 200);
    assert.equal(r.rows.length, 0);
    assert.ok(hasNone(r.html), 'games-none missing');
    assert.ok(noneText(r.html).includes('No game matches these filters.'), noneText(r.html));
    assert.equal(noneResetHref(r.html), '/games');
    assert.ok(!hasTestId(r.html, 'games-empty'));
  });
  test('the games-none text is in French for a French visitor', async () => {
    const r = await getFr('opening=%25');
    assert.ok(noneText(r.html).includes('Aucune partie ne correspond à ces filtres.'), noneText(r.html));
  });
});

describe('filters combine', () => {
  test('?site=lichess&colour=white&result=win lists the Lichess games won with White, including AbCdEf12', async () => {
    const r = await get('site=lichess&colour=white&result=win');
    const expected = keysOf((g) => g.site === 'lichess' && g.colour === 'white' && g.result === 'win');
    assert.ok(expected.length >= 3);
    assert.deepEqual(r.keys, expected);
    assert.ok(r.rows.some((x) => x.text.includes('made_up_foe')), 'AbCdEf12 is missing');
  });
});

describe('unknown values', () => {
  test('?site=foo&colour=green&time=hyper is ignored: all 13 games', async () => {
    const r = await get('site=foo&colour=green&time=hyper');
    assert.equal(r.status, 200);
    assert.equal(r.rows.length, 13);
    assert.deepEqual(r.keys, games.map((g) => g.key));
  });
  test('no parameter lists all 13 games, with blank filters', async () => {
    const r = await get('');
    assert.equal(r.rows.length, 13);
    const s = filterFormState(r.html);
    assert.deepEqual([s.site, s.colour, s.result, s.time, s.opening], ['', '', '', '', '']);
  });
});

describe('the filter form', () => {
  test('?site=lichess&time=blitz shows lichess and blitz selected', async () => {
    const r = await get('site=lichess&time=blitz');
    const s = filterFormState(r.html);
    assert.equal(s.site, 'lichess');
    assert.equal(s.time, 'blitz');
    assert.equal(s.colour, '');
    assert.equal(s.result, '');
  });
  test('?colour=white&result=loss&opening=Scand presets the other controls', async () => {
    const s = filterFormState((await get('colour=white&result=loss&opening=Scand')).html);
    assert.equal(s.colour, 'white');
    assert.equal(s.result, 'loss');
    assert.equal(s.opening, 'Scand');
  });
  test('games-filters is a GET form on /games with the submit and reset controls', async () => {
    const r = await get('');
    const open = /<form\b[^>]*\bdata-testid="games-filters"[^>]*>/.exec(r.html)?.[0] ?? '';
    assert.ok(open, 'games-filters is not a form');
    assert.match(open, /\bmethod="(get|GET)"/);
    const action = /\baction="([^"]*)"/.exec(open)?.[1];
    assert.ok(action === undefined || action === '' || action === '/games', open);
    assert.equal(filterControlText(r.html, 'games-filter-submit'), 'Filter');
    assert.equal(filterControlText(r.html, 'games-filter-reset'), 'Reset');
  });
  test('the submit and reset labels are in French for a French visitor', async () => {
    const r = await getFr('');
    assert.equal(filterControlText(r.html, 'games-filter-submit'), 'Filtrer');
    assert.equal(filterControlText(r.html, 'games-filter-reset'), 'Réinitialiser');
  });
});

describe('a user with nothing linked', () => {
  test('sees games-empty, not games-none, even with a filter', async () => {
    const u = await signedUpUser(env.app.url);
    for (const q of ['', 'site=lichess']) {
      const r = await openFiltered(env.app.url, u.token, q);
      assert.ok(hasTestId(r.html, 'games-empty'));
      assert.ok(!hasTestId(r.html, 'games-none'));
    }
  });
});
