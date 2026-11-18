// Domain layer for the opening names of the Lichess chess-openings dataset (US-86). Reads and setup only: no
// assertion of a criterion here. The expected names come from the committed dataset, replayed with chess.js
// (independently of the app's own index).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Chess } from 'chess.js';
import { repoFile } from './repo.mjs';
import { buildOnce, repoRoot } from './server.mjs';

export const DATASET = 'static/openings/openings.tsv';

/** The text of the committed dataset ('' when absent). */
export const datasetText = () => repoFile(DATASET);

/** The data rows of the dataset: [{ eco, name, pgn }] (the header line and empty lines left out). */
export function datasetRows() {
  const lines = datasetText().split('\n').map((l) => l.replace(/\r$/, ''));
  return lines.slice(1).filter((l) => l.trim() !== '').map((l) => {
    const [eco, name, pgn] = l.split('\t');
    return { eco, name, pgn };
  });
}

const uciOf = (pgn) => {
  const c = new Chess();
  c.loadPgn(pgn);
  return c.history({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ''));
};

let lines = null;
/** The dataset lines with their UCI moves, replayed once. */
function indexed() {
  lines ??= datasetRows().map((r) => ({ ...r, uci: uciOf(r.pgn) }));
  return lines;
}

// Replaying the dataset blocks this process for seconds: do it when the module loads, not between two requests,
// or the keep-alive sockets of the tests' fetch go stale and a request fails with "other side closed".
indexed();

/** { eco, name } of the dataset line with the longest move sequence that is a prefix of `uci`, or null. */
export function expectedOpening(uci) {
  let best = null;
  for (const l of indexed()) {
    if (l.uci.length === 0 || l.uci.length > uci.length || (best && l.uci.length <= best.uci.length)) continue;
    if (l.uci.every((m, i) => m === uci[i])) best = l;
  }
  return best && { eco: best.eco, name: best.name };
}

/** The same for a game given as a PGN movetext such as `1. e4 e5 2. Nf3 Nc6`. */
export const expectedOpeningOfMoves = (movetext) => expectedOpening(uciOf(movetext));

/** The files of the built client bundle (`build/client`) whose text holds `needle`: relative paths. */
export function clientFilesContaining(needle) {
  buildOnce();
  const root = join(repoRoot, 'build/client');
  if (!existsSync(root)) throw new Error('setup: build/client does not exist');
  const found = [];
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (readFileSync(p).includes(needle)) found.push(p.slice(root.length + 1));
    }
  };
  walk(root);
  return found;
}

/** The row of /games (listedGames) that mentions `token` as a whole word, or undefined. */
export const rowWith = (rows, token) => rows.find((r) => r.text.split(/[\s  ]+/).includes(token));
