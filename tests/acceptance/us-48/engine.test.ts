// US-48: the pure engine helpers parseInfo and toWhite (Vitest).
import { describe, expect, it } from 'vitest';
import { parseInfo, toWhite } from '../support/engine-lib';

describe('given the engine helpers, when parseInfo is called', () => {
  it('reads a centipawn score: info depth 6 seldepth 8 multipv 1 score cp 34 nodes 1000 pv e2e4 → {cp: 34}', () => {
    expect(parseInfo('info depth 6 seldepth 8 multipv 1 score cp 34 nodes 1000 pv e2e4')).toEqual({ cp: 34 });
  });
  it('reads a mate score: info depth 6 score mate -2 pv e7e8q → {mate: -2}', () => {
    expect(parseInfo('info depth 6 score mate -2 pv e7e8q')).toEqual({ mate: -2 });
  });
  it('gives null for a line without a score: info string NNUE enabled', () => {
    expect(parseInfo('info string NNUE enabled')).toBeNull();
  });
});

describe('given the engine helpers, when toWhite is called', () => {
  it("turns Black's centipawns to White's view: toWhite({cp: 34}, 'b') → {cp: -34}", () => {
    expect(toWhite({ cp: 34 }, 'b')).toEqual({ cp: -34 });
  });
  it("turns Black's mate to White's view: toWhite({mate: 2}, 'b') → {mate: -2}", () => {
    expect(toWhite({ mate: 2 }, 'b')).toEqual({ mate: -2 });
  });
  it("keeps White's score: toWhite({cp: 34}, 'w') → {cp: 34}", () => {
    expect(toWhite({ cp: 34 }, 'w')).toEqual({ cp: 34 });
  });
});
