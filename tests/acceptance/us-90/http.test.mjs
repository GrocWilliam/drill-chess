// US-90: DELETE /api/openings/<colour>/moves/<id> and the server-rendered delete modal, against the built app.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { signedUpUser } from '../support/accounts.mjs';
import { startServer } from '../support/server.mjs';
import { addLineIds, deleteMoveOver } from '../support/repertoire.mjs';
import { deleteLinks, deleteModalHtml, deleteModalOf, editorHtml, listedMoves } from '../support/repertoire-page.mjs';

let app, url;
before(async () => { app = await startServer(); url = app.url; });
after(async () => app?.stop());

const MAIN = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4'];
async function repertoire() {
  const u = await signedUpUser(url);
  const ids = await addLineIds(url, u.token, 'white', MAIN);
  const [c5, nf3] = await addLineIds(url, u.token, 'white', ['e2e4', 'c7c5', 'g1f3']).then((r) => [r[1], r[2]]);
  return { u, ids, c5, nf3 };
}

describe('DELETE a move', () => {
  test('the e5 move: 200 {removed: 4}; from e2e4 only c5 is listed', async () => {
    const { u, ids } = await repertoire();
    const r = await deleteMoveOver(url, u.token, 'white', ids[1]);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { removed: 4 });
    const page = await editorHtml(url, u, 'white', { line: 'e2e4' });
    assert.deepEqual(listedMoves(page.html).map((m) => m.uci), ['c7c5']);
  });

  test('transposition: Nc6 of the first order removes only 1, the moves from P stay', async () => {
    const u = await signedUpUser(url);
    const a = await addLineIds(url, u.token, 'white', ['e2e4', 'e7e5', 'g1f3', 'b8c6']);
    await addLineIds(url, u.token, 'white', ['e2e4', 'b8c6', 'g1f3', 'e7e5']);
    await addLineIds(url, u.token, 'white', ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4']);
    const r = await deleteMoveOver(url, u.token, 'white', a[3]);
    assert.deepEqual(r.body, { removed: 1 });
    const page = await editorHtml(url, u, 'white', { line: ['e2e4', 'b8c6', 'g1f3', 'e7e5'] });
    assert.deepEqual(listedMoves(page.html).map((m) => m.uci), ['f1c4']);
  });

  test('the e4 move: everything after it goes, the start lists nothing', async () => {
    const { u, ids } = await repertoire();
    const r = await deleteMoveOver(url, u.token, 'white', ids[0]);
    assert.deepEqual(r.body, { removed: 7 });
    const page = await editorHtml(url, u, 'white');
    assert.deepEqual(listedMoves(page.html), []);
  });
});

describe('DELETE refusals', () => {
  test('the white move id on the black path is 404', async () => {
    const { u, ids } = await repertoire();
    assert.equal((await deleteMoveOver(url, u.token, 'black', ids[1])).status, 404);
    assert.deepEqual(listedMoves((await editorHtml(url, u, 'white', { line: 'e2e4' })).html).map((m) => m.uci).sort(), ['c7c5', 'e7e5']);
  });

  test("another user's move id is 404 and the move stays", async () => {
    const { u, ids } = await repertoire();
    const other = await signedUpUser(url);
    assert.equal((await deleteMoveOver(url, other.token, 'white', ids[1])).status, 404);
    assert.ok(listedMoves((await editorHtml(url, u, 'white', { line: 'e2e4' })).html).some((m) => m.uci === 'e7e5'));
  });

  test('an unknown UUID and "abc" are 404', async () => {
    const { u } = await repertoire();
    assert.equal((await deleteMoveOver(url, u.token, 'white', crypto.randomUUID())).status, 404);
    assert.equal((await deleteMoveOver(url, u.token, 'white', 'abc')).status, 404);
  });

  test('signed out: 401 unauthorized', async () => {
    const { ids } = await repertoire();
    const r = await deleteMoveOver(url, null, 'white', ids[1]);
    assert.equal(r.status, 401);
    assert.equal(r.body?.error?.code, 'unauthorized');
  });
});

describe('the delete modal over HTTP', () => {
  test('each listed move has an opening-delete link to ?line=…&modal=opening-delete&move=<id>', async () => {
    const { u, ids } = await repertoire();
    const page = await editorHtml(url, u, 'white', { line: 'e2e4' });
    const e5 = deleteLinks(page.html).find((l) => l.uci === 'e7e5');
    assert.ok(e5?.href, 'e5 has an opening-delete link');
    const q = new URL(e5.href, url).searchParams;
    assert.equal(q.get('line'), 'e2e4');
    assert.equal(q.get('modal'), 'opening-delete');
    assert.equal(q.get('move'), ids[1]);
  });

  test('modal-opening-delete is an open dialog saying e5 and the 3 moves after it (4 removed), with confirm and cancel', async () => {
    const { u, ids } = await repertoire();
    const r = await deleteModalHtml(url, u, 'white', 'e2e4', ids[1]);
    assert.equal(r.status, 200);
    const m = deleteModalOf(r.html);
    assert.ok(m, 'modal-opening-delete is rendered');
    assert.ok(m.open, 'it is an open <dialog>');
    assert.ok(/Delete e5 and the 3 moves after it\?/.test(m.text), m.text);
    assert.ok(r.html.includes('data-testid="opening-delete-confirm"'));
    assert.ok(r.html.includes('data-testid="opening-delete-cancel"'));
  });

  test('a single move reads in the singular: Delete Bc4? has no moves after it', async () => {
    const { u, ids } = await repertoire();
    const m = deleteModalOf((await deleteModalHtml(url, u, 'white', 'e2e4,e7e5,g1f3,b8c6', ids[4])).html);
    assert.ok(m?.text.includes('Bc4'), m?.text);
    assert.ok(!/\d+ moves/.test(m.text), m.text);
  });

  test('with the lang cookie fr the modal text is French', async () => {
    const { u, ids } = await repertoire();
    const m = deleteModalOf((await deleteModalHtml(url, u, 'white', 'e2e4', ids[1], { lang: 'fr' })).html);
    assert.ok(m, 'modal rendered');
    assert.ok(/supprim/i.test(m.text), m.text);
    assert.ok(!/Delete|moves after/.test(m.text), m.text);
    assert.ok(m.text.includes('e5') && /\b3\b/.test(m.text), m.text);
  });

  test('without the modal parameters no modal-opening-delete is rendered', async () => {
    const { u } = await repertoire();
    assert.equal(deleteModalOf((await editorHtml(url, u, 'white', { line: 'e2e4' })).html), null);
  });
});
