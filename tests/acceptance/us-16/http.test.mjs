// US-16: the games list and a game's details (HTTP, against the fake chess.com of support/fakes/).
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { redirectTarget, signUp, signedUpUser, uniqueEmail } from '../support/accounts.mjs';
import { deleteAccount } from '../support/delete-account.mjs';
import { formatDate, fakeEndTime, gameDetails, hasToken, listedGames, openGame, openGames } from '../support/games.mjs';
import { expectedOpeningOfMoves } from '../support/openings.mjs';
import { importStatus, waitForImportEnd } from '../support/imports.mjs';
import { hasTestId, linkAccount, startAppWithFakeSites } from '../support/links.mjs';
import { visit } from '../support/visitor.mjs';

let env, enUser, enList, frList;
after(async () => env?.stop());

/** A user (in `lang`) whose alpha_pawn import is done. */
async function userWithGames(lang = 'en', email) {
  const u = await signedUpUser(env.app.url, { acceptLanguage: lang, email });
  const link = await linkAccount(env.app.url, u.token, { site: 'chesscom', username: 'alpha_pawn' });
  assert.equal(link.status, 303, 'setup: linking alpha_pawn failed');
  const job = await waitForImportEnd(env.app.url, u.token, 'chesscom', 20000);
  assert.equal(job?.status, 'done', 'setup: the import did not finish');
  return u;
}

before(async () => {
  env = await startAppWithFakeSites();
  enUser = await userWithGames('en');
  enList = listedGames((await openGames(env.app.url, enUser.token, { acceptLanguage: 'en' })).html);
  const fr = await userWithGames('fr');
  frList = listedGames((await openGames(env.app.url, fr.token, { acceptLanguage: 'fr' })).html);
});

describe('GET /games after the alpha_pawn import', () => {
  test('games-list has 7 games-row in ended_at order, newest first', async () => {
    assert.equal(enList.length, 7);
    assert.equal(new Set(enList.map((r) => r.id)).size, 7);
    // The three newest are the month 0 games (end times 20h, 15h and 10h of the 1st).
    assert.ok(enList[0].text.includes('180+2'));
    assert.ok(enList[1].text.includes('600'));
    assert.ok(enList[2].text.includes('1/86400'));
  });

  test('the first row shows chess.com, Blitz, 180+2, Black, made_up_rival, 1432, Win, the opening and the en date', () => {
    const t = enList[0].text;
    for (const token of ['chess.com', 'Blitz', '180+2', 'Black', 'made_up_rival', '1432', 'Win', 'B90']) {
      assert.ok(hasToken(t, token), `"${token}" missing from: ${t}`);
    }
    assert.ok(t.includes('Sicilian Defense Najdorf Variation'), t);
    const date = formatDate(fakeEndTime('100000001'), 'en');
    assert.match(date, /^\d{1,2}\/\d{1,2}\/\d{4}$/);
    assert.ok(hasToken(t, date), `date ${date} missing from: ${t}`);
  });

  test('the second row shows Rapid, 600, White, Draw, C50 and the dataset name of its line (Italian Game...)', () => {
    const t = enList[1].text;
    for (const token of ['Rapid', '600', 'White', 'Draw', 'C50']) assert.ok(hasToken(t, token), `"${token}" missing from: ${t}`);
    const name = expectedOpeningOfMoves('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5')?.name;
    assert.ok(name?.startsWith('Italian Game'), `dataset name: ${name}`);
    assert.ok(t.includes(name), `"${name}" missing from: ${t}`);
    assert.ok(!/undefined|null/.test(t), t);
  });

  test('the third row shows Daily, 1/86400 and Loss', () => {
    const t = enList[2].text;
    for (const token of ['Daily', '1/86400', 'Loss']) assert.ok(hasToken(t, token), `"${token}" missing from: ${t}`);
  });

  test('a row links to /games/<its data-game-id>', () => {
    assert.equal(enList.length, 7);
    for (const r of enList) assert.ok(r.hrefs.includes(`/games/${r.id}`), `row ${r.id}: ${r.hrefs}`);
  });
});

describe('GET /games in French', () => {
  test('the first row shows Noirs, Victoire and the fr date; the second shows Rapide and Nulle', () => {
    assert.equal(frList.length, 7);
    const a = frList[0].text;
    assert.ok(hasToken(a, 'Noirs'), a);
    assert.ok(hasToken(a, 'Victoire'), a);
    const date = formatDate(fakeEndTime('100000001'), 'fr');
    assert.ok(hasToken(a, date), `date ${date} missing from: ${a}`);
    const b = frList[1].text;
    assert.ok(hasToken(b, 'Rapide'), b);
    assert.ok(hasToken(b, 'Nulle'), b);
  });
});

describe('GET /games for users without games', () => {
  test('nothing linked: games-empty', async () => {
    const u = await signedUpUser(env.app.url);
    const { status, html } = await openGames(env.app.url, u.token);
    assert.equal(status, 200);
    assert.ok(hasTestId(html, 'games-empty'));
  });
});

describe('GET /games/<id>', () => {
  test('200 with both players and ratings, the result, the clock, the opening, the site link and the moves', async () => {
    const r = await openGame(env.app.url, enUser.token, enList[0].id);
    assert.equal(r.status, 200);
    const d = gameDetails(r.html);
    for (const token of ['Alpha_Pawn', 'made_up_rival', '1432', '1488', 'Win', '180+2', 'Blitz']) {
      assert.ok(hasToken(d.text, token), `"${token}" missing from: ${d.text}`);
    }
    assert.ok(d.text.includes('B90 Sicilian Defense Najdorf Variation'), d.text);
    assert.ok(hasToken(d.text, formatDate(fakeEndTime('100000001'), 'en')), d.text);
    assert.equal(d.siteLinkHref, 'https://www.chess.com/game/live/100000001');
    assert.ok(d.moves.includes('1. e4 c5 2. Nf3 d6'), d.moves);
  });

  test("another user's game answers 404", async () => {
    const other = await signedUpUser(env.app.url);
    assert.equal((await openGame(env.app.url, other.token, enList[0].id)).status, 404);
  });

  test('an unknown UUID and a non-UUID id answer 404', async () => {
    assert.equal((await openGame(env.app.url, enUser.token, '00000000-0000-4000-8000-000000000000')).status, 404);
    assert.equal((await openGame(env.app.url, enUser.token, 'abc')).status, 404);
  });

  test('a signed-out visitor is redirected 303 to /login?next=%2Fgames%2F<id>', async () => {
    const id = enList[0].id;
    const r = await visit(env.app.url, { path: `/games/${id}` });
    assert.equal(r.status, 303);
    assert.equal(redirectTarget(env.app.url, r.location), `/login?next=%2Fgames%2F${id}`);
  });
});

describe('deleting the account then signing up again with the same email', () => {
  test('/games shows games-empty, the import status is {"jobs": []} and the old game id answers 404', async () => {
    const email = uniqueEmail();
    const u = await userWithGames('en', email);
    const oldId = listedGames((await openGames(env.app.url, u.token)).html)[0]?.id;
    assert.ok(oldId, 'setup: no game listed before deleting');
    const del = await deleteAccount(env.app.url, u.token, u.password);
    assert.equal(del.status, 303, 'setup: account deletion failed');
    const again = await signUp(env.app.url, { email, password: u.password });
    assert.ok(again.session?.value, 'setup: signup again failed');
    const token = again.session.value;
    const { html } = await openGames(env.app.url, token);
    assert.ok(hasTestId(html, 'games-empty'));
    assert.deepEqual((await importStatus(env.app.url, token)).body, { jobs: [] });
    assert.equal((await openGame(env.app.url, token, oldId)).status, 404);
  });
});
