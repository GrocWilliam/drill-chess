import { describe, expect, it } from 'vitest';
import {
  POSITIONS, validFen, insufficientMaterial, halfmoveClock, catalogs, name, lesson, sentenceCount, sideToMove,
} from '../support/endgames-lib';

// level | id | English | French | FEN | goal
const TABLE: [number, string, string, string, string, string][] = [
  [1, 'kq-k', 'Queen mate', 'Mat avec la dame', '8/8/8/4k3/8/8/8/3QK3 w - - 0 1', 'win'],
  [1, 'kr-k', 'Rook mate', 'Mat avec la tour', '8/8/8/4k3/8/8/8/R3K3 w - - 0 1', 'win'],
  [1, 'krr-k', 'Two rooks mate', 'Mat avec deux tours', '8/8/8/4k3/8/8/8/R3K2R w - - 0 1', 'win'],
  [1, 'kbb-k', 'Two bishops mate', 'Mat avec deux fous', '8/8/8/4k3/8/8/8/2B1KB2 w - - 0 1', 'win'],
  [2, 'kp-opposition', 'Opposition', "L'opposition", '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1', 'win'],
  [2, 'kp-key-squares', 'Key squares', 'Les cases clés', '8/8/3k4/8/8/3K4/3P4/8 w - - 0 1', 'win'],
  [2, 'kp-king-ahead', 'King in front of the pawn', 'Le roi devant le pion', '8/8/8/3k4/8/8/3PK3/8 w - - 0 1', 'win'],
  [2, 'kp-defence', 'Defending king and pawn', 'Défendre contre roi et pion', '4k3/8/8/4P3/4K3/8/8/8 b - - 0 1', 'draw'],
  [2, 'kp-defence-2', 'Holding the opposition', "Garder l'opposition", '8/8/4k3/8/4PK2/8/8/8 b - - 0 1', 'draw'],
  [2, 'square-rule', 'The square of the pawn', 'La règle du carré', '8/8/8/P7/4k3/8/8/7K b - - 0 1', 'draw'],
  [2, 'rook-pawn', 'Rook pawn fortress', 'La forteresse du pion tour', '8/k7/8/K7/P7/8/8/8 b - - 0 1', 'draw'],
  [3, 'lucena', 'Lucena position', 'Position de Lucena', '1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1', 'win'],
  [3, 'philidor', 'Philidor position', 'Position de Philidor', '4k3/8/7r/3KP3/8/8/8/R7 b - - 0 1', 'draw'],
  [3, 'philidor-early', 'Third-rank defence', 'La défense en troisième rangée', '4k3/8/r7/8/4P3/4K3/8/7R b - - 0 1', 'draw'],
  [3, 'vancura', 'Vancura position', 'Position de Vancura', 'R7/6k1/P4r2/8/8/8/8/K7 b - - 0 1', 'draw'],
  [4, 'kq-kr', 'Queen against rook', 'Dame contre tour', '8/8/8/8/8/3k4/2r5/K6Q w - - 0 1', 'win'],
  [4, 'kbn-k', 'Bishop and knight mate', 'Mat fou et cavalier', '8/8/8/4k3/8/8/8/1N2KB2 w - - 0 1', 'win'],
  [4, 'kr-kb', 'Rook against bishop', 'Tour contre fou', '8/8/8/4k3/8/3b4/8/R3K3 b - - 0 1', 'draw'],
  [4, 'kr-kn', 'Rook against knight', 'Tour contre cavalier', '8/8/8/4k3/4n3/8/8/R3K3 b - - 0 1', 'draw'],
  [4, 'kq-kp7', 'Queen against bishop pawn', 'Dame contre pion fou', '8/8/8/8/8/1K6/2pk4/7Q b - - 0 1', 'draw'],
];
const ids = TABLE.map((r) => r[1]);

describe('POSITIONS', () => {
  it('holds exactly the 20 entries, in order, with their ids, levels, goals and FENs', () => {
    expect(POSITIONS).toHaveLength(20);
    POSITIONS.forEach((p, i) => {
      const [level, id, , , fen, goal] = TABLE[i];
      expect(p.id).toBe(id);
      expect(p.level).toBe(level);
      expect(p.goal).toBe(goal);
      expect(p.fen).toBe(fen);
    });
  });

  it('holds 4, 7, 4 and 5 positions at levels 1 to 4', () => {
    const count = (l: number) => POSITIONS.filter((p) => p.level === l).length;
    expect([count(1), count(2), count(3), count(4)]).toEqual([4, 7, 4, 5]);
  });

  it('has a valid FEN for each position, the player to move', () => {
    for (const p of POSITIONS) {
      expect(validFen(p.fen), p.id).toBe(true);
      expect(sideToMove(p.fen), p.id).toBe(TABLE.find((r) => r[1] === p.id)![4].split(' ')[1]);
    }
    expect(POSITIONS.filter((p) => sideToMove(p.fen) === 'w')).toHaveLength(TABLE.filter((r) => r[4].includes(' w ')).length);
  });
});

describe('catalogs', () => {
  it('en.json holds the English name of each position', () => {
    for (const [, id, en] of TABLE) expect(name('en', id), id).toBe(en);
  });

  it('fr.json holds the French name of each position', () => {
    for (const [, id, , fr] of TABLE) expect(name('fr', id), id).toBe(fr);
  });

  it('holds a 1 to 3 sentence lesson per position, different in English and French', () => {
    for (const id of ids) {
      const en = lesson('en', id);
      const fr = lesson('fr', id);
      for (const text of [en, fr]) {
        expect(typeof text, id).toBe('string');
        expect(text.trim(), id).not.toBe('');
        expect(text.trim(), id).toMatch(/[.!?]$/);
        const n = sentenceCount(text);
        expect(n, `${id}: ${text}`).toBeGreaterThanOrEqual(1);
        expect(n, `${id}: ${text}`).toBeLessThanOrEqual(3);
      }
      expect(en, id).not.toBe(fr);
    }
  });

  it('has the same keys in en.json and fr.json', () => {
    expect(Object.keys(catalogs.en).sort()).toEqual(Object.keys(catalogs.fr).sort());
  });
});

describe('validFen', () => {
  it('rejects text that is not a FEN', () => expect(validFen('not a fen')).toBe(false));
  it('rejects a position without kings', () => expect(validFen('8/8/8/8/8/8/8/8 w - - 0 1')).toBe(false));
  it('rejects a position where the side not to move is in check', () => {
    expect(validFen('4k3/8/8/8/8/8/4R3/4K3 w - - 0 1')).toBe(false);
  });
});

describe('insufficientMaterial', () => {
  it('is true for two bare kings', () => expect(insufficientMaterial('8/8/8/4k3/8/8/8/4K3 w - - 0 1')).toBe(true));
  it('is false with a queen', () => expect(insufficientMaterial('8/8/8/4k3/8/8/8/3QK3 w - - 0 1')).toBe(false));
});

describe('halfmoveClock', () => {
  it('reads the halfmove clock of the FEN', () => {
    expect(halfmoveClock('8/8/8/4k3/8/8/8/3QK3 w - - 37 60')).toBe(37);
  });
});
