// US-51 (HTTP): the games-analysed badge on /games. U is a signed-in user with chess.com alpha_pawn imported
// (the fake's games: 100000001 where U played Black, 100000002 where U played White). Analyses come from
// POST /api/games/<id>/analysis.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { signedUpUser } from '../support/accounts.mjs';
import { formatOneDecimal, openGames, rowBadges } from '../support/games.mjs';
import { startAppWithFakeSites } from '../support/links.mjs';
import { savePreferences } from '../support/preferences.mjs';
import { openFiltered, filterFormState } from '../support/filters.mjs';
import {
  BLACK_GAME, WHITE_GAME, dropBodyOf, gameIdByNumber, importAlphaPawn, postAnalysis, zerosBodyOf,
} from '../support/review.mjs';

let env, url;
before(async () => {
  env = await startAppWithFakeSites();
  url = env.app.url;
});
after(async () => env?.stop());

/** A signed-in user with alpha_pawn imported. */
async function alphaPawnUser() {
  const u = await signedUpUser(url);
  await importAlphaPawn(url, u);
  return u;
}

/** The badges of the signed-in user's /games: the rows that have any, as [{ id, badges }]. */
async function badgedRows(u, opts = {}) {
  const r = await openGames(url, u.token, opts);
  return rowBadges(r.html).filter((row) => row.badges.length > 0);
}

describe('the badge on /games', () => {
  test('given U with no analysis, when /games is read, then no row has games-analysed', async () => {
    const u = await alphaPawnUser();
    const r = await openGames(url, u.token);
    const rows = rowBadges(r.html);
    assert.ok(rows.length > 0, 'the imported games are listed');
    assert.ok(rows.every((row) => row.badges.length === 0), JSON.stringify(rows));
  });

  test('given U POSTs {cp: 0} then P × {cp: -300} for a game U played White, then only that row has games-analysed, reading A with one decimal and aria-label "Accuracy A"', async () => {
    const u = await alphaPawnUser();
    const id = await gameIdByNumber(url, u.token, WHITE_GAME);
    const posted = await postAnalysis(url, u.token, id, dropBodyOf(WHITE_GAME, -300));
    assert.equal(posted.status, 201, JSON.stringify(posted.body));
    const A = posted.body.accuracyWhite;

    const rows = await badgedRows(u, { acceptLanguage: 'en' });
    assert.deepEqual(rows.map((row) => row.id), [id]);
    assert.equal(rows[0].badges.length, 1);
    assert.equal(rows[0].badges[0].text, formatOneDecimal(A, 'en'));
    assert.equal(rows[0].badges[0].ariaLabel, `Accuracy ${formatOneDecimal(A, 'en')}`);
  });

  test('given U POSTs for a game U played Black (accuracyBlack 100), when /games is read, then that row\'s badge reads 100.0', async () => {
    const u = await alphaPawnUser();
    const id = await gameIdByNumber(url, u.token, BLACK_GAME);
    const posted = await postAnalysis(url, u.token, id, dropBodyOf(BLACK_GAME, -300));
    assert.equal(posted.status, 201, JSON.stringify(posted.body));
    assert.equal(posted.body.accuracyBlack, 100);

    const rows = await badgedRows(u, { acceptLanguage: 'en' });
    assert.deepEqual(rows.map((row) => row.id), [id]);
    assert.equal(rows[0].badges[0].text, '100.0');
  });

  test('given U with language French and an analysed game with accuracy A, when /games is read, then its badge reads A with a decimal comma and aria-label "Précision A"', async () => {
    const u = await alphaPawnUser();
    const saved = await savePreferences(url, u.token, { lang: 'fr', theme: 'system' });
    assert.equal(saved.status, 303, saved.html.slice(0, 200));
    const id = await gameIdByNumber(url, u.token, WHITE_GAME);
    const posted = await postAnalysis(url, u.token, id, dropBodyOf(WHITE_GAME, -300));
    assert.equal(posted.status, 201, JSON.stringify(posted.body));
    const A = formatOneDecimal(posted.body.accuracyWhite, 'fr');
    assert.ok(A.includes(','), `French formatting of ${posted.body.accuracyWhite}: ${A}`);

    const rows = await badgedRows(u);
    assert.deepEqual(rows.map((row) => row.id), [id]);
    assert.equal(rows[0].badges[0].text, A);
    assert.equal(rows[0].badges[0].ariaLabel, `Précision ${A}`);
  });

  test('given an analysed game, when it is re-analysed with a different accuracy, then /games shows the new value', async () => {
    const u = await alphaPawnUser();
    const id = await gameIdByNumber(url, u.token, WHITE_GAME);
    const first = await postAnalysis(url, u.token, id, dropBodyOf(WHITE_GAME, -300));
    assert.equal(first.status, 201, JSON.stringify(first.body));
    const second = await postAnalysis(url, u.token, id, zerosBodyOf(WHITE_GAME));
    assert.equal(second.status, 201, JSON.stringify(second.body));
    assert.notEqual(second.body.accuracyWhite, first.body.accuracyWhite);

    const rows = await badgedRows(u, { acceptLanguage: 'en' });
    assert.deepEqual(rows.map((row) => row.id), [id]);
    assert.equal(rows[0].badges[0].text, formatOneDecimal(second.body.accuracyWhite, 'en'));
    assert.equal(rows[0].badges[0].ariaLabel, `Accuracy ${formatOneDecimal(second.body.accuracyWhite, 'en')}`);
  });

  test('given an analysed game filtered out by /games?colour=, when that page is read, then the other rows show no badge and the filter result is as before', async () => {
    const u = await alphaPawnUser();
    const before = await openFiltered(url, u.token, 'colour=black', { acceptLanguage: 'en' });
    assert.ok(before.rows.length > 0, 'the black games are listed');

    const id = await gameIdByNumber(url, u.token, WHITE_GAME);
    const posted = await postAnalysis(url, u.token, id, dropBodyOf(WHITE_GAME, -300));
    assert.equal(posted.status, 201, JSON.stringify(posted.body));

    const after = await openFiltered(url, u.token, 'colour=black', { acceptLanguage: 'en' });
    assert.equal(filterFormState(after.html).colour, 'black');
    assert.deepEqual(after.rows.map((row) => row.id), before.rows.map((row) => row.id));
    assert.ok(!after.rows.some((row) => row.id === id), 'the analysed White game is filtered out');
    assert.ok(rowBadges(after.html).every((row) => row.badges.length === 0), 'no shown row has a badge');
  });
});
