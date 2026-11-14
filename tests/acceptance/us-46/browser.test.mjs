// US-46 (browser): the chessground board on /games/demo at 1024×768: orientation, FEN, free play by drag, click and
// typed moves, illegal moves, promotion, French texts, no request to another origin.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import {
  boardFen, boardOrientation, boardRanks, choosePromotion, clickSquare, dragPiece, invalidMoveShown, invalidMoveText,
  moveFieldAndMessageBoxes, moveFieldLabel, moveFieldValue, openDemo, pressEscape, promotionChoices,
  promotionChooserShown, typeMove, typeMoves,
} from '../support/board.mjs';
import { VIEWPORTS, launchBrowser, newVisitorPage, recordRequests } from '../support/pages.mjs';
import { startServer } from '../support/server.mjs';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const TO_PROMOTION = ['a4', 'b5', 'axb5', 'a6', 'bxa6', 'Bb7', 'axb7', 'Nc6'];

let app, browser;
before(async () => {
  app = await startServer();
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
  await app?.stop();
});

async function demo(lang = 'en') {
  const page = await newVisitorPage(browser, { baseUrl: app.url, lang, viewport: VIEWPORTS.desktop });
  const requests = recordRequests(page);
  await openDemo(page, app.url);
  return { page, requests };
}

describe('board at the start', () => {
  test('at 1024×768 the board has data-orientation white and the start FEN', async () => {
    const { page } = await demo();
    assert.equal(await boardOrientation(page), 'white');
    assert.equal(await boardFen(page), START);
    await page.context().close();
  });
});

describe('free play on the board', () => {
  test('dragging e2 to e4 plays it, then clicking g8 and f6 plays Nf6', async () => {
    const { page } = await demo();
    await dragPiece(page, 'e2', 'e4');
    assert.equal(await boardFen(page), AFTER_E4);
    await clickSquare(page, 'g8');
    await clickSquare(page, 'f6');
    assert.ok((await boardFen(page)).startsWith('rnbqkb1r/pppppppp/5n2/8/4P3'), await boardFen(page));
    await page.context().close();
  });

  test('dragging e2 to e5 (illegal) leaves the FEN unchanged', async () => {
    const { page } = await demo();
    await dragPiece(page, 'e2', 'e5');
    assert.equal(await boardFen(page), START);
    await page.context().close();
  });
});

describe('typed moves', () => {
  test('Nf3 (SAN) then g8f6 (UCI) typed with Enter are played and the field is cleared', async () => {
    const { page } = await demo();
    await typeMove(page, 'Nf3');
    assert.ok((await boardFen(page)).startsWith('rnbqkbnr/pppppppp/8/8/8/5N2'), await boardFen(page));
    assert.equal(await moveFieldValue(page), '');
    await typeMove(page, 'g8f6');
    assert.ok((await boardFen(page)).startsWith('rnbqkb1r/pppppppp/5n2/8/8/5N2'), await boardFen(page));
    assert.equal(await moveFieldValue(page), '');
    await page.context().close();
  });

  test('Ke2 shows "Illegal move" under the field and plays nothing; then e4 hides it and is played', async () => {
    const { page } = await demo();
    await typeMove(page, 'Ke2');
    assert.equal(await invalidMoveShown(page), true);
    assert.equal(await invalidMoveText(page), 'Illegal move');
    const { field, message } = await moveFieldAndMessageBoxes(page);
    assert.ok(message.y >= field.y + field.height - 2, `message top ${message.y} above field bottom ${field.y + field.height}`);
    assert.equal(await boardFen(page), START);
    await typeMove(page, 'e4');
    assert.equal(await invalidMoveShown(page), false);
    assert.equal(await boardFen(page), AFTER_E4);
    await page.context().close();
  });

  test('an unreadable move shows "Illegal move" and plays nothing', async () => {
    const { page } = await demo();
    await typeMove(page, 'hello');
    assert.equal(await invalidMoveShown(page), true);
    assert.equal(await invalidMoveText(page), 'Illegal move');
    assert.equal(await boardFen(page), START);
    await page.context().close();
  });
});

describe('promotion', () => {
  test('dragging the b7 pawn to a8 opens board-promotion with Q, R, B, N; board-promotion-n gives a white knight on a8', async () => {
    const { page } = await demo();
    await typeMoves(page, TO_PROMOTION);
    assert.equal((await boardRanks(page))[1], '1Ppppppp', 'the white pawn is on b7');
    await dragPiece(page, 'b7', 'a8');
    assert.equal(await promotionChooserShown(page), true);
    assert.deepEqual(await promotionChoices(page), ['q', 'r', 'b', 'n']);
    await choosePromotion(page, 'n');
    assert.equal((await boardRanks(page))[0], 'N2qkbnr');
    await page.context().close();
  });

  test('Escape in the promotion chooser gives a queen', async () => {
    const { page } = await demo();
    await typeMoves(page, TO_PROMOTION);
    await dragPiece(page, 'b7', 'a8');
    assert.equal(await promotionChooserShown(page), true);
    await pressEscape(page);
    assert.equal((await boardRanks(page))[0], 'Q2qkbnr');
    await page.context().close();
  });

  test('typing bxa8=Q promotes to a queen with no chooser shown', async () => {
    const { page } = await demo();
    await typeMoves(page, TO_PROMOTION);
    await typeMove(page, 'bxa8=Q');
    assert.ok((await boardRanks(page))[0].startsWith('Q2qkbnr'), (await boardRanks(page))[0]);
    assert.equal(await promotionChooserShown(page), false);
    await page.context().close();
  });
});

describe('French', () => {
  test('the move field is labelled "Saisir un coup" and an illegal move shows "Coup illégal"', async () => {
    const { page } = await demo('fr');
    assert.equal(await moveFieldLabel(page), 'Saisir un coup');
    await typeMove(page, 'Ke2');
    assert.equal(await invalidMoveText(page), 'Coup illégal');
    await page.context().close();
  });
});

describe('no third party', () => {
  test('loading /games/demo sends no request to another origin', async () => {
    const { page, requests } = await demo();
    assert.ok(requests.length > 0);
    const foreign = requests.filter((u) => !/^(data|blob|about):/.test(u) && new URL(u).origin !== app.url);
    assert.deepEqual(foreign, []);
    await page.context().close();
  });
});
