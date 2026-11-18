// Pure graph of a repertoire: moves are edges between normalised FENs (transpositions share nodes).
export interface TreeMove {
  id: string;
  fromFen: string;
  toFen: string;
}

/** Edges by `fromFen`. */
export function buildGraph<T extends TreeMove>(moves: T[]): Map<string, T[]> {
  const graph = new Map<string, T[]>();
  for (const m of moves) {
    const list = graph.get(m.fromFen);
    if (list) list.push(m);
    else graph.set(m.fromFen, [m]);
  }
  return graph;
}

/** FENs reachable from `start` over the moves, cycle-safe (each FEN is visited once). */
export function reachableFens(moves: TreeMove[], start: string): Set<string> {
  const graph = buildGraph(moves);
  const seen = new Set<string>([start]);
  const stack = [start];
  while (stack.length) {
    for (const m of graph.get(stack.pop()!) ?? []) {
      if (!seen.has(m.toFen)) {
        seen.add(m.toFen);
        stack.push(m.toFen);
      }
    }
  }
  return seen;
}

/**
 * Ids of the moves removed by deleting `moveId`: that move plus every move whose `fromFen` is no longer
 * reachable from `start` once it is gone. Empty when `moveId` is unknown.
 */
export function reachableAfterDelete(moves: TreeMove[], start: string, moveId: string): string[] {
  if (!moves.some((m) => m.id === moveId)) return [];
  const rest = moves.filter((m) => m.id !== moveId);
  const reachable = reachableFens(rest, start);
  return moves.filter((m) => m.id === moveId || !reachable.has(m.fromFen)).map((m) => m.id);
}
