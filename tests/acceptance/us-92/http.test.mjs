// US-92: GET /api/openings/drill against the built app on a disk database (card ids are read from the data directory
// while the app is stopped, then some cards are reviewed so they are due tomorrow).
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { signedUpUser } from '../support/accounts.mjs';
import { restartableApp, utcDay } from '../support/cards.mjs';
import { expectedOpening } from '../support/openings.mjs';
import { errorOf } from '../support/repertoire.mjs';
import {
  addMoveAfter, buildRepertoire, cardOfMove, lineOf, movesOf, positionsOf, readCards, requestDrill, reviewAll,
} from '../support/drill.mjs';

const RUY = ['e2e4', 'e7e5', 'g1f3'];
const SICILIAN = ['e2e4', 'c7c5', 'g1f3'];
const BRANCH_A = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4'];
const CYCLE = ['g1f3', 'g8f6', 'f3g1', 'f6g8'];

let app;
const u = {};
let cards;
before(async () => {
  app = await restartableApp();
  for (const k of ['single', 'twoBranches', 'weighted', 'allReviewed', 'none', 'mixed', 'cycle', 'noEnd', 'other']) {
    u[k] = await signedUpUser(app.url);
  }
  await buildRepertoire(app.url, u.single.token, 'white', [RUY]);
  await buildRepertoire(app.url, u.twoBranches.token, 'white', [RUY, SICILIAN]);
  await buildRepertoire(app.url, u.weighted.token, 'white', [BRANCH_A, SICILIAN]);
  await buildRepertoire(app.url, u.allReviewed.token, 'white', [RUY]);
  await buildRepertoire(app.url, u.mixed.token, 'white', [['e2e4']]);
  await buildRepertoire(app.url, u.mixed.token, 'black', [['e2e4', 'e7e5']]);
  await buildRepertoire(app.url, u.cycle.token, 'white', [CYCLE.slice(0, 3)]);
  await addMoveAfter(app.url, u.cycle.token, 'white', CYCLE.slice(0, 3), CYCLE[3]); // back to the start position
  await buildRepertoire(app.url, u.noEnd.token, 'white', [['e2e4', 'e7e5']]);
  await buildRepertoire(app.url, u.other.token, 'white', [['d2d4']]);
  cards = await readCards(app, Object.values(u));
  // Branch B (1...c5 2.Nf3) of `weighted`: its card reviewed, so 0 due cards below it.
  await reviewAll(app.url, u.weighted.token, [cardOfMove(cards.get(u.weighted.email), 'white', ['e2e4', 'c7c5'], 'g1f3')]);
  await reviewAll(app.url, u.allReviewed.token, cards.get(u.allReviewed.email));
  await reviewAll(app.url, u.mixed.token, cards.get(u.mixed.email).filter((c) => c.colour === 'white'));
}, { timeout: 300000 });
after(async () => app?.stop());

describe('a white repertoire 1.e4 e5 2.Nf3, seed 1', () => {
  test('→ 200, colour white, moves e4 (player, card, due), e5 (opponent), Nf3 (player, due), opening of the dataset', async () => {
    const a = await requestDrill(app.url, u.single.token, { colour: 'white', seed: 1 });
    assert.equal(a.status, 200);
    assert.equal(a.body.colour, 'white');
    const mine = cards.get(u.single.email);
    assert.deepEqual(movesOf(a).map(({ uci, san, by, cardId, due }) => ({ uci, san, by, cardId, due })), [
      { uci: 'e2e4', san: 'e4', by: 'player', cardId: cardOfMove(mine, 'white', [], 'e2e4').id, due: true },
      { uci: 'e7e5', san: 'e5', by: 'opponent', cardId: null, due: false },
      { uci: 'g1f3', san: 'Nf3', by: 'player', cardId: cardOfMove(mine, 'white', ['e2e4', 'e7e5'], 'g1f3').id, due: true },
    ]);
    const expected = expectedOpening(RUY);
    assert.ok(expected, 'the dataset names 1.e4 e5 2.Nf3');
    assert.deepEqual({ eco: a.body.opening?.eco, name: a.body.opening?.name }, expected);
  });

  test('the same repertoire and seed, requested again → the identical answer', async () => {
    const first = await requestDrill(app.url, u.single.token, { colour: 'white', seed: 1 });
    const second = await requestDrill(app.url, u.single.token, { colour: 'white', seed: 1 });
    assert.equal(first.status, 200);
    assert.deepEqual(second.body, first.body);
  });
});

describe('opponent branches e5 2.Nf3 and c5 2.Nf3, both Nf3 cards due', () => {
  test('seeds 0 to 49 → both branches appear at least once', async () => {
    const seen = new Set();
    for (let seed = 0; seed < 50; seed++) {
      const a = await requestDrill(app.url, u.twoBranches.token, { colour: 'white', seed });
      assert.equal(a.status, 200, `seed ${seed}`);
      seen.add(lineOf(a).join(' '));
    }
    assert.ok(seen.has(RUY.join(' ')), `lines seen: ${[...seen].join(' | ')}`);
    assert.ok(seen.has(SICILIAN.join(' ')), `lines seen: ${[...seen].join(' | ')}`);
  });
});

describe('branch A with 3 due cards below, branch B with 0 (reviewed, due tomorrow)', () => {
  test('seeds 0 to 199 → branch A is picked between 60% and 95% of the time (weights 4:1)', async () => {
    let a = 0, b = 0;
    for (let seed = 0; seed < 200; seed++) {
      const r = await requestDrill(app.url, u.weighted.token, { colour: 'white', seed });
      assert.equal(r.status, 200, `seed ${seed}`);
      const line = lineOf(r);
      if (line[1] === 'e7e5') a++;
      else if (line[1] === 'c7c5') b++;
    }
    assert.equal(a + b, 200, `every line takes branch A or B (A ${a}, B ${b})`);
    assert.ok(a >= 120 && a <= 190, `branch A picked ${a} times of 200`);
  });
});

describe('no due card left', () => {
  test('every card of the white repertoire reviewed today → 200 {moves: [], nextDue: tomorrow UTC}', async () => {
    const before = utcDay(1);
    const a = await requestDrill(app.url, u.allReviewed.token, { colour: 'white' });
    assert.equal(a.status, 200);
    assert.deepEqual(a.body.moves, []);
    assert.ok([before, utcDay(1)].includes(a.body.nextDue), `nextDue ${a.body.nextDue}`);
  });

  test('a user with no repertoire, colour=both → 200 {moves: [], nextDue: null}', async () => {
    const a = await requestDrill(app.url, u.none.token, { colour: 'both' });
    assert.equal(a.status, 200);
    assert.deepEqual(a.body.moves, []);
    assert.equal(a.body.nextDue, null);
  });
});

describe('white all reviewed, black with due cards', () => {
  test('colour=both → colour black and the line holds a due player move (seeds 0 to 9 and no seed)', async () => {
    for (const seed of [undefined, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      const a = await requestDrill(app.url, u.mixed.token, { colour: 'both', seed });
      assert.equal(a.status, 200, `seed ${seed}`);
      assert.equal(a.body.colour, 'black', `seed ${seed}`);
      assert.ok(movesOf(a).some((m) => m.by === 'player' && m.due === true && m.cardId), `seed ${seed}: ${JSON.stringify(a.body.moves)}`);
    }
  });

  test('colour=white → moves is empty', async () => {
    const a = await requestDrill(app.url, u.mixed.token, { colour: 'white' });
    assert.equal(a.status, 200);
    assert.deepEqual(a.body.moves, []);
  });
});

describe('a repertoire whose moves transpose back to an earlier position (1.Nf3 Nf6 2.Ng1 Ng8)', () => {
  test('the line ends without repeating a position and the request answers within 1 s', async () => {
    for (const seed of [0, 1, 2]) {
      const a = await requestDrill(app.url, u.cycle.token, { colour: 'white', seed });
      assert.equal(a.status, 200, `seed ${seed}`);
      assert.ok(a.ms < 1000, `answered in ${Math.round(a.ms)} ms`);
      const line = lineOf(a);
      assert.ok(line.length >= 3 && line.length <= CYCLE.length, `line ${line.join(' ')}`);
      assert.deepEqual(line, CYCLE.slice(0, line.length));
      // No move is played from a position the line already went through.
      const visited = positionsOf(line).slice(0, -1);
      assert.equal(new Set(visited).size, visited.length, `line ${line.join(' ')}`);
    }
  });
});

describe('a line that does not end on a player move', () => {
  test('1.e4 e5 with nothing after e5 → the line ends after e5', async () => {
    const a = await requestDrill(app.url, u.noEnd.token, { colour: 'white', seed: 0 });
    assert.equal(a.status, 200);
    assert.deepEqual(lineOf(a), ['e2e4', 'e7e5']);
  });
});

describe('a bad query', () => {
  for (const [label, params] of [
    ['colour=red', { colour: 'red' }],
    ['no colour', { seed: 1 }],
    ['seed=-1', { colour: 'white', seed: -1 }],
    ['seed=abc', { colour: 'white', seed: 'abc' }],
    ['seed=1.5', { colour: 'white', seed: 1.5 }],
  ]) {
    test(`${label} → 400 invalid_query`, async () => {
      const a = await requestDrill(app.url, u.single.token, params);
      assert.equal(a.status, 400);
      assert.equal(errorOf(a).code, 'invalid_query');
    });
  }

  test('seed=0 (the smallest seed) → 200', async () => {
    const a = await requestDrill(app.url, u.single.token, { colour: 'white', seed: 0 });
    assert.equal(a.status, 200);
  });

  test('signed out → 401 unauthorized', async () => {
    const a = await requestDrill(app.url, null, { colour: 'white', seed: 1 });
    assert.equal(a.status, 401);
    assert.equal(errorOf(a).code, 'unauthorized');
  });
});

describe('user isolation', () => {
  test('user B drilling never gets user A’s moves or cards', async () => {
    const aCards = new Set(cards.get(u.single.email).map((c) => c.id));
    for (const colour of ['white', 'black', 'both']) {
      for (const seed of [0, 1, 2, 3, 4]) {
        const a = await requestDrill(app.url, u.other.token, { colour, seed });
        assert.equal(a.status, 200, `${colour} seed ${seed}`);
        assert.ok(movesOf(a).every((m) => !aCards.has(m.cardId)), `${colour} seed ${seed}`);
        if (colour === 'black') assert.deepEqual(a.body.moves, []);
        else assert.deepEqual(lineOf(a), ['d2d4'], `${colour} seed ${seed}`);
      }
    }
  });

  test('a user with no repertoire gets nothing although another user has one', async () => {
    const a = await requestDrill(app.url, u.none.token, { colour: 'white', seed: 1 });
    assert.equal(a.status, 200);
    assert.deepEqual(a.body.moves, []);
    assert.equal(a.body.nextDue, null);
  });
});
