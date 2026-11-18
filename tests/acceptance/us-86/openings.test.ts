// US-86: openingFor and uciLine (pure, Vitest; no server needed).
import { describe, expect, it } from 'vitest';
import { chessOpenings, chessRules } from '../support/openings-db';

const NAJDORF = 'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6'.split(' ');
const split = (s: string) => s.split(' ');

describe('openingFor', () => {
  it('e2e4 c7c5 gives B20 Sicilian Defense', async () => {
    const { openingFor } = await chessOpenings();
    expect(openingFor(split('e2e4 c7c5'))).toEqual({ eco: 'B20', name: 'Sicilian Defense' });
  });

  it('the Najdorf line gives B90 Sicilian Defense: Najdorf Variation', async () => {
    const { openingFor } = await chessOpenings();
    expect(openingFor(NAJDORF)).toEqual({ eco: 'B90', name: 'Sicilian Defense: Najdorf Variation' });
  });

  it("a2a3 gives A00 Anderssen's Opening", async () => {
    const { openingFor } = await chessOpenings();
    expect(openingFor(['a2a3'])).toEqual({ eco: 'A00', name: "Anderssen's Opening" });
  });

  it('an empty move list gives null', async () => {
    const { openingFor } = await chessOpenings();
    expect(openingFor([])).toBeNull();
  });

  it('the Najdorf line followed by 5 more legal moves not in the dataset still gives B90 Najdorf (longest prefix)', async () => {
    const { openingFor } = await chessOpenings();
    const { positions } = await chessRules();
    const longer = positions('1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. a3 h6 7. h3 a5 8. b3 b6 9. g3 g6').moves.map((m) => m.uci);
    expect(longer.slice(0, 10)).toEqual(NAJDORF);
    expect(longer).toHaveLength(NAJDORF.length + 8);
    expect(openingFor(longer.slice(0, NAJDORF.length + 5))).toEqual({ eco: 'B90', name: 'Sicilian Defense: Najdorf Variation' });
  });
});

describe('uciLine', () => {
  it('uciLine(pgn, 3) returns the first 3 moves', async () => {
    const { uciLine } = await chessRules();
    expect(uciLine('1. e4 e5 2. Nf3 Nc6', 3)).toEqual(['e2e4', 'e7e5', 'g1f3']);
  });

  it('without maxPlies it returns all 4 moves', async () => {
    const { uciLine } = await chessRules();
    expect(uciLine('1. e4 e5 2. Nf3 Nc6')).toEqual(['e2e4', 'e7e5', 'g1f3', 'b8c6']);
  });
});
