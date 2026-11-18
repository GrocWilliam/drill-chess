// US-110: GET /api/endgames/:id/reply?fen= relays the (fake) tablebase through a cache.
// The app is started with TABLEBASE_URL = the fake (support/fakes/server.mjs + fakes/tablebase.mjs): no real tablebase.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { Chess } from 'chess.js';
import { signedUpUser } from '../support/accounts.mjs';
import { askReply, tablebaseHitsFor, tablebaseRequestFens } from '../support/endgame-reply.mjs';
import { startFake } from '../support/fakes/server.mjs';
import { TABLEBASE_FENS } from '../support/fakes/tablebase.mjs';
import { startServer } from '../support/server.mjs';

const KQK_START = '8/8/8/4k3/8/8/8/3QK3 w - - 0 1'; // kq-k start: the player (white) to move
const PHILIDOR_START = '4k3/8/7r/3KP3/8/8/8/R7 b - - 0 1'; // philidor start: the player (black) to move
const SEVEN_PIECES = '8/pppp4/8/4k3/8/8/8/3QK3 b - - 0 1';
const EIGHT_PIECES = '8/ppppp3/8/4k3/8/8/8/3QK3 b - - 0 1';

let app, fake, url, U;
after(async () => {
  await app?.stop();
  await fake?.stop();
});
before(async () => {
  fake = await startFake();
  app = await startServer({ tablebaseUrl: fake.url });
  url = app.url;
  U = await signedUpUser(url);
});

describe('tablebase replies', () => {
  test('the FEN after 1.Qd4+ in kq-k → 200 {category loss, reply e5e6 Ke6, replyCategory win}', async () => {
    const r = await askReply(url, U.token, 'kq-k', TABLEBASE_FENS.kqkAfterQd4);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { category: 'loss', reply: { uci: 'e5e6', san: 'Ke6' }, replyCategory: 'win' });
  });

  test('a FEN asked twice gives the same answer and reaches the tablebase exactly once', async () => {
    const first = await askReply(url, U.token, 'kq-k', TABLEBASE_FENS.kqkAfterQd4);
    const second = await askReply(url, U.token, 'kq-k', TABLEBASE_FENS.kqkAfterQd4);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.deepEqual(second.body, first.body);
    assert.equal(await tablebaseHitsFor(fake, TABLEBASE_FENS.kqkAfterQd4), 1);
  });

  test('the same pieces with other move counters → the fake receives a new request', async () => {
    await askReply(url, U.token, 'kq-k', TABLEBASE_FENS.kqkAfterQd4);
    const r = await askReply(url, U.token, 'kq-k', TABLEBASE_FENS.kqkAfterQd4OtherCounters);
    assert.equal(r.status, 200);
    assert.equal(await tablebaseHitsFor(fake, TABLEBASE_FENS.kqkAfterQd4OtherCounters), 1);
    assert.equal(await tablebaseHitsFor(fake, TABLEBASE_FENS.kqkAfterQd4), 1);
  });

  test('syzygy-loss at the root and syzygy-win on the best move → category loss, replyCategory win', async () => {
    const r = await askReply(url, U.token, 'kq-k', TABLEBASE_FENS.kqkSyzygy);
    assert.equal(r.status, 200);
    assert.equal(r.body.category, 'loss');
    assert.equal(r.body.replyCategory, 'win');
    assert.deepEqual(r.body.reply, { uci: 'e6e5', san: 'Ke5' });
  });

  test('a position with no moves → reply null and replyCategory null', async () => {
    const r = await askReply(url, U.token, 'kq-k', TABLEBASE_FENS.kqkNoMoves);
    assert.equal(r.status, 200);
    assert.equal(r.body.reply, null);
    assert.equal(r.body.replyCategory, null);
  });

  test('7 pieces with the app to move is accepted (boundary of "at most 7")', async () => {
    const r = await askReply(url, U.token, 'kq-k', SEVEN_PIECES);
    assert.equal(r.status, 200);
    assert.equal(await tablebaseHitsFor(fake, SEVEN_PIECES), 1);
  });

  test('philidor (player black), a legal FEN with white to move, unscripted → 200 draw with a legal reply', async () => {
    const fen = '4k3/8/6r1/3KP3/8/8/8/R7 w - - 1 2';
    const r = await askReply(url, U.token, 'philidor', fen);
    assert.equal(r.status, 200);
    assert.equal(r.body.category, 'draw');
    assert.equal(r.body.replyCategory, 'draw');
    const legal = new Chess(fen).moves({ verbose: true }).map((m) => ({ uci: m.from + m.to + (m.promotion ?? ''), san: m.san }));
    assert.ok(legal.some((m) => m.uci === r.body.reply?.uci && m.san === r.body.reply?.san), JSON.stringify(r.body.reply));
  });
});

describe('invalid FENs', () => {
  const cases = [
    ['fen missing', 'kq-k', undefined],
    ['fen "garbage"', 'kq-k', 'garbage'],
    ['the player (white) to move: the kq-k start FEN', 'kq-k', KQK_START],
    ['the player (black) to move: the philidor start FEN', 'philidor', PHILIDOR_START],
    ['8 pieces', 'kq-k', EIGHT_PIECES],
  ];
  for (const [name, id, fen] of cases) {
    test(`${name} → 400 invalid_fen with field fen, and the fake receives no request`, async () => {
      const before = (await tablebaseRequestFens(fake)).length;
      const r = await askReply(url, U.token, id, fen);
      assert.equal(r.status, 400);
      assert.equal(r.body?.error?.code, 'invalid_fen');
      assert.equal(r.body.error.field, 'fen');
      assert.equal((await tablebaseRequestFens(fake)).length, before);
    });
  }
});

describe('errors', () => {
  test('unknown id with fen=garbage → 404 not_found', async () => {
    const r = await askReply(url, U.token, 'no-such-id', 'garbage');
    assert.equal(r.status, 404);
    assert.equal(r.body?.error?.code, 'not_found');
  });

  test('signed out → 401 unauthorized', async () => {
    const r = await askReply(url, null, 'kq-k', TABLEBASE_FENS.kqkAfterQd4);
    assert.equal(r.status, 401);
    assert.equal(r.body?.error?.code, 'unauthorized');
  });

  test('signed out on an unknown id → 401 (401 comes before 404)', async () => {
    const r = await askReply(url, null, 'no-such-id', 'garbage');
    assert.equal(r.status, 401);
  });

  test('the tablebase failing its next 2 requests → 502 tablebase_unavailable; asked again → 200 (not cached)', async () => {
    const fen = '8/8/8/8/3k4/8/8/3QK3 b - - 0 1';
    await fake.failTablebase(2);
    const failed = await askReply(url, U.token, 'kq-k', fen);
    assert.equal(failed.status, 502);
    assert.equal(failed.body?.error?.code, 'tablebase_unavailable');
    await fake.failTablebase(0);
    const hits = await tablebaseHitsFor(fake, fen);
    const again = await askReply(url, U.token, 'kq-k', fen);
    assert.equal(again.status, 200);
    assert.equal(again.body.category, 'draw');
    assert.equal(await tablebaseHitsFor(fake, fen), hits + 1);
  });
});
