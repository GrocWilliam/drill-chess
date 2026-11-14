// US-45: POST /api/games/:id/analysis (HTTP). G is the fake chess.com game 100000001 of alpha_pawn, imported for U.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { signedUpUser } from '../support/accounts.mjs';
import { startAppWithFakeSites } from '../support/links.mjs';
import { health } from '../support/server.mjs';
import {
  analysisBody, dropAfterFirstMove, errorOf, importedGame, postAnalysis, times, withEntry, zeros, zerosBody,
} from '../support/review.mjs';

let env, url, U, V, G, P;
after(async () => env?.stop());

before(async () => {
  env = await startAppWithFakeSites();
  url = env.app.url;
  U = await signedUpUser(url);
  V = await signedUpUser(url);
  G = await importedGame(url, U);
  P = G.plies;
});

const post = (body, opts) => postAnalysis(url, U.token, G.id, body, opts);
const nulls = () => times(P, null);
const dropBody = (cp) => analysisBody({ evals: dropAfterFirstMove(P, cp), best: nulls() });
/** The accuracy the story states for White when its first move loses 25.11 and the others nothing. */
const expectedWhiteAfterDrop = () => Math.round((103.1668 * Math.exp(-0.04354 * (25.11 / G.whiteMoves)) - 3.1669) * 10) / 10;

describe('a valid analysis', () => {
  test('zeros and P × null best → 201 {marks: P × null, accuracyWhite: 100, accuracyBlack: 100}', async () => {
    const r = await post(zerosBody(P));
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.deepEqual(r.body.marks, nulls());
    assert.equal(r.body.accuracyWhite, 100);
    assert.equal(r.body.accuracyBlack, 100);
  });

  test('{cp: 0} then P × {cp: -300}: marks[0] mistake, others null, accuracyBlack 100, accuracyWhite from the formula (±0.1)', async () => {
    const r = await post(dropBody(-300));
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.marks.length, P);
    assert.equal(r.body.marks[0], 'mistake');
    assert.deepEqual(r.body.marks.slice(1), times(P - 1, null));
    assert.equal(r.body.accuracyBlack, 100);
    assert.ok(Math.abs(r.body.accuracyWhite - expectedWhiteAfterDrop()) <= 0.1, `accuracyWhite ${r.body.accuracyWhite}, expected ${expectedWhiteAfterDrop()}`);
  });

  test('with {cp: -1000} marks[0] is blunder; with {cp: -150} inaccuracy; with {cp: -100} null', async () => {
    for (const [cp, want] of [[-1000, 'blunder'], [-150, 'inaccuracy'], [-100, null]]) {
      const r = await post(dropBody(cp));
      assert.equal(r.status, 201, `cp ${cp}: ${JSON.stringify(r.body)}`);
      assert.equal(r.body.marks[0], want, `cp ${cp}`);
    }
  });

  test("the -300 body with best[0] = G's first move in UCI: marks[0] null, accuracyWhite unchanged", async () => {
    const without = await post(dropBody(-300));
    const body = dropBody(-300);
    body.best = withEntry(body.best, 0, G.firstMoveUci);
    const r = await post(body);
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.marks[0], null);
    assert.equal(r.body.accuracyWhite, without.body.accuracyWhite);
  });

  test("marks sent by the browser are ignored: zeros body with marks P × blunder → all marks null", async () => {
    const r = await post({ ...zerosBody(P), marks: times(P, 'blunder') });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.deepEqual(r.body.marks, nulls());
  });

  test('G already analysed, a second different body → the answer reflects the second body', async () => {
    const u = await signedUpUser(url);
    const g = await importedGame(url, u);
    const first = await postAnalysis(url, u.token, g.id, zerosBody(g.plies));
    assert.equal(first.status, 201, JSON.stringify(first.body));
    const second = await postAnalysis(url, u.token, g.id, analysisBody({ depth: 8, evals: dropAfterFirstMove(g.plies, -1000), best: times(g.plies, null) }));
    assert.equal(second.status, 201, JSON.stringify(second.body));
    assert.equal(second.body.marks[0], 'blunder');
    assert.ok(second.body.accuracyWhite < 100, String(second.body.accuracyWhite));
  });
});

describe('counts against the PGN', () => {
  test('evals with P or P + 2 entries → 400 invalid_analysis, field evals', async () => {
    for (const n of [P, P + 2]) {
      const r = await post(analysisBody({ evals: times(n, { cp: 0 }), best: nulls() }));
      assert.equal(r.status, 400, `${n} evals`);
      assert.deepEqual(errorOf(r), { code: 'invalid_analysis', field: 'evals' }, `${n} evals`);
    }
  });

  test('best with P - 1 entries → 400, field best', async () => {
    const r = await post(analysisBody({ evals: zeros(P), best: times(P - 1, null) }));
    assert.equal(r.status, 400);
    assert.deepEqual(errorOf(r), { code: 'invalid_analysis', field: 'best' });
  });
});

describe('depth', () => {
  test('depth 0, 31, 6.5, "6" or missing → 400, field depth', async () => {
    for (const depth of [0, 31, 6.5, '6', undefined]) {
      const body = { ...zerosBody(P), depth };
      if (depth === undefined) delete body.depth;
      const r = await post(body);
      assert.equal(r.status, 400, `depth ${JSON.stringify(depth)}`);
      assert.deepEqual(errorOf(r), { code: 'invalid_analysis', field: 'depth' }, `depth ${JSON.stringify(depth)}`);
    }
  });

  test('depth 1 and 30 are accepted (201)', async () => {
    for (const depth of [1, 30]) {
      const r = await post({ ...zerosBody(P), depth });
      assert.equal(r.status, 201, `depth ${depth}: ${JSON.stringify(r.body)}`);
    }
  });
});

describe('evals', () => {
  test('one eval {cp: 100001}, {cp: 1.5}, {mate: 251}, {cp: 0, mate: 1} or {} → 400, field evals', async () => {
    for (const ev of [{ cp: 100001 }, { cp: 1.5 }, { mate: 251 }, { cp: 0, mate: 1 }, {}]) {
      const r = await post(analysisBody({ evals: withEntry(zeros(P), 1, ev), best: nulls() }));
      assert.equal(r.status, 400, JSON.stringify(ev));
      assert.deepEqual(errorOf(r), { code: 'invalid_analysis', field: 'evals' }, JSON.stringify(ev));
    }
  });

  test('{cp: -100000} and {mate: -250} are accepted (201)', async () => {
    for (const ev of [{ cp: -100000 }, { mate: -250 }]) {
      const r = await post(analysisBody({ evals: withEntry(zeros(P), 1, ev), best: nulls() }));
      assert.equal(r.status, 201, `${JSON.stringify(ev)}: ${JSON.stringify(r.body)}`);
    }
  });
});

describe('best', () => {
  test('one best entry "e2e9", "" or "e7e8k" → 400, field best', async () => {
    for (const b of ['e2e9', '', 'e7e8k']) {
      const r = await post(analysisBody({ evals: zeros(P), best: withEntry(nulls(), 1, b) }));
      assert.equal(r.status, 400, JSON.stringify(b));
      assert.deepEqual(errorOf(r), { code: 'invalid_analysis', field: 'best' }, JSON.stringify(b));
    }
  });

  test('"e7e8q" is accepted (201)', async () => {
    const r = await post(analysisBody({ evals: zeros(P), best: withEntry(nulls(), 1, 'e7e8q') }));
    assert.equal(r.status, 201, JSON.stringify(r.body));
  });
});

describe('the body', () => {
  test('`not json` or `[]` → 400, field body', async () => {
    for (const raw of ['not json', '[]']) {
      const r = await post(null, { raw });
      assert.equal(r.status, 400, raw);
      assert.deepEqual(errorOf(r), { code: 'invalid_analysis', field: 'body' }, raw);
    }
  });
});

describe('who may post', () => {
  test('no session cookie, a valid body → 401 {error: {code: unauthorized}}', async () => {
    const r = await postAnalysis(url, null, G.id, zerosBody(P));
    assert.equal(r.status, 401);
    assert.equal(errorOf(r).code, 'unauthorized');
  });

  test("another signed-in user V posting for G → 404 not_found", async () => {
    const r = await postAnalysis(url, V.token, G.id, zerosBody(P));
    assert.equal(r.status, 404);
    assert.equal(errorOf(r).code, 'not_found');
  });

  test('U posting to an unknown UUID or to /api/games/abc/analysis → 404 not_found', async () => {
    for (const id of ['00000000-0000-4000-8000-000000000000', 'abc']) {
      const r = await postAnalysis(url, U.token, id, zerosBody(P));
      assert.equal(r.status, 404, id);
      assert.equal(errorOf(r).code, 'not_found', id);
    }
  });
});

describe('the migration', () => {
  // The container itself is built by the forge after the merge; here the server is started directly.
  test('the server started on a fresh database answers GET /health with 200', async () => {
    assert.equal((await health(url))?.status, 200);
  });
});
