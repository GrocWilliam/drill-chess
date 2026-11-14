// US-72: the rating block of /stats over HTTP, with games imported through the fake chess.com and Lichess.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { startAppWithFakeSites } from '../support/links.mjs';
import { openStats } from '../support/stats-page.mjs';
import {
  EN, FR, apiRatings, chartFacts, hasRatingPart, ratingHeading, ratingSummary, ratingText, seriesPicker, tableRatings,
  userWithFourGames, userWithOneGame, userWithTwoSeries,
} from '../support/rating-page.mjs';

let env, url, two, four, one;
after(async () => env?.stop());
before(async () => {
  env = await startAppWithFakeSites();
  url = env.app.url;
  two = await userWithTwoSeries(env);
  four = await userWithFourGames(env);
  one = await userWithOneGame(env);
});

const summaryOf = (ratings) => ({ first: ratings[0], last: ratings.at(-1), highest: Math.max(...ratings), lowest: Math.min(...ratings) });

describe('series picker and default series', () => {
  test('given chesscom-blitz (5 games) and lichess-rapid (2 games), GET /stats selects chess.com blitz and the summary reads its first, last, highest and lowest', async () => {
    const r = await openStats(url, two.token, '', { acceptLanguage: 'en' });
    assert.equal(r.status, 200);
    const picker = seriesPicker(r.html);
    assert.ok(picker, 'stats-rating-series is on the page');
    assert.equal(picker.name, 'series');
    assert.ok(picker.inFilters, 'the select is inside the stats-filters form');
    assert.equal(picker.selected, 'chesscom-blitz');
    const values = picker.options.map((o) => o.value);
    assert.ok(values.includes('chesscom-blitz') && values.includes('lichess-rapid'), values.join());
    const lichess = picker.options.find((o) => o.value === 'lichess-rapid');
    assert.match(lichess.label, /Lichess/);
    assert.match(lichess.label, /Rapid/);
    assert.match(picker.options.find((o) => o.value === 'chesscom-blitz').label, /Blitz/);
    const ratings = await apiRatings(url, two.token, 'chesscom-blitz');
    assert.equal(ratings.length, 5);
    assert.deepEqual(ratingSummary(r.html, EN), summaryOf(ratings));
    assert.equal(hasRatingPart(r.html, 'stats-rating-not-enough'), false);
  });

  test('GET /stats?series=lichess-rapid selects Lichess rapid and the table lists its 2 ratings in date order', async () => {
    const r = await openStats(url, two.token, 'series=lichess-rapid', { acceptLanguage: 'en' });
    assert.equal(seriesPicker(r.html).selected, 'lichess-rapid');
    const ratings = await apiRatings(url, two.token, 'lichess-rapid');
    assert.equal(ratings.length, 2);
    assert.deepEqual(tableRatings(r.html), ratings);
    assert.deepEqual(ratingSummary(r.html, EN), summaryOf(ratings));
  });

  test('GET /stats?series=nonsense selects the default series, chess.com blitz', async () => {
    const r = await openStats(url, two.token, 'series=nonsense', { acceptLanguage: 'en' });
    assert.equal(r.status, 200);
    assert.equal(seriesPicker(r.html).selected, 'chesscom-blitz');
  });

  test('GET /stats?site=lichess offers only Lichess series', async () => {
    const r = await openStats(url, two.token, 'site=lichess', { acceptLanguage: 'en' });
    const picker = seriesPicker(r.html);
    assert.ok(picker.options.length > 0);
    assert.ok(picker.options.every((o) => o.value.startsWith('lichess-')), picker.options.map((o) => o.value).join());
  });
});

describe('summary and table alternative', () => {
  test('given ratings [1500, 1560, 1480, 1540], the summary reads First 1500, Last 1540, Highest 1560, Lowest 1480 and the table lists 4 rows in order', async () => {
    assert.deepEqual(await apiRatings(url, four.token, 'chesscom-blitz'), [1500, 1560, 1480, 1540]);
    const r = await openStats(url, four.token, '', { acceptLanguage: 'en' });
    assert.deepEqual(ratingSummary(r.html, EN), { first: 1500, last: 1540, highest: 1560, lowest: 1480 });
    assert.deepEqual(tableRatings(r.html), [1500, 1560, 1480, 1540]);
    assert.deepEqual(chartFacts(r.html), { svg: true, details: true });
    assert.match(ratingHeading(r.html), /^Rating$/);
  });
});

describe('not enough games', () => {
  test('given a selected series of 1 game, the block reads "Not enough games" without chart and summary', async () => {
    const r = await openStats(url, one.token, '', { acceptLanguage: 'en' });
    assert.equal(r.status, 200);
    assert.match(ratingText(r.html, 'stats-rating-not-enough'), /Not enough games/);
    assert.equal(hasRatingPart(r.html, 'stats-rating-chart'), false);
    assert.equal(hasRatingPart(r.html, 'stats-rating-summary'), false);
  });
});

describe('French', () => {
  test('given the lang cookie fr, the heading reads "Classement" and the summary "Première", "Dernière", "Plus haute", "Plus basse"', async () => {
    const fr = await userWithFourGames(env, { acceptLanguage: 'fr' });
    const r = await openStats(url, fr.token, '', { cookies: { lang: 'fr' } });
    assert.equal(ratingHeading(r.html), 'Classement');
    assert.deepEqual(ratingSummary(r.html, FR), { first: 1500, last: 1540, highest: 1560, lowest: 1480 });
  });

  test('given the lang cookie fr, a one-game series reads "Pas assez de parties"', async () => {
    const fr = await userWithOneGame(env, { acceptLanguage: 'fr' });
    const r = await openStats(url, fr.token, '', { cookies: { lang: 'fr' } });
    assert.match(ratingText(r.html, 'stats-rating-not-enough'), /Pas assez de parties/);
  });
});
