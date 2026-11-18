// US-112 (browser): playing /endgames/<id> against tablebase replies and recording each attempt.
// The app runs with TABLEBASE_URL = the fake (support/fakes/server.mjs); its scripted lines are LINES of
// support/fakes/tablebase.mjs (unscripted FENs answer `draw`, the app replying with the first legal move).
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { signedUpUser } from '../support/accounts.mjs';
import { startFake } from '../support/fakes/server.mjs';
import { startServer } from '../support/server.mjs';
import { VIEWPORTS, horizontalScroll, launchBrowser, undersizedTargets } from '../support/pages.mjs';
import { tablebaseHitsFor, tablebaseRequestFens } from '../support/endgame-reply.mjs';
import { cardShown, openEndgames } from '../support/endgames-page.mjs';
import * as eg from '../support/endgame-play-page.mjs';

const { LINES, lineFens, holdingLine, afterFakeReply, sanShown } = eg;

let app, fake, url, browser;
before(async () => {
  fake = await startFake();
  app = await startServer({ tablebaseUrl: fake.url });
  url = app.url;
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
  await app?.stop();
  await fake?.stop();
});

const WELL_DONE = 'Well done';
const giveAway = (san) => `That move gives away the win: ${san}`;
const loses = (san) => `That move loses: ${san}`;
const placement = (fen) => fen.split(' ').slice(0, 4).join(' ');

async function withPage(id, fn, opts = {}) {
  const user = await signedUpUser(url);
  const page = await eg.endgamePlayPage(browser, url, user, opts);
  try {
    const posts = eg.attemptPosts(page, id);
    await eg.openEndgame(page, url, id);
    await fn(page, posts, user);
  } finally {
    await page.context().close();
  }
}

/** Plays every step of `line` but the last with its reply awaited; returns the moves list expected so far. */
async function playUpToLast(page, line) {
  const shown = [];
  for (const s of line.steps.slice(0, -1)) {
    await eg.playAndAwaitReply(page, s.move);
    shown.push(sanShown(s.move), sanShown(s.reply));
  }
  return shown;
}

describe('a win goal played to checkmate', () => {
  test('the app\'s replies appear on the board and in the moves list', () =>
    withPage('kq-k', async (page) => {
      const fens = lineFens(LINES.kqkMate);
      const shown = [];
      for (const [i, s] of LINES.kqkMate.steps.slice(0, -1).entries()) {
        await eg.playAndAwaitReply(page, s.move);
        shown.push(sanShown(s.move), sanShown(s.reply));
        assert.deepEqual(await eg.movesShown(page), shown, `after move ${i + 1}`);
        assert.equal(await eg.boardFen(page), fens[i].afterReply, `board after reply ${i + 1}`);
      }
    }));

  test('the status shows "Well done", the board takes no more moves, one POST {passed: true} answered with attempts 1, passes 1, streak 1', () =>
    withPage('kq-k', async (page, posts) => {
      const shown = await playUpToLast(page, LINES.kqkMate);
      await eg.playMove(page, 'Qh3');
      assert.equal(await eg.waitForStatus(page, WELL_DONE), WELL_DONE);
      assert.equal(await eg.moveCountAfterQuiet(page), shown.length + 1, 'no reply after mate');
      const fen = await eg.boardFen(page);
      await eg.tryToMove(page, 'f2', 'e2', 'Ke2');
      assert.equal(await eg.boardFen(page), fen, 'the board takes no more moves');
      assert.equal((await eg.movesShown(page)).length, shown.length + 1);
      const sent = await eg.settledPosts(posts, 1);
      assert.equal(sent.length, 1, 'exactly one POST');
      assert.deepEqual(sent[0].body, { passed: true });
      const answer = await sent[0].answer;
      assert.equal(answer?.attempts, 1);
      assert.equal(answer?.passes, 1);
      assert.equal(answer?.streak, 1);
    }));
});

describe('a win goal given away', () => {
  test('a move the fake scripts as draw: give-away status, move marked failing, no reply, no more moves, one POST {passed: false}', () =>
    withPage('kq-k', async (page, posts) => {
      await eg.playMove(page, 'Qg4');
      assert.equal(await eg.waitForStatus(page, giveAway('Qg4')), giveAway('Qg4'));
      assert.deepEqual(await eg.failedMoves(page), ['Qg4']);
      assert.equal(await eg.moveCountAfterQuiet(page), 1, 'no reply is played');
      assert.deepEqual(await eg.movesShown(page), ['Qg4']);
      const fen = await eg.boardFen(page);
      assert.equal(fen, lineFens(LINES.kqkGiveAway)[0].afterMove);
      await eg.tryToMove(page, 'e1', 'e2', 'Ke2');
      assert.equal(await eg.boardFen(page), fen, 'the board takes no more moves');
      const sent = await eg.settledPosts(posts, 1);
      assert.equal(sent.length, 1);
      assert.deepEqual(sent[0].body, { passed: false });
    }));

  test('a move that stalemates the black king: give-away status, no tablebase request for that FEN, one POST {passed: false}', () =>
    withPage('kq-k', async (page, posts) => {
      await playUpToLast(page, LINES.kqkStalemate);
      await eg.playMove(page, 'Qg3');
      assert.equal(await eg.waitForStatus(page, giveAway('Qg3')), giveAway('Qg3'));
      const stalemate = lineFens(LINES.kqkStalemate).at(-1).afterMove;
      const sent = await eg.settledPosts(posts, 1);
      const asked = (await tablebaseRequestFens(fake)).filter((f) => placement(f) === placement(stalemate));
      assert.deepEqual(asked, [], 'the fake got no request for the stalemate FEN');
      assert.equal(sent.length, 1);
      assert.deepEqual(sent[0].body, { passed: false });
    }));
});

describe('a draw goal held for 20 moves', () => {
  const line = holdingLine('8/8/8/4k3/4n3/8/8/R3K3 b - - 0 1', 20); // kr-kn, the fake says draw throughout

  test('after the 20th move the status shows "Well done" and one POST {passed: true} is sent', () =>
    withPage('kr-kn', async (page, posts) => {
      for (const san of line.slice(0, 19)) await eg.playAndAwaitReply(page, san);
      await eg.playMove(page, line[19]);
      assert.equal(await eg.waitForStatus(page, WELL_DONE), WELL_DONE);
      assert.equal(await eg.moveCountAfterQuiet(page), 39, 'no reply after the 20th move');
      const sent = await eg.settledPosts(posts, 1);
      assert.equal(sent.length, 1);
      assert.deepEqual(sent[0].body, { passed: true });
    }));

  test('after 19 player moves no attempt has been posted and the status is not "Well done"', () =>
    withPage('kr-kn', async (page, posts) => {
      for (const [i, san] of line.slice(0, 19).entries()) assert.equal(await eg.playAndAwaitReply(page, san), (i + 1) * 2);
      assert.equal(await eg.moveCountAfterQuiet(page), 38);
      assert.deepEqual(await eg.settledPosts(posts, 0), []);
      assert.notEqual(await eg.statusShown(page), WELL_DONE);
    }));
});

test('a draw goal with replies repeating a position three times passes, after a player move, before 20 moves', () =>
  withPage('kr-kn', async (page, posts) => {
    const shown = await playUpToLast(page, LINES.krknRepetition);
    assert.notEqual(await eg.statusShown(page), WELL_DONE, 'not passed before the third occurrence');
    await eg.playMove(page, 'Ke6');
    assert.equal(await eg.waitForStatus(page, WELL_DONE), WELL_DONE);
    assert.equal(await eg.moveCountAfterQuiet(page), shown.length + 1, 'no reply after the repetition');
    const sent = await eg.settledPosts(posts, 1);
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0].body, { passed: true });
  }));

test('philidor: a move the fake scripts as win for the app shows "That move loses: Rh1", marks it failing, one POST {passed: false}', () =>
  withPage('philidor', async (page, posts) => {
    await eg.playMove(page, 'Rh1');
    assert.equal(await eg.waitForStatus(page, loses('Rh1')), loses('Rh1'));
    assert.deepEqual(await eg.failedMoves(page), ['Rh1']);
    assert.equal(await eg.moveCountAfterQuiet(page), 1, 'no reply is played');
    const sent = await eg.settledPosts(posts, 1);
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0].body, { passed: false });
  }));

describe('a draw goal still holding', () => {
  for (const [category, key] of [['loss', 'philidorLossForApp'], ['blessed-loss', 'philidorBlessedLoss']]) {
    test(`a move the fake scripts as ${category} for the app: the game goes on with the app's reply`, () =>
      withPage('philidor', async (page, posts) => {
        const line = LINES[key];
        const first = line.steps[0];
        assert.equal(await eg.playAndAwaitReply(page, first.move), 2);
        assert.deepEqual(await eg.movesShown(page), [first.move, first.reply]);
        assert.equal(await eg.boardFen(page), lineFens(line)[0].afterReply);
        assert.deepEqual(await eg.failedMoves(page), []);
        assert.equal(await eg.playAndAwaitReply(page, line.steps[1].move), 4, 'the board takes the next move and the app replies');
        assert.deepEqual(await eg.settledPosts(posts, 0), [], 'the attempt has not ended');
      }));
  }
});

describe('the tablebase unavailable', () => {
  const KRKB_AFTER_KD5 = '8/8/8/3k4/8/3b4/8/R3K3 w - - 1 2';

  test('the status shows "The tablebase is unavailable." and "Try again" appears', () =>
    withPage('kr-kb', async (page) => {
      await fake.failTablebase(1);
      await eg.playMove(page, 'Kd4');
      const msg = 'The tablebase is unavailable.';
      assert.equal(await eg.waitForStatus(page, msg), msg);
      assert.equal(await eg.retryMoveShown(page), true);
      assert.equal(await eg.retryMoveLabel(page), 'Try again');
    }));

  test('pressing "Try again" asks for the same FEN again, plays the reply, the game goes on, nothing is posted', () =>
    withPage('kr-kb', async (page, posts) => {
      await fake.failTablebase(1);
      await eg.playMove(page, 'Kd5');
      assert.equal(await eg.retryMoveShown(page), true);
      assert.equal(await eg.boardFen(page), KRKB_AFTER_KD5);
      await eg.pressTryAgain(page);
      assert.equal(await eg.waitForMoveCount(page, 2), 2, 'the reply is played');
      assert.equal(await eg.boardFen(page), afterFakeReply(KRKB_AFTER_KD5));
      assert.equal(await tablebaseHitsFor(fake, KRKB_AFTER_KD5), 2, 'the same FEN asked again');
      const next = holdingLine(afterFakeReply(KRKB_AFTER_KD5), 1)[0];
      assert.equal(await eg.playAndAwaitReply(page, next), 4, 'the game goes on');
      assert.deepEqual(await eg.settledPosts(posts, 0), []);
    }));

  test('a French user sees "La base de finales est indisponible." and "Réessayer"', () =>
    withPage('kr-kb', async (page) => {
      await fake.failTablebase(1);
      await eg.playMove(page, 'Ke6');
      const msg = 'La base de finales est indisponible.';
      assert.equal(await eg.waitForStatus(page, msg), msg);
      assert.equal(await eg.retryMoveShown(page), true);
      assert.equal(await eg.retryMoveLabel(page), 'Réessayer');
    }, { lang: 'fr' }));
});

describe('Retry', () => {
  test('after 2 player moves, Retry restores the start FEN, empties the moves list, posts nothing; the next attempt posts exactly once', () =>
    withPage('kq-k', async (page, posts) => {
      for (const s of LINES.kqkMate.steps.slice(0, 2)) await eg.playAndAwaitReply(page, s.move);
      await eg.pressRetry(page);
      assert.equal(await eg.waitForMoveCount(page, 0), 0);
      assert.equal(await eg.boardFen(page), LINES.kqkMate.start);
      assert.deepEqual(await eg.movesShown(page), []);
      assert.deepEqual(await eg.settledPosts(posts, 0), [], 'Retry posts nothing');

      await eg.playMove(page, 'Qg4');
      assert.equal(await eg.waitForStatus(page, giveAway('Qg4')), giveAway('Qg4'));
      const sent = await eg.settledPosts(posts, 1);
      assert.equal(sent.length, 1, 'exactly one POST for the new attempt');
      assert.deepEqual(sent[0].body, { passed: false });
    }));
});

test('3 passes in a row through the page, then a fail: the kq-k card shows Mastered, 0/3 and 4 attempts', async () => {
  const user = await signedUpUser(url);
  const page = await eg.endgamePlayPage(browser, url, user);
  try {
    const posts = eg.attemptPosts(page, 'kq-k');
    for (let n = 1; n <= 3; n++) {
      await eg.openEndgame(page, url, 'kq-k');
      await playUpToLast(page, LINES.kqkMate);
      await eg.playMove(page, 'Qh3');
      assert.equal(await eg.waitForStatus(page, WELL_DONE), WELL_DONE, `pass ${n}`);
      await (await eg.settledPosts(posts, n))[n - 1]?.answer;
    }
    await eg.openEndgame(page, url, 'kq-k');
    await eg.playMove(page, 'Qg4');
    assert.equal(await eg.waitForStatus(page, giveAway('Qg4')), giveAway('Qg4'));
    await (await eg.settledPosts(posts, 4))[3]?.answer;
    assert.deepEqual(posts.map((p) => p.body), [{ passed: true }, { passed: true }, { passed: true }, { passed: false }]);
    await openEndgames(page, url);
    assert.deepEqual(await cardShown(page, 'kq-k'), { mastered: 'Mastered', streak: '0/3', attempts: '4 attempts' });
  } finally {
    await page.context().close();
  }
});

describe('French', () => {
  test('a French user who passes sees "Bien joué"', () =>
    withPage('kq-k', async (page) => {
      await playUpToLast(page, LINES.kqkMate);
      await eg.playMove(page, 'Qh3');
      assert.equal(await eg.waitForStatus(page, 'Bien joué'), 'Bien joué');
    }, { lang: 'fr' }));

  test('a French user whose win goal fails sees "Ce coup laisse échapper le gain : <SAN>"', () =>
    withPage('kq-k', async (page) => {
      await eg.playMove(page, 'Qg4');
      await eg.waitForMoveCount(page, 1);
      const [san] = await eg.movesShown(page);
      const msg = `Ce coup laisse échapper le gain : ${san}`;
      assert.equal(await eg.waitForStatus(page, msg), msg);
    }, { lang: 'fr' }));
});

test('every move the app plays equals the reply the endpoint returned', () =>
  withPage('kq-k', async (page) => {
    const answers = eg.replyAnswers(page, 'kq-k');
    await playUpToLast(page, LINES.kqkMate);
    const appMoves = (await eg.movesShown(page)).filter((_, i) => i % 2 === 1);
    const replied = answers.filter((a) => a.status === 200).map((a) => sanShown(a.body?.reply?.san ?? ''));
    assert.equal(appMoves.length, 5);
    assert.deepEqual(appMoves, replied);
  }));

describe('layout of /endgames/kq-kr during and after an attempt', () => {
  for (const [name, viewport, move] of [['375×812', VIEWPORTS.mobile, 'Qh7'], ['1024×768', VIEWPORTS.desktop, 'Qh6']]) {
    test(`at ${name}: no sideways scroll and every button and link ≥ 44×44px, with the unavailable message and Try again, then after the attempt`, () =>
      withPage('kq-kr', async (page) => {
        await fake.failTablebase(1);
        await eg.playMove(page, move);
        assert.equal(await eg.retryMoveShown(page), true);
        let s = await horizontalScroll(page);
        assert.ok(s.scrollWidth <= s.innerWidth, `during: ${JSON.stringify(s)}`);
        assert.deepEqual(await undersizedTargets(page), [], 'during');
        await eg.pressTryAgain(page);
        assert.equal(await eg.waitForStatus(page, giveAway(move)), giveAway(move));
        s = await horizontalScroll(page);
        assert.ok(s.scrollWidth <= s.innerWidth, `after: ${JSON.stringify(s)}`);
        assert.deepEqual(await undersizedTargets(page), [], 'after');
      }, { viewport }));
  }
});
