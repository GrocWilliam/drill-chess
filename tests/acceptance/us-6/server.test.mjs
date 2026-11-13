// US-6: the built app starts, answers /health, keeps its PGlite data across restarts and rejects invalid config.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildOnce, health, runUntilExit, startServer } from '../support/server.mjs';

test('build the app once', { timeout: 600000 }, () => buildOnce());

test('given the app built, node build with a free PORT and PGLITE_DATA_DIR=memory:// answers GET /health 200 {"status":"ok"} as JSON within 30 s', { timeout: 60000 }, async () => {
  const server = await startServer({ env: { PGLITE_DATA_DIR: 'memory://' }, timeoutMs: 30000 });
  try {
    const h = await health(server.url);
    assert.equal(h.status, 200);
    assert.match(h.contentType, /^application\/json\b/);
    assert.deepEqual(JSON.parse(h.body), { status: 'ok' });
  } finally {
    await server.stop();
  }
});

test('given PGLITE_DATA_DIR on a new temporary directory, the server answers /health 200 after a start, a stop and a second start', { timeout: 120000 }, async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'drill-chess-pglite-'));
  try {
    for (const start of ['first', 'second']) {
      const server = await startServer({ env: { PGLITE_DATA_DIR: dataDir }, timeoutMs: 30000 });
      try {
        const h = await health(server.url);
        assert.equal(h.status, 200, `${start} start`);
        assert.deepEqual(JSON.parse(h.body), { status: 'ok' }, `${start} start`);
      } finally {
        await server.stop();
      }
    }
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('given PORT=abc, node build exits non-zero within 10 s and stderr names PORT', { timeout: 30000 }, async () => {
  const run = await runUntilExit({ PORT: 'abc' }, 10000);
  assert.ok(run.exited, 'still running after 10 s');
  assert.notEqual(run.code, 0);
  assert.match(run.stderr, /Invalid env var PORT\b/);
});

test('given CHESSCOM_URL=not-a-url, node build exits non-zero within 10 s and stderr names CHESSCOM_URL', { timeout: 30000 }, async () => {
  const run = await runUntilExit({ CHESSCOM_URL: 'not-a-url' }, 10000);
  assert.ok(run.exited, 'still running after 10 s');
  assert.notEqual(run.code, 0);
  assert.match(run.stderr, /Invalid env var CHESSCOM_URL\b/);
});
