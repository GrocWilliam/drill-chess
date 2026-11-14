// US-46 (HTTP): the engine files are served, the public demo page, its noscript text, the landing link.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { fetchStatic, linksByTestId, openDemoPage, reviewNoscriptTexts, testIdCount } from '../support/demo.mjs';
import { startServer } from '../support/server.mjs';
import { visit } from '../support/visitor.mjs';

let app;
before(async () => (app = await startServer()));
after(async () => app?.stop());

describe('engine files', () => {
  test('GET /stockfish/stockfish.js and /stockfish/stockfish.wasm answer 200, the second as application/wasm', async () => {
    const js = await fetchStatic(app.url, '/stockfish/stockfish.js');
    assert.equal(js.status, 200);
    assert.ok(js.size > 0);
    const wasm = await fetchStatic(app.url, '/stockfish/stockfish.wasm');
    assert.equal(wasm.status, 200);
    assert.equal(wasm.contentType.split(';')[0].trim(), 'application/wasm');
    assert.ok(wasm.size > 0);
  });
});

describe('demo page signed out', () => {
  test('GET /games/demo answers 200 with the players, event, result, the board and the noscript moves', async () => {
    const r = await openDemoPage(app.url, { lang: 'en' });
    assert.equal(r.status, 200, `location: ${r.location}`);
    for (const t of ['Paul Morphy', 'Duke of Brunswick and Count Isouard', 'Paris 1858', '1-0']) assert.ok(r.text.includes(t), t);
    assert.equal(testIdCount(r.html, 'board'), 1);
    const noscript = reviewNoscriptTexts(r.html);
    assert.equal(noscript.length, 1, 'one <noscript> holds review-noscript');
    assert.ok(noscript[0].includes('Game analysis needs JavaScript.'), noscript[0]);
    assert.ok(noscript[0].includes('1. e4 e5 2. Nf3 d6'), noscript[0]);
  });

  test('with lang=fr the noscript text reads "L\'analyse de la partie nécessite JavaScript."', async () => {
    const r = await openDemoPage(app.url, { lang: 'fr' });
    assert.equal(r.status, 200);
    const noscript = reviewNoscriptTexts(r.html);
    assert.equal(noscript.length, 1);
    assert.ok(noscript[0].includes("L'analyse de la partie nécessite JavaScript."), noscript[0]);
  });
});

describe('landing page demo link', () => {
  test('English: a landing-demo link to /games/demo reads "Try the demo game"', async () => {
    const r = await visit(app.url, { cookies: { lang: 'en' } });
    assert.deepEqual(linksByTestId(r.html, 'landing-demo'), [{ text: 'Try the demo game', path: '/games/demo' }]);
  });

  test('French: the landing-demo link reads "Essayer la partie de démo"', async () => {
    const r = await visit(app.url, { cookies: { lang: 'fr' } });
    assert.deepEqual(linksByTestId(r.html, 'landing-demo'), [{ text: 'Essayer la partie de démo', path: '/games/demo' }]);
  });
});
