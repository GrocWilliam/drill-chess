// US-47 (HTTP): the ply of /games/demo is read from ?ply and clamped, with and without JavaScript.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { readDemoHtml } from '../support/replay.mjs';
import { startServer } from '../support/server.mjs';

let app;
before(async () => { app = await startServer(); });
after(async () => { await app?.stop(); });

describe('the current ply in the HTML', () => {
  for (const [raw, expected] of [['40', 33], ['-3', null], ['abc', null], ['5', 5]]) {
    test(`?ply=${raw} gives ${expected === null ? 'ply 0 (no current move)' : 'ply ' + expected}`, async () => {
      const r = await readDemoHtml(app.url, raw);
      assert.equal(r.status, 200);
      assert.equal(r.currentPly, expected);
    });
  }
});
