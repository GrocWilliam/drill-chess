// US-91: POST /api/openings/cards/<id>/review and the /openings counts, against the built app on a disk database
// (card ids are read from the data directory while the app is stopped: see support/cards.mjs).
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { signedUpUser } from '../support/accounts.mjs';
import { restartableApp, reviewCorrect, reviewOver, usersWithCards, utcDay } from '../support/cards.mjs';
import { cardOf, fieldOf, homeHtml } from '../support/openings-home.mjs';
import { errorOf } from '../support/repertoire.mjs';

let app, first, second, third, fourth, fifth;
before(async () => {
  app = await restartableApp();
  [first, second, third, fourth, fifth] = await usersWithCards(app, [1, 1, 1, 2, 1]);
}, { timeout: 300000 });
after(async () => app?.stop());

const day = async (fn) => {
  // The UTC date may change while the request runs: accept the date before or after.
  const before = utcDay(1);
  const r = await fn();
  return { r, expected: [before, utcDay(1)] };
};

describe('a correct review', () => {
  test('→ 200 with card.reps 1, intervalDays 1, ease 2.6 and dueOn = today UTC + 1 day', async () => {
    const { r, expected } = await day(() => reviewCorrect(app.url, first.user.token, first.cards[0].id, true));
    assert.equal(r.status, 200);
    assert.equal(r.body.card.id, first.cards[0].id);
    assert.equal(r.body.card.reps, 1);
    assert.equal(r.body.card.intervalDays, 1);
    assert.equal(r.body.card.ease, 2.6);
    assert.ok(expected.includes(r.body.card.dueOn), r.body.card.dueOn);
  });
});

describe('a wrong review', () => {
  test('→ 200 with reps 0, intervalDays 1, ease 2.3 and dueOn today + 1', async () => {
    const { r, expected } = await day(() => reviewCorrect(app.url, second.user.token, second.cards[0].id, false));
    assert.equal(r.status, 200);
    assert.equal(r.body.card.reps, 0);
    assert.equal(r.body.card.intervalDays, 1);
    assert.equal(r.body.card.ease, 2.3);
    assert.ok(expected.includes(r.body.card.dueOn), r.body.card.dueOn);
  });
});

describe('a bad body', () => {
  test('{"correct": "yes"} → 400 invalid_body', async () => {
    const r = await reviewOver(app.url, third.user.token, third.cards[0].id, { correct: 'yes' });
    assert.equal(r.status, 400);
    assert.equal(errorOf(r).code, 'invalid_body');
  });

  test('a body that is not JSON → 400 invalid_body', async () => {
    const r = await reviewOver(app.url, third.user.token, third.cards[0].id, null, { raw: 'not json' });
    assert.equal(r.status, 400);
    assert.equal(errorOf(r).code, 'invalid_body');
  });
});

describe('access', () => {
  test('another user’s card id → 404', async () => {
    const r = await reviewCorrect(app.url, first.user.token, third.cards[0].id, true);
    assert.equal(r.status, 404);
  });

  test('an unknown UUID → 404', async () => {
    const r = await reviewCorrect(app.url, third.user.token, crypto.randomUUID(), true);
    assert.equal(r.status, 404);
  });

  test('abc → 404', async () => {
    const r = await reviewCorrect(app.url, third.user.token, 'abc', true);
    assert.equal(r.status, 404);
  });

  test('signed out → 401 unauthorized', async () => {
    const r = await reviewCorrect(app.url, null, third.cards[0].id, true);
    assert.equal(r.status, 401);
    assert.equal(errorOf(r).code, 'unauthorized');
  });

  test('the refused reviews left the card untouched: a first correct review still gives reps 1', async () => {
    const r = await reviewCorrect(app.url, third.user.token, third.cards[0].id, true);
    assert.equal(r.status, 200);
    assert.equal(r.body.card.reps, 1);
    assert.equal(r.body.card.ease, 2.6);
  });
});

describe('/openings', () => {
  test('a white repertoire with 2 cards, one reviewed correct → openings-due "1 due today"', async () => {
    const before = fieldOf(cardOf((await homeHtml(app.url, fourth.user.token)).html, 'white'), 'openings-due');
    assert.equal(before?.text, '2 due today');
    const r = await reviewCorrect(app.url, fourth.user.token, fourth.cards[0].id, true);
    assert.equal(r.status, 200);
    const card = cardOf((await homeHtml(app.url, fourth.user.token)).html, 'white');
    assert.equal(fieldOf(card, 'openings-due')?.text, '1 due today');
  });

  test('a card reviewed correct 3 times → openings-learned "1 learned"', async () => {
    const card0 = cardOf((await homeHtml(app.url, fifth.user.token)).html, 'white');
    assert.equal(fieldOf(card0, 'openings-learned')?.text, '0 learned');
    for (let i = 0; i < 3; i++) assert.equal((await reviewCorrect(app.url, fifth.user.token, fifth.cards[0].id, true)).status, 200);
    const card = cardOf((await homeHtml(app.url, fifth.user.token)).html, 'white');
    assert.equal(fieldOf(card, 'openings-learned')?.text, '1 learned');
    assert.equal(fieldOf(card, 'openings-due')?.text, '0 due today');
  });
});
