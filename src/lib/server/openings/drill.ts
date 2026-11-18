// Pure drill line picking: a seeded PRNG and the weighted walk through a repertoire graph.

/** A deterministic PRNG: `mulberry32(seed)()` → a number in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Index picked with probability weight / sum(weights); weights must be > 0. */
export function pickWeighted(weights: number[], rand: () => number): number {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rand() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

export interface DrillMove {
  fromFen: string;
  toFen: string;
  uci: string;
  san: string;
  by: 'player' | 'opponent';
  /** The player move's card; null for opponent moves. */
  cardId: string | null;
  due: boolean;
}

/** Moves grouped by their normalised `fromFen`, in a stable order. */
export type Graph = Map<string, DrillMove[]>;

export function graphOf(moves: DrillMove[]): Graph {
  const g: Graph = new Map();
  for (const m of moves) {
    const list = g.get(m.fromFen);
    if (list) list.push(m);
    else g.set(m.fromFen, [m]);
  }
  return g;
}

/** The distinct due cards of `move` and of every move reachable after it (cycles are visited once). */
export function dueBelow(graph: Graph, move: DrillMove): number {
  const cards = new Set<string>();
  if (move.due && move.cardId) cards.add(move.cardId);
  const seen = new Set<string>([move.toFen]);
  const stack = [move.toFen];
  while (stack.length) {
    for (const m of graph.get(stack.pop()!) ?? []) {
      if (m.due && m.cardId) cards.add(m.cardId);
      if (!seen.has(m.toFen)) {
        seen.add(m.toFen);
        stack.push(m.toFen);
      }
    }
  }
  return cards.size;
}

/**
 * Walks from `start`: a player position plays its (single) player move, an opponent position picks a branch weighted
 * by 1 + the due cards below it. Stops at a position without moves or one already visited.
 */
export function pickLine(graph: Graph, start: string, rand: () => number): DrillMove[] {
  const line: DrillMove[] = [];
  const visited = new Set<string>();
  let fen = start;
  while (!visited.has(fen)) {
    visited.add(fen);
    const moves = graph.get(fen);
    if (!moves?.length) break;
    const player = moves.find((m) => m.by === 'player');
    const move = player ?? moves[pickWeighted(moves.map((m) => 1 + dueBelow(graph, m)), rand)];
    line.push(move);
    fen = move.toFen;
  }
  return line;
}
