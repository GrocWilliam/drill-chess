// US-50 (HTTP): the board page /games/<G> without JavaScript, and who may open it.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { redirectTarget, signedUpUser } from '../support/accounts.mjs';
import { noscriptBlocks } from '../support/game-page.mjs';
import { gameDetails, hasToken, openGame } from '../support/games.mjs';
import { startAppWithFakeSites } from '../support/links.mjs';
import { importedGame } from '../support/review.mjs';
import { visit } from '../support/visitor.mjs';

// G here is the fake's first alpha_pawn game (chess.com 100000001: Alpha_Pawn 1488 as Black beats made_up_rival 1432,
// `1. e4 c5 2. Nf3 d6 0-1`).
let env, user, g;
before(async () => {
  env = await startAppWithFakeSites();
  user = await signedUpUser(env.app.url);
  g = await importedGame(env.app.url, user);
});
after(async () => {
  await env?.stop();
});

describe('given U and GET /games/<G> (no JavaScript)', () => {
  let r;
  before(async () => {
    r = await openGame(env.app.url, user.token, g.id, { acceptLanguage: 'en' });
  });

  test('the page answers 200', () => {
    assert.equal(r.status, 200);
  });

  test('game-details holds both players, ratings and the result', () => {
    const d = gameDetails(r.html);
    for (const token of ['Alpha_Pawn', 'made_up_rival', '1432', '1488', 'Win']) {
      assert.ok(hasToken(d.text, token), `"${token}" missing from game-details: ${d.text}`);
    }
  });

  test('game-site-link links to the game on chess.com', () => {
    assert.equal(gameDetails(r.html).siteLinkHref, 'https://www.chess.com/game/live/100000001');
  });

  test('a <noscript> block holds "Game analysis needs JavaScript." and game-moves with the moves as text', () => {
    const blocks = noscriptBlocks(r.html);
    const block = blocks.find((b) => b.text.includes('Game analysis needs JavaScript.'));
    assert.ok(block, `no <noscript> block reads "Game analysis needs JavaScript.": ${JSON.stringify(blocks)}`);
    assert.notEqual(block.movesText, null, 'game-moves is not inside that <noscript> block');
    assert.ok(block.movesText.includes('1. e4 c5 2. Nf3 d6'), block.movesText);
  });
});

describe('who may open /games/<G>', () => {
  test('another signed-in user V gets 404', async () => {
    const v = await signedUpUser(env.app.url);
    assert.equal((await openGame(env.app.url, v.token, g.id)).status, 404);
  });

  test('a signed-out visitor gets 303 to /login?next=%2Fgames%2F<G>', async () => {
    const r = await visit(env.app.url, { path: `/games/${g.id}` });
    assert.equal(r.status, 303);
    assert.equal(redirectTarget(env.app.url, r.location), `/login?next=%2Fgames%2F${g.id}`);
  });
});
