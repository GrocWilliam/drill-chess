// US-45: `make test` passes in a fresh checkout, with the Vitest tests of the review module.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeInFreshCheckout, repoFile } from '../support/repo.mjs';

test('given a fresh checkout, make test exits 0 and src/lib/server/review/index.test.ts exists', { timeout: 900000 }, () => {
  assert.notEqual(repoFile('src/lib/server/review/index.test.ts'), '', 'no src/lib/server/review/index.test.ts');
  const run = makeInFreshCheckout('test', 840000);
  assert.equal(run.code, 0, `make test failed:\n${run.output.slice(-8000)}`);
});
