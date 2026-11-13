// US-15: `make test` passes on a fresh checkout, with the Vitest tests of map-chesscom.ts and of countPlies (rules.ts)
// next to the code (the project's convention: `*.test.ts` beside the file it tests).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeInFreshCheckout, repoFile } from '../support/repo.mjs';

test('given a fresh checkout, make test exits 0, with the Vitest tests of map-chesscom.ts and of countPlies', { timeout: 900000 }, () => {
  assert.notEqual(repoFile('src/lib/server/games/map-chesscom.test.ts'), '', 'no src/lib/server/games/map-chesscom.test.ts');
  assert.match(repoFile('src/lib/chess/rules.test.ts'), /countPlies/, 'src/lib/chess/rules.test.ts does not test countPlies');
  const run = makeInFreshCheckout('test', 840000);
  assert.equal(run.code, 0, `make test failed:\n${run.output.slice(-8000)}`);
});
