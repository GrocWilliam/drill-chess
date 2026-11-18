// Opening names from the Lichess chess-openings dataset (CC0). Imported by server code only: the dataset stays out of the client bundle.
import tsv from '../../../static/openings/openings.tsv?raw';
import { Chess } from 'chess.js';

export interface OpeningName {
  eco: string;
  name: string;
}
export interface OpeningIndex {
  /** Comma-joined UCI moves → the opening. */
  lines: Map<string, OpeningName>;
  /** The longest line, in plies. */
  maxPlies: number;
}

/** Parses the dataset (`eco\tname\tpgn` with a header line); each PGN is replayed once. Bad rows are skipped. */
export function parseOpenings(text: string): OpeningIndex {
  const lines = new Map<string, OpeningName>();
  let maxPlies = 0;
  const rows: { eco: string; name: string; sans: string[] }[] = [];
  for (const row of text.split('\n').slice(1)) {
    const [eco, name, pgn] = row.replace(/\r$/, '').split('\t');
    if (!eco || !name || !pgn) continue;
    rows.push({ eco, name, sans: pgn.split(/\s+/).filter((t) => t && !/^\d+\.+$/.test(t)) });
  }
  // Sorted by moves, neighbouring lines share long prefixes: one board walks the tree (undo to the common prefix).
  rows.sort((x, y) => {
    for (let i = 0; i < Math.min(x.sans.length, y.sans.length); i++) {
      if (x.sans[i] !== y.sans[i]) return x.sans[i] < y.sans[i] ? -1 : 1;
    }
    return x.sans.length - y.sans.length;
  });
  const chess = new Chess();
  let played: string[] = [];
  let uci: string[] = [];
  for (const { eco, name, sans } of rows) {
    let common = 0;
    while (common < played.length && common < sans.length && played[common] === sans[common]) common++;
    while (played.length > common) {
      chess.undo();
      played.pop();
      uci.pop();
    }
    try {
      for (let i = common; i < sans.length; i++) {
        const m = chess.move(sans[i]);
        played.push(sans[i]);
        uci.push(m.from + m.to + (m.promotion ?? ''));
      }
    } catch {
      continue; // a bad row: `played` stays a valid prefix of the board
    }
    if (!uci.length) continue;
    lines.set(uci.join(','), { eco, name });
    maxPlies = Math.max(maxPlies, uci.length);
  }
  return { lines, maxPlies };
}

/** The opening of the longest dataset line that is a prefix of `uci`, or null. */
export function matchOpening(index: OpeningIndex, uci: string[]): OpeningName | null {
  for (let n = Math.min(uci.length, index.maxPlies); n > 0; n--) {
    const found = index.lines.get(uci.slice(0, n).join(','));
    if (found) return found;
  }
  return null;
}

let index: OpeningIndex | undefined;

/** The opening of `moves` (UCI) from the committed dataset, built once per process. */
export function openingFor(moves: string[]): OpeningName | null {
  index ??= parseOpenings(tsv);
  return matchOpening(index, moves);
}

/** The longest line of the dataset, in plies (how many moves of a game `openingFor` needs). */
export function openingMaxPlies(): number {
  index ??= parseOpenings(tsv);
  return index.maxPlies;
}
