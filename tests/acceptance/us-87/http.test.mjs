// US-87: POST /api/openings/<colour>/moves over HTTP against the built app.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { signedUpUser } from '../support/accounts.mjs';
import { startServer } from '../support/server.mjs';
import { START_FEN, addLine, addMoveOver, errorOf, fenAfter, fillWhiteRepertoire, postMove } from '../support/repertoire.mjs';

let app, url;
after(async () => app?.stop());
before(async () => {
  app = await startServer();
  url = app.url;
});

describe('signed out', () => {
  test('POST /api/openings/white/moves → 401 unauthorized', async () => {
    const a = await addMoveOver(url, null, 'white', START_FEN, 'e2e4');
    assert.equal(a.status, 401);
    assert.equal(errorOf(a).code, 'unauthorized');
  });
});

describe('adding moves', () => {
  test('the first move 1.e4 → 201 {move: {id, uci, san, by: player}}', async () => {
    const u = await signedUpUser(url);
    const a = await addMoveOver(url, u.token, 'white', START_FEN, 'e2e4');
    assert.equal(a.status, 201);
    assert.ok(a.body.move.id);
    assert.equal(a.body.move.uci, 'e2e4');
    assert.equal(a.body.move.san, 'e4');
    assert.equal(a.body.move.by, 'player');
  });

  test('the same body again → 200 with the same move id', async () => {
    const u = await signedUpUser(url);
    const first = await addMoveOver(url, u.token, 'white', START_FEN, 'e2e4');
    const again = await addMoveOver(url, u.token, 'white', START_FEN, 'e2e4');
    assert.equal(again.status, 200);
    assert.equal(again.body.move.id, first.body.move.id);
    assert.equal(again.body.move.san, 'e4');
    assert.equal(again.body.move.by, 'player');
  });

  test('1.e4 then e5 from the position after 1.e4 → 201 by opponent', async () => {
    const u = await signedUpUser(url);
    await addMoveOver(url, u.token, 'white', START_FEN, 'e2e4');
    const a = await addMoveOver(url, u.token, 'white', fenAfter('e2e4'), 'e7e5');
    assert.equal(a.status, 201);
    assert.equal(a.body.move.by, 'opponent');
  });

  test('any number of opponent moves from one position: e5, c5, then c6 → 201 each', async () => {
    const u = await signedUpUser(url);
    await addMoveOver(url, u.token, 'white', START_FEN, 'e2e4');
    const after1 = fenAfter('e2e4');
    for (const uci of ['e7e5', 'c7c5', 'c7c6']) {
      const a = await addMoveOver(url, u.token, 'white', after1, uci);
      assert.equal(a.status, 201, uci);
      assert.equal(a.body.move.by, 'opponent');
    }
  });

  test('a second player move from the same position → 409 player_move_exists "Delete e4 first to choose another move here"', async () => {
    const u = await signedUpUser(url);
    await addMoveOver(url, u.token, 'white', START_FEN, 'e2e4');
    const a = await addMoveOver(url, u.token, 'white', START_FEN, 'd2d4');
    assert.equal(a.status, 409);
    assert.equal(errorOf(a).code, 'player_move_exists');
    assert.equal(errorOf(a).message, 'Delete e4 first to choose another move here');
  });

  test('a black repertoire: e2e4 from the start is by opponent, then c7c5 is by player', async () => {
    const u = await signedUpUser(url);
    const a = await addMoveOver(url, u.token, 'black', START_FEN, 'e2e4');
    assert.equal(a.status, 201);
    assert.equal(a.body.move.by, 'opponent');
    const b = await addMoveOver(url, u.token, 'black', fenAfter('e2e4'), 'c7c5');
    assert.equal(b.status, 201);
    assert.equal(b.body.move.by, 'player');
  });
});

describe('errors', () => {
  test('uci e2e5 from the start → 400 illegal_move, field uci', async () => {
    const u = await signedUpUser(url);
    const a = await addMoveOver(url, u.token, 'white', START_FEN, 'e2e5');
    assert.equal(a.status, 400);
    assert.equal(errorOf(a).code, 'illegal_move');
    assert.equal(errorOf(a).field, 'uci');
  });

  test("fromFen 'not a fen' → 400 illegal_move", async () => {
    const u = await signedUpUser(url);
    const a = await addMoveOver(url, u.token, 'white', 'not a fen', 'e2e4');
    assert.equal(a.status, 400);
    assert.equal(errorOf(a).code, 'illegal_move');
  });

  test('a legal move from a position no repertoire move reaches → 400 unknown_position, field fromFen', async () => {
    const u = await signedUpUser(url);
    await addMoveOver(url, u.token, 'white', START_FEN, 'e2e4');
    const a = await addMoveOver(url, u.token, 'white', fenAfter('d2d4', 'd7d5'), 'c2c4');
    assert.equal(a.status, 400);
    assert.equal(errorOf(a).code, 'unknown_position');
    assert.equal(errorOf(a).field, 'fromFen');
  });

  test('a non-JSON body → 400 invalid_body', async () => {
    const u = await signedUpUser(url);
    const a = await postMove(url, u.token, 'white', null, { raw: 'this is not json' });
    assert.equal(a.status, 400);
    assert.equal(errorOf(a).code, 'invalid_body');
  });

  test('a missing uci → 400 invalid_body', async () => {
    const u = await signedUpUser(url);
    const a = await postMove(url, u.token, 'white', { fromFen: START_FEN });
    assert.equal(a.status, 400);
    assert.equal(errorOf(a).code, 'invalid_body');
  });

  test('/api/openings/green/moves → 404', async () => {
    const u = await signedUpUser(url);
    const a = await postMove(url, u.token, 'green', { fromFen: START_FEN, uci: 'e2e4' });
    assert.equal(a.status, 404);
  });
});

describe('transpositions', () => {
  test('a player move from the position shared by both move orders → 409 player_move_exists naming the existing move', async () => {
    const u = await signedUpUser(url);
    const added = await addLine(url, u.token, 'white', ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4']);
    assert.deepEqual(added.map((a) => a.status), [201, 201, 201, 201, 201]);
    const shared = fenAfter('g1f3', 'b8c6', 'e2e4', 'e7e5');
    const a = await addMoveOver(url, u.token, 'white', shared, 'f1b5');
    assert.equal(a.status, 409);
    assert.equal(errorOf(a).code, 'player_move_exists');
    assert.equal(errorOf(a).message, 'Delete Bc4 first to choose another move here');
  });
});

describe('2,000 player moves', () => {
  test('one more player move → 409 repertoire_full, and opponent moves are still accepted', async () => {
    const u = await signedUpUser(url);
    const { pending, spare } = await fillWhiteRepertoire(async (fen, uci) => {
      const a = await addMoveOver(url, u.token, 'white', fen, uci);
      return a.status === 201 ? 'created' : a.status === 200 ? 'exists' : `${a.status} ${errorOf(a).code}`;
    }, 2000);
    const full = await addMoveOver(url, u.token, 'white', pending.fen, pending.uci);
    assert.equal(full.status, 409);
    assert.equal(errorOf(full).code, 'repertoire_full');
    const opp = await addMoveOver(url, u.token, 'white', spare.fen, spare.uci);
    assert.equal(opp.status, 201);
    assert.equal(opp.body.move.by, 'opponent');
  });
});
