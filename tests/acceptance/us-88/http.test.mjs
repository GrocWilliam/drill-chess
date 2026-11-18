// US-88: the repertoire editor /openings/<colour> over HTTP (server-rendered page) against the built app.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { signedUpUser } from '../support/accounts.mjs';
import { startServer } from '../support/server.mjs';
import { START_FEN, addLine, fenAfter } from '../support/repertoire.mjs';
import { expectedOpening } from '../support/openings.mjs';
import { boardOf, editorAsVisitor, editorHtml, emptyShown, listedMoves, nameOf, pathMoves, pathStartLine, positionOf } from '../support/repertoire-page.mjs';

let app, url;
before(async () => { app = await startServer(); url = app.url; });
after(async () => app?.stop());

describe('access', () => {
  test('a signed-out visitor opening /openings/white is redirected 303 to /login?next=%2Fopenings%2Fwhite', async () => {
    const r = await editorAsVisitor(url, 'white');
    assert.equal(r.status, 303);
    assert.equal(new URL(r.location, url).pathname + new URL(r.location, url).search, '/login?next=%2Fopenings%2Fwhite');
  });

  test('a signed-in user opening /openings/purple gets 404', async () => {
    const u = await signedUpUser(url);
    assert.equal((await editorHtml(url, u, 'purple')).status, 404);
  });
});

describe('the start position', () => {
  test('an empty white repertoire: start position oriented white, opening-moves-empty, name "Starting position"', async () => {
    const u = await signedUpUser(url);
    const r = await editorHtml(url, u, 'white');
    assert.equal(r.status, 200);
    const b = boardOf(r.html);
    assert.equal(positionOf(b.fen), positionOf(START_FEN));
    assert.equal(b.orientation, 'white');
    assert.ok(emptyShown(r.html));
    assert.equal(nameOf(r.html), 'Starting position');
  });

  test('/openings/black is oriented black', async () => {
    const u = await signedUpUser(url);
    const r = await editorHtml(url, u, 'black');
    assert.equal(boardOf(r.html).orientation, 'black');
  });
});

describe('the line in the URL', () => {
  test('a white repertoire 1.e4 c5, line=e2e4,c7c5: name holds B20 and "Sicilian Defense", the board shows 1.e4 c5', async () => {
    const u = await signedUpUser(url);
    await addLine(url, u.token, 'white', ['e2e4', 'c7c5']);
    const r = await editorHtml(url, u, 'white', { line: 'e2e4,c7c5' });
    const name = nameOf(r.html);
    assert.ok(name.includes('B20'), name);
    assert.ok(name.includes('Sicilian Defense'), name);
    assert.equal(positionOf(boardOf(r.html).fen), positionOf(fenAfter('e2e4', 'c7c5')));
  });

  test('line=e2e4,e7e5,e1e5,g1f3: cut at the first illegal move: the position after 1.e4 e5 and 2 path moves', async () => {
    const u = await signedUpUser(url);
    const r = await editorHtml(url, u, 'white', { line: 'e2e4,e7e5,e1e5,g1f3' });
    assert.equal(r.status, 200);
    assert.equal(positionOf(boardOf(r.html).fen), positionOf(fenAfter('e2e4', 'e7e5')));
    assert.equal(pathMoves(r.html).length, 2);
  });

  test('line=e2e4,e7e5,g1f3: the path shows e4 e5 Nf3 and each link goes to that point; the start link to the empty line', async () => {
    const u = await signedUpUser(url);
    const r = await editorHtml(url, u, 'white', { line: 'e2e4,e7e5,g1f3' });
    const path = pathMoves(r.html);
    assert.deepEqual(path.map((m) => m.text.replace(/^\d+\.+\s*/, '')), ['e4', 'e5', 'Nf3']);
    assert.deepEqual(path.map((m) => m.line), ['e2e4', 'e2e4,e7e5', 'e2e4,e7e5,g1f3']);
    assert.equal(pathStartLine(r.html), '');
  });
});

describe('the moves from the current position', () => {
  test('a stored e5 listed from line=e2e4: link to line=e2e4,e7e5, marked Opponent, with the dataset name of 1.e4 e5', async () => {
    const u = await signedUpUser(url);
    await addLine(url, u.token, 'white', ['e2e4', 'e7e5']);
    const r = await editorHtml(url, u, 'white', { line: 'e2e4' });
    const move = listedMoves(r.html).find((m) => m.uci === 'e7e5');
    assert.ok(move, 'e7e5 is listed');
    assert.equal(move.line, 'e2e4,e7e5');
    assert.equal(move.by, 'opponent');
    assert.ok(/\be5\b/.test(move.text), move.text);
    assert.ok(move.text.includes('Opponent'), move.text);
    const o = expectedOpening(['e2e4', 'e7e5']);
    assert.ok(move.text.includes(o.name), `${move.text} should hold ${o.name}`);
    assert.ok(!emptyShown(r.html));
  });

  test('a stored e4 from the start: listed with "You" (player) and its link one move deeper', async () => {
    const u = await signedUpUser(url);
    await addLine(url, u.token, 'white', ['e2e4']);
    const r = await editorHtml(url, u, 'white');
    const move = listedMoves(r.html).find((m) => m.uci === 'e2e4');
    assert.equal(move.by, 'player');
    assert.equal(move.line, 'e2e4');
    assert.ok(move.text.includes('You'), move.text);
  });
});

describe('French', () => {
  test('with the lang cookie fr: "Position de départ", and "Vous" / "Adversaire" for the moves', async () => {
    const u = await signedUpUser(url);
    await addLine(url, u.token, 'white', ['e2e4', 'e7e5']);
    const start = await editorHtml(url, u, 'white', { lang: 'fr' });
    assert.equal(nameOf(start.html), 'Position de départ');
    assert.ok(listedMoves(start.html).find((m) => m.uci === 'e2e4').text.includes('Vous'));
    const deeper = await editorHtml(url, u, 'white', { line: 'e2e4', lang: 'fr' });
    assert.ok(listedMoves(deeper.html).find((m) => m.uci === 'e7e5').text.includes('Adversaire'));
  });
});
