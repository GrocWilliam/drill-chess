// US-73: the mistakes-by-phase block of /stats over HTTP against the built app wired to the fake chess.com
// (alpha_pawn) and Lichess (beta_rook); analyses saved through POST /api/games/[id]/analysis.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { signedUpUser } from '../support/accounts.mjs';
import { fixtureGames, userWithBothSites } from '../support/filters.mjs';
import { startAppWithFakeSites } from '../support/links.mjs';
import { BLACK_GAME, WHITE_GAME, dropBodyOf, importAlphaPawn, saveAnalysisOf, saveTwoAnalyses } from '../support/review.mjs';
import { requestStats } from '../support/stats.mjs';
import {
  blockPosition, colourRows, hasBlock, mistakePhaseRows, mistakesAccuracyText, mistakesEmpty, mistakesGamesText, oneDecimal, openStats,
} from '../support/stats-page.mjs';

let env, url;
after(async () => env?.stop());
before(async () => {
  env = await startAppWithFakeSites();
  url = env.app.url;
});

const PHASES = ['opening', 'middlegame', 'endgame'];
const norm = (s) => s.replace(/[\s  ]+/g, ' ');

describe('no analysis', () => {
  test('a user with imported games and no analysis → the block reads "Open a game to analyse it" with a link to /games, and no phase row', async () => {
    const u = await signedUpUser(url);
    await importAlphaPawn(url, u);
    const r = await openStats(url, u.token, '', { acceptLanguage: 'en' });
    assert.equal(r.status, 200);
    const empty = mistakesEmpty(r.html);
    assert.ok(empty, 'no stats-mistakes-empty');
    assert.match(norm(empty.text), /Open a game to analyse it/);
    assert.ok(empty.hrefs.some((h) => new URL(h, url).pathname === '/games'), JSON.stringify(empty.hrefs));
    assert.equal(mistakePhaseRows(r.html).length, 0);
  });
});

describe('two analysed games', () => {
  let u, page, api;
  before(async () => {
    u = await signedUpUser(url);
    await importAlphaPawn(url, u);
    await saveTwoAnalyses(url, u);
    page = await openStats(url, u.token, '', { acceptLanguage: 'en' });
    api = (await requestStats(url, u.token)).body.mistakes;
  });

  test('GET /stats reads "2 analysed games" and shows no empty state', () => {
    assert.equal(page.status, 200);
    assert.match(norm(mistakesGamesText(page.html)), /\b2 analysed games\b/);
    assert.equal(mistakesEmpty(page.html), null);
  });

  test('the accuracy matches GET /api/stats mistakes.accuracy with one decimal and a %', () => {
    assert.equal(typeof api.accuracy, 'number');
    assert.equal(mistakesAccuracyText(page.html), oneDecimal(api.accuracy));
    assert.match(norm(page.html), /\d\s*%/);
  });

  test('each phase row shows the inaccuracy, mistake and blunder values of mistakes.byPhase, with one decimal', () => {
    const rows = mistakePhaseRows(page.html);
    for (const phase of PHASES) {
      const matching = rows.filter((r) => r.phase === phase);
      assert.equal(matching.length, 1, `rows for ${phase}`);
      const p = api.byPhase[phase];
      assert.deepEqual(matching[0].values, [p.inaccuracy, p.mistake, p.blunder].map((n) => oneDecimal(n)), phase);
    }
    const total = PHASES.reduce((n, ph) => n + api.byPhase[ph].blunder, 0);
    assert.ok(total > 0, 'setup: the saved analyses hold blunders of the player');
  });

  test('the block comes last on the page, after the colour and time blocks', () => {
    const at = blockPosition(page.html, 'stats-mistakes');
    assert.ok(at > blockPosition(page.html, 'stats-colour'));
    assert.ok(at > blockPosition(page.html, 'stats-time'));
  });

  test('the rows are labelled Opening, Middlegame and Endgame', () => {
    const rows = mistakePhaseRows(page.html);
    for (const [phase, label] of [['opening', 'Opening'], ['middlegame', 'Middlegame'], ['endgame', 'Endgame']]) {
      assert.match(rows.find((r) => r.phase === phase).text, new RegExp(`\\b${label}\\b`));
    }
    assert.match(norm(page.html), /Mistakes by phase/);
  });
});

describe('only the opponent blundered', () => {
  test('one analysed game where only the opponent’s move is marked → every phase row shows 0.0, 0.0, 0.0', async () => {
    const u = await signedUpUser(url);
    await importAlphaPawn(url, u);
    // BLACK_GAME: the user has Black; White's first move (ply 1) is the blunder.
    await saveAnalysisOf(url, u, BLACK_GAME, dropBodyOf(BLACK_GAME, -300));
    const r = await openStats(url, u.token, '', { acceptLanguage: 'en' });
    assert.match(norm(mistakesGamesText(r.html)), /\b1 analysed game\b/);
    const rows = mistakePhaseRows(r.html);
    assert.equal(rows.length, 3);
    for (const row of rows) assert.deepEqual(row.values, ['0.0', '0.0', '0.0'], row.phase);
  });
});

describe('filter by site', () => {
  test('analysed games only on chess.com: GET /stats?site=lichess shows the empty state while the other blocks show the Lichess games', async () => {
    const u = await userWithBothSites(env);
    await saveAnalysisOf(url, u, WHITE_GAME, dropBodyOf(WHITE_GAME, -300));
    const withAll = await openStats(url, u.token, '', { acceptLanguage: 'en' });
    assert.equal(mistakePhaseRows(withAll.html).length, 3, 'setup: unfiltered page has the rows');
    const r = await openStats(url, u.token, 'site=lichess', { acceptLanguage: 'en' });
    assert.equal(r.status, 200);
    assert.match(norm(mistakesEmpty(r.html)?.text ?? ''), /Open a game to analyse it/);
    assert.equal(mistakePhaseRows(r.html).length, 0);
    assert.ok(hasBlock(r.html, 'stats-colour'));
    const lichess = fixtureGames().filter((g) => g.site === 'lichess').length;
    assert.ok(lichess > 0);
    assert.equal(colourRows(r.html).reduce((n, row) => n + row.games, 0), lichess);
  });
});

describe('French', () => {
  test('lang cookie fr and 1 analysed game → headings and labels in French, decimals with a comma', async () => {
    const u = await signedUpUser(url, { acceptLanguage: 'fr' });
    await importAlphaPawn(url, u);
    await saveAnalysisOf(url, u, WHITE_GAME, dropBodyOf(WHITE_GAME, -300));
    const r = await openStats(url, u.token, '', { cookies: { lang: 'fr' } });
    assert.equal(r.status, 200);
    const text = norm(r.html.replace(/<[^>]+>/g, ' '));
    for (const s of ['Erreurs par phase', 'Ouverture', 'Milieu de partie', 'Finale']) assert.ok(text.includes(s), s);
    assert.match(norm(mistakesGamesText(r.html)), /\b1 partie analysée\b/);
    const api = (await requestStats(url, u.token)).body.mistakes;
    assert.equal(mistakesAccuracyText(r.html), oneDecimal(api.accuracy, 'fr'));
    const rows = mistakePhaseRows(r.html);
    assert.equal(rows.length, 3);
    for (const row of rows) {
      const p = api.byPhase[row.phase];
      assert.deepEqual(row.values, [p.inaccuracy, p.mistake, p.blunder].map((n) => oneDecimal(n, 'fr')), row.phase);
    }
    assert.ok(rows.some((row) => row.values.some((v) => v.includes(',') && v !== '0,0')), 'a non-zero value with a comma');
  });

  test('French with no analysed game the block reads "Ouvrez une partie pour l\'analyser"', async () => {
    const u = await signedUpUser(url, { acceptLanguage: 'fr' });
    await importAlphaPawn(url, u);
    const r = await openStats(url, u.token, '', { cookies: { lang: 'fr' } });
    assert.match(norm(mistakesEmpty(r.html)?.text ?? ''), /Ouvrez une partie pour l'analyser/);
    assert.equal(mistakePhaseRows(r.html).length, 0);
  });
});
