import { describe, expect, it } from 'vitest';
import en from '../../i18n/en.json';
import fr from '../../i18n/fr.json';
import { validFen } from '../../chess/rules';
import { POSITIONS } from './positions';

describe('POSITIONS', () => {
  it('holds 20 legal positions with unique ids', () => {
    expect(POSITIONS).toHaveLength(20);
    expect(new Set(POSITIONS.map((p) => p.id)).size).toBe(20);
    for (const p of POSITIONS) expect(validFen(p.fen)).toBe(true);
  });

  it('has names and lessons in both catalogs', () => {
    for (const p of POSITIONS) {
      for (const cat of [en, fr] as Record<string, string>[]) {
        expect(cat[`endgame.${p.id}.name`]).toBeTruthy();
        const lesson = cat[`endgame.${p.id}.lesson`];
        expect(lesson).toMatch(/[.!?]$/);
        expect(lesson.split(/(?<=[.!?])\s+/).length).toBeLessThanOrEqual(3);
      }
      expect((en as Record<string, string>)[`endgame.${p.id}.lesson`]).not.toBe(
        (fr as Record<string, string>)[`endgame.${p.id}.lesson`]
      );
    }
  });

  it('catalogs share keys', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
  });
});
