// US-106: the documentation edits leave the us-43, us-70 and us-85 acceptance tests passing. Each folder's own run.sh
// is run as CI runs it (same environment: FORGE_PREBUILT, CHROMIUM_PATH, PLAYWRIGHT_DIR), and its exit status decides.
// NODE_TEST_CONTEXT is dropped: inside a `node --test` run it makes the child `node --test` skip its files and exit 0.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const withoutTestContext = ({ NODE_TEST_CONTEXT, ...env }) => env;

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

for (const story of ['us-43', 'us-70', 'us-85']) {
  test(`given the repository, when the ${story} acceptance tests run, then they still pass`, () => {
    const run = spawnSync('bash', [join('tests', 'acceptance', story, 'run.sh')], {
      cwd: root,
      env: withoutTestContext(process.env),
      encoding: 'utf8',
      timeout: 900_000,
    });
    const output = `${run.stdout ?? ''}${run.stderr ?? ''}`.split('\n').slice(-40).join('\n');
    assert.equal(run.error, undefined, `${story} run.sh did not run: ${run.error}`);
    assert.equal(run.status, 0, `${story} run.sh exited ${run.status}; last output:\n${output}`);
  });
}
