// US-109: the /endgames page over HTTP.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { redirectTarget, signedUpUser } from '../support/accounts.mjs';
import { passAttempt, failAttempt } from '../support/endgame-attempts.mjs';
import { startServer } from '../support/server.mjs';
import { cardById, endgamesAsVisitor, endgamesHtml, levelsOf } from '../support/endgames-page.mjs';

let app, url;
before(async () => { app = await startServer(); url = app.url; });
after(async () => app?.stop());

const norm = (s) => s.replace(/[\s  ]+/g, ' ').trim();

describe('access', () => {
  test('a signed-out visitor is redirected to /login?next=%2Fendgames', async () => {
    const r = await endgamesAsVisitor(url);
    assert.ok([302, 303].includes(r.status), String(r.status));
    assert.equal(redirectTarget(url, r.location), '/login?next=%2Fendgames');
  });
});

describe('a new user', () => {
  test('sees 4 levels with their titles and counts', async () => {
    const u = await signedUpUser(url);
    const r = await endgamesHtml(url, u.token);
    assert.equal(r.status, 200);
    const levels = levelsOf(r.html);
    assert.equal(levels.length, 4);
    const expected = [['Basic mates', '0/4 mastered'], ['Pawn endings', '0/7 mastered'], ['Rook endings', '0/4 mastered'], ['Harder endings', '0/5 mastered']];
    expected.forEach(([title, count], i) => {
      assert.ok(levels[i].text.includes(title), `${title} in ${levels[i].text}`);
      assert.equal(norm(levels[i].count), count);
    });
  });

  test('level 1 lists kq-k, kr-k, krr-k, kbb-k in that order; 20 cards in all', async () => {
    const u = await signedUpUser(url);
    const levels = levelsOf((await endgamesHtml(url, u.token)).html);
    assert.deepEqual(levels[0].cards.map((c) => c.id), ['kq-k', 'kr-k', 'krr-k', 'kbb-k']);
    assert.equal(levels.flatMap((l) => l.cards).length, 20);
  });

  test('the philidor card: name, "Hold the draw", 0/3, 0 attempts, no mastered badge, link', async () => {
    const u = await signedUpUser(url);
    const c = cardById((await endgamesHtml(url, u.token)).html, 'philidor');
    assert.ok(c.text.includes('Philidor position'));
    assert.ok(c.text.includes('Hold the draw'));
    assert.equal(norm(c.streak), '0/3');
    assert.equal(norm(c.attempts), '0 attempts');
    assert.equal(c.mastered, null);
    assert.equal(c.href, '/endgames/philidor');
  });

  test('the kq-k card shows "Queen mate" and "Win"', async () => {
    const u = await signedUpUser(url);
    const c = cardById((await endgamesHtml(url, u.token)).html, 'kq-k');
    assert.ok(c.text.includes('Queen mate'));
    assert.ok(c.text.includes('Win'));
    assert.ok(!c.text.includes('Hold the draw'));
  });
});

describe('progress', () => {
  test('3 passes then a failure on lucena: Mastered, 0/3, 4 attempts, level 3 shows 1/4 mastered', async () => {
    const u = await signedUpUser(url);
    for (let i = 0; i < 3; i++) await passAttempt(url, u.token, 'lucena');
    await failAttempt(url, u.token, 'lucena');
    const html = (await endgamesHtml(url, u.token)).html;
    const c = cardById(html, 'lucena');
    assert.equal(norm(c.mastered ?? ''), 'Mastered');
    assert.equal(norm(c.streak), '0/3');
    assert.equal(norm(c.attempts), '4 attempts');
    assert.equal(norm(levelsOf(html)[2].count), '1/4 mastered');
  });

  test('1 pass on kr-k: 1/3 and "1 attempt"', async () => {
    const u = await signedUpUser(url);
    await passAttempt(url, u.token, 'kr-k');
    const c = cardById((await endgamesHtml(url, u.token)).html, 'kr-k');
    assert.equal(norm(c.streak), '1/3');
    assert.equal(norm(c.attempts), '1 attempt');
    assert.equal(c.mastered, null);
  });

  test('5 passes in a row on kq-k: the streak shows 3/3', async () => {
    const u = await signedUpUser(url);
    for (let i = 0; i < 5; i++) await passAttempt(url, u.token, 'kq-k');
    const c = cardById((await endgamesHtml(url, u.token)).html, 'kq-k');
    assert.equal(norm(c.streak), '3/3');
    assert.equal(norm(c.attempts), '5 attempts');
  });
});

describe('French', () => {
  test('titles, counts, goals and names are in French', async () => {
    const u = await signedUpUser(url);
    const html = (await endgamesHtml(url, u.token, { lang: 'fr' })).html;
    const levels = levelsOf(html);
    const titles = ['Mats élémentaires', 'Finales de pions', 'Finales de tours', 'Finales difficiles'];
    titles.forEach((t, i) => assert.ok(levels[i].text.includes(t), `${t} in ${levels[i].text}`));
    assert.equal(norm(levels[0].count), '0/4 maîtrisées');
    assert.ok(cardById(html, 'kq-k').text.includes('Gagner'));
    assert.ok(cardById(html, 'philidor').text.includes('Tenir la nulle'));
    assert.ok(cardById(html, 'lucena').text.includes('Position de Lucena'));
    assert.equal(norm(cardById(html, 'lucena').attempts), '0 essais');
  });

  test('French singular "1 essai" and "Maîtrisée" badge', async () => {
    const u = await signedUpUser(url);
    await passAttempt(url, u.token, 'kr-k');
    for (let i = 0; i < 3; i++) await passAttempt(url, u.token, 'lucena');
    const html = (await endgamesHtml(url, u.token, { lang: 'fr' })).html;
    assert.equal(norm(cardById(html, 'kr-k').attempts), '1 essai');
    assert.equal(norm(cardById(html, 'lucena').mastered ?? ''), 'Maîtrisée');
  });
});
