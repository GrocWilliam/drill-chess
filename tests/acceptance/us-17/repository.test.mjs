// US-17: `make test` passes with the Vitest tests of map-lichess.ts next to the code.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeInFreshCheckout, repoFile } from '../support/repo.mjs';

test('given a fresh checkout, make test exits 0, with the Vitest tests of map-lichess.ts', { timeout: 900000 }, () => {
  const t = repoFile('src/lib/server/games/map-lichess.test.ts');
  assert.notEqual(t, '', 'no src/lib/server/games/map-lichess.test.ts');
  assert.match(t, /Anonymous/, 'the anonymous opponent is not tested');
  assert.match(t, /Stockfish level 3/, 'the AI opponent is not tested');
  const run = makeInFreshCheckout('test', 840000);
  assert.equal(run.code, 0, `make test failed:\n${run.output.slice(-8000)}`);
});
