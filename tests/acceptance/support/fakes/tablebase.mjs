// Fake Lichess tablebase (US-110): GET /standard?fen=<FEN> in the Lichess format. Root `category` is for the side to
// move; each `moves[i].category` is for the side to move after that move; `moves` is sorted best first.
// A FEN scripted in SCRIPTS answers its script; any other legal FEN answers `draw` with every legal move (chess.js order),
// each `draw`; a FEN chess.js rejects answers 400.
import { Chess } from 'chess.js';

/** FENs the tests script (full FEN, counters included). */
export const TABLEBASE_FENS = {
  /** kq-k after 1.Qd4+: black loses, Ke6 is best. */
  kqkAfterQd4: '8/8/8/4k3/3Q4/8/8/4K3 b - - 1 1',
  /** kq-k: same pieces as kqkAfterQd4, other move counters (not scripted). */
  kqkAfterQd4OtherCounters: '8/8/8/4k3/3Q4/8/8/4K3 b - - 3 2',
  /** kq-k: answered with syzygy-* categories. */
  kqkSyzygy: '8/8/4k3/8/8/8/8/3QK3 b - - 0 1',
  /** kq-k: black stalemated, no moves. */
  kqkNoMoves: 'k7/8/1Q6/8/8/8/8/4K3 b - - 0 1',
};

const SCRIPTS = {
  [TABLEBASE_FENS.kqkAfterQd4]: {
    category: 'loss', dtz: -18, dtm: -18, checkmate: false, stalemate: false, insufficient_material: false,
    moves: [
      { uci: 'e5e6', san: 'Ke6', category: 'win', dtz: 17, dtm: 17, zeroing: false, checkmate: false, stalemate: false, insufficient_material: false },
      { uci: 'e5d4', san: 'Kxd4', category: 'draw', dtz: 0, dtm: null, zeroing: true, checkmate: false, stalemate: false, insufficient_material: true },
    ],
  },
  [TABLEBASE_FENS.kqkSyzygy]: {
    category: 'syzygy-loss', dtz: -20, dtm: null, checkmate: false, stalemate: false, insufficient_material: false,
    moves: [{ uci: 'e6e5', san: 'Ke5', category: 'syzygy-win', dtz: 19, dtm: null, zeroing: false, checkmate: false, stalemate: false, insufficient_material: false }],
  },
  [TABLEBASE_FENS.kqkNoMoves]: {
    category: 'draw', dtz: 0, dtm: null, checkmate: false, stalemate: true, insufficient_material: false, moves: [],
  },
};

// ---- US-112: scripted lines, keyed by position (the first 4 FEN fields), so move counters do not matter ----

const placement = (fen) => fen.split(' ').slice(0, 4).join(' ');

/**
 * Scripted lines for the endgame board page. Each step is a player move (SAN) and, when the app answers, the root
 * `category` (for the app, to move) and the app's `reply` (SAN, its category for the player is `replyCategory`).
 * A step without `category` is left to the default answer (or is never asked: terminal positions).
 */
export const LINES = {
  /** kq-k: each player move leaves the app `loss`; the replies walk the black king to h1; Qh3 mates. */
  kqkMate: {
    id: 'kq-k',
    start: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1',
    steps: [
      { move: 'Kf2', category: 'loss', reply: 'Kf4', replyCategory: 'win' },
      { move: 'Qd8', category: 'loss', reply: 'Kg4', replyCategory: 'win' },
      { move: 'Qa8', category: 'loss', reply: 'Kh3', replyCategory: 'win' },
      { move: 'Qa7', category: 'loss', reply: 'Kh2', replyCategory: 'win' },
      { move: 'Qa3', category: 'loss', reply: 'Kh1', replyCategory: 'win' },
      { move: 'Qh3' }, // checkmate
    ],
  },
  /** kq-k: the same line, but the last move Qg3 stalemates the black king on h1 (never sent to the tablebase). */
  kqkStalemate: {
    id: 'kq-k',
    start: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1',
    steps: [
      { move: 'Kf2', category: 'loss', reply: 'Kf4', replyCategory: 'win' },
      { move: 'Qd8', category: 'loss', reply: 'Kg4', replyCategory: 'win' },
      { move: 'Qa8', category: 'loss', reply: 'Kh3', replyCategory: 'win' },
      { move: 'Qa7', category: 'loss', reply: 'Kh2', replyCategory: 'win' },
      { move: 'Qa3', category: 'loss', reply: 'Kh1', replyCategory: 'win' },
      { move: 'Qg3' }, // stalemate
    ],
  },
  /** kq-k: 1.Qg4 leaves the app `draw` (the win is given away). */
  kqkGiveAway: {
    id: 'kq-k',
    start: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1',
    steps: [{ move: 'Qg4', category: 'draw', reply: 'Kf6', replyCategory: 'draw' }],
  },
  /** philidor: 1...Rh1 leaves the app (white) `win`: the move loses. */
  philidorLoses: {
    id: 'philidor',
    start: '4k3/8/7r/3KP3/8/8/8/R7 b - - 0 1',
    steps: [{ move: 'Rh1', category: 'win', reply: 'Kd6', replyCategory: 'loss' }],
  },
  /** philidor: 1...Rb6 leaves the app `loss` (still holding); reply Ke4; then Kd7 (default answer). */
  philidorLossForApp: {
    id: 'philidor',
    start: '4k3/8/7r/3KP3/8/8/8/R7 b - - 0 1',
    steps: [{ move: 'Rb6', category: 'loss', reply: 'Ke4', replyCategory: 'win' }, { move: 'Kd7' }],
  },
  /** philidor: 1...Rc6 leaves the app `blessed-loss` (still holding); reply Ke4; then Kd7 (default answer). */
  philidorBlessedLoss: {
    id: 'philidor',
    start: '4k3/8/7r/3KP3/8/8/8/R7 b - - 0 1',
    steps: [{ move: 'Rc6', category: 'blessed-loss', reply: 'Ke4', replyCategory: 'cursed-win' }, { move: 'Kd7' }],
  },
  /**
   * kr-kn: the black king goes e6, d6, e6, d6, e6 while the white king answers Ke2, Ke1, ...: the position after
   * the player's 5th move (Ke6) is the third occurrence of the position after the 1st (the start never recurs).
   */
  krknRepetition: {
    id: 'kr-kn',
    start: '8/8/8/4k3/4n3/8/8/R3K3 b - - 0 1',
    steps: [
      { move: 'Ke6', category: 'draw', reply: 'Ke2', replyCategory: 'draw' },
      { move: 'Kd6', category: 'draw', reply: 'Ke1', replyCategory: 'draw' },
      { move: 'Ke6', category: 'draw', reply: 'Ke2', replyCategory: 'draw' },
      { move: 'Kd6', category: 'draw', reply: 'Ke1', replyCategory: 'draw' },
      { move: 'Ke6' }, // threefold repetition
    ],
  },
};

/** The FENs of a line: [{ afterMove, afterReply }] per step (afterReply null when the step has no reply). */
export function lineFens(line) {
  const c = new Chess(line.start);
  return line.steps.map((s) => {
    c.move(s.move);
    const afterMove = c.fen();
    let afterReply = null;
    if (s.reply) {
      const tb = PLACEMENT_SCRIPTS[placement(afterMove)];
      const uci = tb?.moves[0]?.uci ?? tablebaseAnswer(afterMove)[1].moves[0].uci;
      c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      afterReply = c.fen();
    }
    return { afterMove, afterReply };
  });
}

const PLACEMENT_SCRIPTS = {};
for (const line of Object.values(LINES)) {
  const c = new Chess(line.start);
  for (const s of line.steps) {
    c.move(s.move); // throws on an illegal scripted move
    if (!s.category) {
      if (s.reply) throw new Error('a reply needs a category');
      continue;
    }
    const key = placement(c.fen());
    const m = c.move(s.reply);
    const body = {
      category: s.category, dtz: null, dtm: null, checkmate: false, stalemate: false, insufficient_material: false,
      moves: [{ uci: m.from + m.to + (m.promotion ?? ''), san: m.san, category: s.replyCategory, dtz: null, dtm: null, zeroing: false, checkmate: false, stalemate: false, insufficient_material: false }],
    };
    const prev = PLACEMENT_SCRIPTS[key];
    if (prev && JSON.stringify(prev) !== JSON.stringify(body)) throw new Error(`two scripts for ${key}`);
    PLACEMENT_SCRIPTS[key] = body;
  }
}

/** The FEN of a logged request path, or null when it is not a /standard request. */
export function standardFen(path) {
  const u = new URL(path, 'http://fake');
  return u.pathname === '/standard' ? u.searchParams.get('fen') : null;
}

/** → [status, body] for GET /standard?fen=<fen>. */
export function tablebaseAnswer(fen) {
  if (fen && SCRIPTS[fen]) return [200, SCRIPTS[fen]];
  if (fen && PLACEMENT_SCRIPTS[placement(fen)]) return [200, PLACEMENT_SCRIPTS[placement(fen)]];
  let chess;
  try {
    chess = new Chess(fen ?? '');
  } catch {
    return [400, { error: 'invalid fen' }];
  }
  const moves = chess.moves({ verbose: true }).map((m) => ({ uci: m.from + m.to + (m.promotion ?? ''), san: m.san, category: 'draw' }));
  return [200, { category: 'draw', checkmate: chess.isCheckmate(), stalemate: chess.isStalemate(), insufficient_material: chess.isInsufficientMaterial(), moves }];
}

/**
 * US-112: `n` player moves (SAN) from `start` that, against this fake's answers (the app plays `moves[0]`), never
 * reach a terminal position (mate, stalemate, insufficient material, a repeated position) and capture nothing.
 */
export function holdingLine(start, n) {
  const c = new Chess(start);
  const seen = new Set([placement(start)]);
  const fresh = () => !c.isGameOver() && !seen.has(placement(c.fen()));
  const out = [];
  for (let i = 0; i < n; i++) {
    let found = null;
    for (const m of c.moves({ verbose: true })) {
      if (m.captured || m.piece === 'p') continue;
      c.move(m);
      if (fresh()) {
        const afterMove = c.fen();
        const r = tablebaseAnswer(afterMove)[1].moves[0];
        const rm = r && c.move({ from: r.uci.slice(0, 2), to: r.uci.slice(2, 4), promotion: r.uci[4] });
        if (rm && !rm.captured && fresh()) {
          found = { san: m.san, afterMove, afterReply: c.fen() };
          c.undo();
        }
      }
      c.undo();
      if (found) break;
    }
    if (!found) throw new Error(`holdingLine: no move at step ${i + 1}`);
    c.move(found.san);
    seen.add(placement(c.fen()));
    c.load(found.afterReply);
    seen.add(placement(c.fen()));
    out.push(found.san);
  }
  return out;
}

/** US-112: the FEN after the app plays this fake's reply (`moves[0]`) to `fen`. */
export function afterFakeReply(fen) {
  const [, body] = tablebaseAnswer(fen);
  const c = new Chess(fen);
  const u = body.moves[0].uci;
  c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
  return c.fen();
}
