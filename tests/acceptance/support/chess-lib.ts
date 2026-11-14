// Domain layer for the pure chess code of src/lib/chess/ (US-44): imports and shared fixtures.
export * from '../../../src/lib/chess/rules';
export * from '../../../src/lib/chess/analysis';

export const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export const OPERA =
  '1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0';

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const repeat = <T>(v: T, n: number): T[] => Array.from({ length: n }, () => v);
export const operaEvalsFlat = () => [...repeat({ cp: 0 }, 33), { mate: 0 }];
