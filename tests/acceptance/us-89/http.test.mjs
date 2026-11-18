// US-89: the openings home /openings over HTTP (server-rendered page) against the built app.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { signedUpUser } from '../support/accounts.mjs';
import { startServer } from '../support/server.mjs';
import { addLine } from '../support/repertoire.mjs';
import { cardOf, fieldOf, homeAsVisitor, homeHtml, redirectTarget } from '../support/openings-home.mjs';

let app, url;
before(async () => { app = await startServer(); url = app.url; });
after(async () => app?.stop());

describe('access', () => {
  test('a signed-out visitor opening /openings is redirected 303 to /login?next=%2Fopenings', async () => {
    const r = await homeAsVisitor(url);
    assert.equal(r.status, 303);
    assert.equal(redirectTarget(url, r.location), '/login?next=%2Fopenings');
  });
});

describe('a new user', () => {
  test('both cards show openings-empty and an edit link to /openings/white and /openings/black', async () => {
    const u = await signedUpUser(url);
    const r = await homeHtml(url, u.token);
    assert.equal(r.status, 200);
    for (const colour of ['white', 'black']) {
      const card = cardOf(r.html, colour);
      assert.ok(card, `${colour} card`);
      assert.equal(fieldOf(card, 'openings-empty')?.text, 'No repertoire yet');
      assert.equal(fieldOf(card, `openings-edit-${colour}`)?.href, `/openings/${colour}`);
    }
  });

  test('an empty colour card shows no positions, due or learned counts', async () => {
    const u = await signedUpUser(url);
    const card = cardOf((await homeHtml(url, u.token)).html, 'black');
    assert.ok(card, 'black card');
    for (const testid of ['openings-positions', 'openings-due', 'openings-learned']) {
      assert.equal(fieldOf(card, testid), null, testid);
    }
  });
});

describe('a white repertoire with e4, e5 (opponent) and Nf3 added today', () => {
  const setup = async () => {
    const u = await signedUpUser(url);
    await addLine(url, u.token, 'white', ['e2e4', 'e7e5', 'g1f3']);
    return u;
  };

  test('the white card shows "2 positions", "2 due today" and "0 learned"', async () => {
    const card = cardOf((await homeHtml(url, (await setup()).token)).html, 'white');
    assert.equal(fieldOf(card, 'openings-positions')?.text, '2 positions');
    assert.equal(fieldOf(card, 'openings-due')?.text, '2 due today');
    assert.equal(fieldOf(card, 'openings-learned')?.text, '0 learned');
  });

  test('drill-start of the white card links to /openings/drill?colour=white', async () => {
    const card = cardOf((await homeHtml(url, (await setup()).token)).html, 'white');
    assert.equal(fieldOf(card, 'drill-start')?.href, '/openings/drill?colour=white');
  });

  test('the black card still shows openings-empty', async () => {
    const card = cardOf((await homeHtml(url, (await setup()).token)).html, 'black');
    assert.equal(fieldOf(card, 'openings-empty')?.text, 'No repertoire yet');
  });

  test('drill-start-both links to /openings/drill?colour=both', async () => {
    const r = await homeHtml(url, (await setup()).token);
    assert.equal(fieldOf(r.html, 'drill-start-both')?.href, '/openings/drill?colour=both');
  });

  test('with the lang cookie fr, the white card reads "2 à revoir aujourd\'hui"', async () => {
    const r = await homeHtml(url, (await setup()).token, { lang: 'fr' });
    assert.equal(fieldOf(cardOf(r.html, 'white'), 'openings-due')?.text, "2 à revoir aujourd'hui");
  });

  test('with the lang cookie fr, an empty black card reads "Pas encore de répertoire"', async () => {
    const r = await homeHtml(url, (await setup()).token, { lang: 'fr' });
    assert.equal(fieldOf(cardOf(r.html, 'black'), 'openings-empty')?.text, 'Pas encore de répertoire');
  });
});
