// US-45: getAnalysis returns the replacing analysis (Vitest on the review module, PGlite memory://).
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { reviewModule, userWithGame } from '../support/review-db';
import { analysisBody, dropAfterFirstMove, times, zerosBody } from '../support/review.mjs';

let review: Awaited<ReturnType<typeof reviewModule>>;

beforeAll(async () => {
  vi.stubEnv('PGLITE_DATA_DIR', 'memory://');
  review = await reviewModule();
});

describe('given G already analysed', () => {
  it("a second, different valid body: the answer reflects it and getAnalysis(U, G) returns the second one's depth and marks", async () => {
    const { userId, gameId, plies } = await userWithGame();
    const first = await review.saveAnalysis(userId, gameId, zerosBody(plies));
    expect(first.ok).toBe(true);
    const second = await review.saveAnalysis(
      userId, gameId, analysisBody({ depth: 9, evals: dropAfterFirstMove(plies, -1000), best: times(plies, null) }),
    );
    expect(second.ok).toBe(true);
    expect(second.marks[0]).toBe('blunder');
    const stored = await review.getAnalysis(userId, gameId);
    expect(stored?.depth).toBe(9);
    expect(stored?.marks).toEqual(second.marks);
    expect(stored?.marks[0]).toBe('blunder');
  });

  it('getAnalysis is null for a game never analysed', async () => {
    const { userId, gameId } = await userWithGame();
    expect(await review.getAnalysis(userId, gameId)).toBeNull();
  });
});
