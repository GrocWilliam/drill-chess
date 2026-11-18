// Domain layer for the endgame data (US-107): positions, catalogs and the new rules.ts helpers.
import { readFileSync } from 'node:fs';
export { POSITIONS } from '../../../src/lib/server/endgames/positions';
export { validFen, insufficientMaterial, halfmoveClock } from '../../../src/lib/chess/rules';

const catalog = (lang: 'en' | 'fr'): Record<string, string> =>
  JSON.parse(readFileSync(new URL(`../../../src/lib/i18n/${lang}.json`, import.meta.url), 'utf8'));

export const catalogs = { en: catalog('en'), fr: catalog('fr') };
export const name = (lang: 'en' | 'fr', id: string) => catalogs[lang][`endgame.${id}.name`];
export const lesson = (lang: 'en' | 'fr', id: string) => catalogs[lang][`endgame.${id}.lesson`];
export const sentenceCount = (text: string) => text.split(/[.!?]+(?:\s+|$)/).filter((s) => s.trim()).length;
export const sideToMove = (fen: string) => fen.split(' ')[1];
