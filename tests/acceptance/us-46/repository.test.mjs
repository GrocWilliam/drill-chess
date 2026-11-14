// US-46: the Stockfish copy script, in a fresh checkout after `npm ci`.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { copyStockfish, freshCheckout, gitIgnores, installDependencies } from '../support/repo.mjs';

let checkout, install;
before(() => {
  checkout = freshCheckout();
  install = installDependencies(checkout);
});
after(() => checkout?.remove());

describe('copy-stockfish script', () => {
  test('in a fresh checkout after npm ci, node scripts/copy-stockfish.mjs exits 0, copies stockfish.js and stockfish.wasm to static/stockfish/, and they are git-ignored', () => {
    assert.equal(install.code, 0, install.output.slice(-4000));
    assert.equal(checkout.exists('static/stockfish/stockfish.js'), false, 'static/stockfish/ must not be committed');
    const run = copyStockfish(checkout);
    assert.equal(run.code, 0, run.output.slice(-4000));
    assert.equal(checkout.exists('static/stockfish/stockfish.js'), true);
    assert.equal(checkout.exists('static/stockfish/stockfish.wasm'), true);
    assert.equal(gitIgnores(checkout, 'static/stockfish/stockfish.js'), 0);
  });

  test('without the stockfish package the script exits 1 with a message', () => {
    assert.equal(install.code, 0, install.output.slice(-4000));
    checkout.move('node_modules/stockfish', 'node_modules/.stockfish-hidden');
    const run = copyStockfish(checkout);
    assert.equal(run.code, 1, run.output.slice(-4000));
    assert.ok(run.output.trim().length > 0, 'a message explains the failure');
  });
});
