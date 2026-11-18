// US-93: the server-rendered drill page /openings/drill (access, drill-none and its link, French texts).
// Card dates are set only through the review endpoint: a card reviewed correct today is due tomorrow (UTC).
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { signedUpUser, redirectTarget } from '../support/accounts.mjs';
import { startServer } from '../support/server.mjs';
import { utcDay } from '../support/cards.mjs';
import {
  drillAsVisitor, drillHtml, formatDay, nothingDueOf, pathOf, repertoireLine, reviewMovesCorrect,
} from '../support/drill-page.mjs';

let app, url;
before(async () => { app = await startServer(); url = app.url; }, { timeout: 300000 });
after(async () => app?.stop());

/** A user whose white repertoire 1.e4 e5 2.Nf3 has every card reviewed today (due tomorrow). */
async function whiteAllDueTomorrow() {
  const u = await signedUpUser(url);
  const moves = await repertoireLine(url, u.token, 'white', ['e2e4', 'e7e5', 'g1f3']);
  await reviewMovesCorrect(url, u.token, moves);
  return u;
}
/** The day may change between the review and the page: accept the format of tomorrow taken before or after. */
const tomorrows = (before, lang) => [formatDay(before, lang), formatDay(utcDay(1), lang)];

describe('access', () => {
  test('a signed-out visitor opening /openings/drill is redirected 303 to /login?next=%2Fopenings%2Fdrill', async () => {
    const r = await drillAsVisitor(url);
    assert.equal(r.status, 303);
    assert.equal(redirectTarget(url, r.location), '/login?next=%2Fopenings%2Fdrill');
  });
});

describe('nothing due at the start', () => {
  test('white cards all due tomorrow, ?colour=white: drill-none reads "Nothing to review until <tomorrow, en>" and links to /openings/white', async () => {
    const before = utcDay(1);
    const u = await whiteAllDueTomorrow();
    const r = await drillHtml(url, u, 'colour=white');
    assert.equal(r.status, 200);
    const none = nothingDueOf(r.html);
    assert.ok(none, 'drill-none is rendered by the server');
    const dates = tomorrows(before, 'en');
    assert.ok(dates.some((d) => none.text.includes(`Nothing to review until ${d}`)), `${none.text} (expected one of ${dates})`);
    assert.equal(pathOf(none.editHref), '/openings/white');
  });

  test('the same in French: "Rien à réviser avant le <tomorrow, fr>"', async () => {
    const before = utcDay(1);
    const u = await whiteAllDueTomorrow();
    const r = await drillHtml(url, u, 'colour=white', { lang: 'fr' });
    const none = nothingDueOf(r.html);
    assert.ok(none, 'drill-none is rendered by the server');
    const dates = tomorrows(before, 'fr');
    assert.ok(dates.some((d) => none.text.includes(`Rien à réviser avant le ${d}`)), `${none.text} (expected one of ${dates})`);
    assert.equal(pathOf(none.editHref), '/openings/white');
  });

  test('a user with no repertoire, ?colour=both: drill-none reads "Nothing to review yet" and links to /openings', async () => {
    const u = await signedUpUser(url);
    const r = await drillHtml(url, u, 'colour=both');
    assert.equal(r.status, 200);
    const none = nothingDueOf(r.html);
    assert.ok(none, 'drill-none is rendered by the server');
    assert.ok(none.text.includes('Nothing to review yet'), none.text);
    assert.equal(pathOf(none.editHref), '/openings');
  });

  test('the same in French: "Rien à réviser pour l\'instant"', async () => {
    const u = await signedUpUser(url);
    const r = await drillHtml(url, u, 'colour=both', { lang: 'fr' });
    const none = nothingDueOf(r.html);
    assert.ok(none, 'drill-none is rendered by the server');
    assert.ok(none.text.includes("Rien à réviser pour l'instant"), none.text);
    assert.equal(pathOf(none.editHref), '/openings');
  });

  test('a colour other than white or black (colour=red, none) means both: drill-none links to /openings', async () => {
    const u = await signedUpUser(url);
    for (const q of ['colour=red', '']) {
      const r = await drillHtml(url, u, q);
      assert.equal(r.status, 200, `query "${q}"`);
      const none = nothingDueOf(r.html);
      assert.ok(none, `drill-none for query "${q}"`);
      assert.equal(pathOf(none.editHref), '/openings', `query "${q}"`);
    }
  });

  test('with a due card, ?colour=white: no drill-none', async () => {
    const u = await signedUpUser(url);
    await repertoireLine(url, u.token, 'white', ['e2e4']);
    const r = await drillHtml(url, u, 'colour=white');
    assert.equal(r.status, 200);
    assert.equal(nothingDueOf(r.html), null);
  });
});
