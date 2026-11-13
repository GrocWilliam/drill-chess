// US-21: `make test` passes with the gateway's Vitest tests (Retry-After capped at 10 s, 1 s default, no retry on 404,
// a stall over 15 s fails as `unavailable`).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeInFreshCheckout, repoFile } from '../support/repo.mjs';

test('given the repository, make test exits 0, with the gateway Vitest tests of retries and timeouts', { timeout: 900000 }, () => {
  const t = repoFile('src/lib/server/gateway/http.test.ts');
  assert.notEqual(t, '', 'no src/lib/server/gateway/http.test.ts');
  assert.ok(/['"`]30['"`]/.test(t), 'a Retry-After of 30 is not tested');
  assert.ok(/404/.test(t), 'a 404 is not tested');
  assert.ok(/unavailable/.test(t), 'the unavailable failure is not tested');
  const run = makeInFreshCheckout('test', 840000);
  assert.equal(run.code, 0, `make test failed:\n${run.output.slice(-8000)}`);
});
