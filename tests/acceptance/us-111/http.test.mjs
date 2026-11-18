// US-111: /endgames/[id] over HTTP.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { redirectTarget, signedUpUser } from '../support/accounts.mjs';
import { startServer } from '../support/server.mjs';
import { endgameFacts, endgamePageAsVisitor, endgamePageHtml, hasLinkTo } from '../support/endgame-play-page.mjs';
import { lessonText as lesson } from '../support/endgame-play-page.mjs';

let app, url;
before(async () => { app = await startServer(); url = app.url; });
after(async () => app?.stop());

test('a signed-out visitor is redirected to /login?next=%2Fendgames%2Fkq-k', async () => {
  const r = await endgamePageAsVisitor(url, 'kq-k');
  assert.ok([302, 303].includes(r.status), String(r.status));
  assert.equal(redirectTarget(url, r.location), '/login?next=%2Fendgames%2Fkq-k');
});

test('an unknown id answers 404 with an error page and a way back', async () => {
  const u = await signedUpUser(url);
  assert.equal((await endgamePageHtml(url, u.token, 'kq-k')).status, 200, 'a known id exists');
  const r = await endgamePageHtml(url, u.token, 'no-such-id');
  assert.equal(r.status, 404);
  assert.ok(hasLinkTo(r.html, '/endgames'), 'a link to /endgames');
});

test('kq-k shows its position, Queen mate, Win, the lesson, no moves and "Your move"', async () => {
  const u = await signedUpUser(url);
  const r = await endgamePageHtml(url, u.token, 'kq-k');
  assert.equal(r.status, 200);
  const f = endgameFacts(r.html);
  assert.equal(f.fen, '8/8/8/4k3/8/8/8/3QK3 w - - 0 1');
  assert.equal(f.orientation, 'white');
  assert.equal(f.name, 'Queen mate');
  assert.equal(f.goal, 'Win');
  assert.equal(f.lesson, lesson('en', 'kq-k'));
  assert.deepEqual(f.moves, []);
  assert.equal(f.status, 'Your move');
  assert.equal(f.backHref, '/endgames');
});
