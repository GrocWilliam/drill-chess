// US-6: what the repository holds: licence, Dockerfile, project memory, and a `make test` that passes.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeInFreshCheckout, packageJson, repoFile } from '../support/repo.mjs';

test('LICENSE holds the SPDX line and the GPL-3.0 URL, and package.json has license GPL-3.0-or-later', () => {
  const license = repoFile('LICENSE');
  assert.ok(
    license.split(/\r?\n/).some((line) => line.trim() === 'SPDX-License-Identifier: GPL-3.0-or-later'),
    'LICENSE has no line "SPDX-License-Identifier: GPL-3.0-or-later"',
  );
  assert.ok(license.includes('https://www.gnu.org/licenses/gpl-3.0.txt'), 'LICENSE lacks the GPL-3.0 URL');
  assert.equal(packageJson().license, 'GPL-3.0-or-later');
});

test('Dockerfile names node:26-bookworm-slim and port 8080', () => {
  const dockerfile = repoFile('Dockerfile');
  assert.ok(dockerfile.includes('node:26-bookworm-slim'), 'Dockerfile lacks node:26-bookworm-slim');
  assert.ok(dockerfile.includes('8080'), 'Dockerfile lacks 8080');
});

test('CLAUDE.md links docs/prd.md, docs/architecture.md and docs/ui.md', () => {
  const memory = repoFile('CLAUDE.md');
  for (const path of ['docs/prd.md', 'docs/architecture.md', 'docs/ui.md']) assert.ok(memory.includes(path), `CLAUDE.md lacks ${path}`);
});

test('given a fresh checkout, make test exits 0', { timeout: 900000 }, () => {
  const run = makeInFreshCheckout('test', 840000);
  assert.equal(run.code, 0, `make test failed:\n${run.output.slice(-8000)}`);
});
