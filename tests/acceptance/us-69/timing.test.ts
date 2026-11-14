// US-69: getStats answers in under 1 s with 5,000 games and 1,000 analyses (60 plies each) for one user,
// plus 100 games of another user (Vitest on the process `db` with PGLITE_DATA_DIR=memory://; rows inserted directly
// in beforeAll, 120 s hook timeout).
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { addManyAnalyses, addManyGames, newUser, query, statsModule, timed } from '../support/stats-db';

let stats: Awaited<ReturnType<typeof statsModule>>;
let userId: string;
const now = new Date();

// 60 plies: marks cycle null, inaccuracy, null, mistake, null, blunder; phases 20 opening, 20 middlegame, 20 endgame.
const MARKS = Array.from({ length: 60 }, (_, i) => ([null, 'inaccuracy', null, 'mistake', null, 'blunder'] as const)[i % 6]);
const PHASES = Array.from({ length: 60 }, (_, i) => (i < 20 ? 'opening' : i < 40 ? 'middlegame' : 'endgame') as 'opening' | 'middlegame' | 'endgame');

beforeAll(async () => {
  vi.stubEnv('PGLITE_DATA_DIR', 'memory://');
  stats = await statsModule();
  userId = await newUser();
  const ids = await addManyGames(userId, 5000);
  await addManyAnalyses(userId, ids.slice(0, 1000), { marks: [...MARKS], phases: PHASES, accuracyWhite: 80, accuracyBlack: 70 });
  await addManyGames(await newUser(), 100);
}, 120_000);

describe('getStats performance', () => {
  it('5,000 games and 1,000 analyses: after a warm-up call, getStats(userId, all defaults) resolves in under 1000 ms', async () => {
    const defaults = () => stats.getStats(userId, stats.parseStatsFilters(query(''), now));
    const warm = await defaults();
    expect(warm.mistakes.games).toBe(1000);
    const { ms } = await timed(defaults);
    expect(ms).toBeLessThan(1000);
  });
});
