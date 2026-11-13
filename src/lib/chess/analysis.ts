// Pure analysis functions: browser-safe. Evaluations are from White's point of view.
import { positions, turn } from './rules';

export type Eval = { cp: number } | { mate: number };
type Side = 'w' | 'b';

export function winChance(ev: Eval, side: Side = 'w'): number {
  if ('mate' in ev) {
    if (ev.mate === 0) return side === 'w' ? 0 : 100;
    return ev.mate > 0 ? 100 : 0;
  }
  const cp = Math.max(-1000, Math.min(1000, ev.cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

export function moveLoss(before: number, after: number, mover: Side): number {
  const loss = mover === 'w' ? before - after : after - before;
  return Math.max(0, loss);
}

export type Mark = 'blunder' | 'mistake' | 'inaccuracy';

export function mark(loss: number, played: string, best: string | null): Mark | null {
  if (played === best) return null;
  if (loss >= 30) return 'blunder';
  if (loss >= 20) return 'mistake';
  if (loss >= 10) return 'inaccuracy';
  return null;
}

export function accuracy(losses: number[]): number {
  if (losses.length === 0) return 100;
  const mean = losses.reduce((a, b) => a + b, 0) / losses.length;
  const v = 103.1668 * Math.exp(-0.04354 * mean) - 3.1669;
  return Math.round(Math.max(0, Math.min(100, v)) * 10) / 10;
}

export type Phase = 'opening' | 'middlegame' | 'endgame';

const WEIGHTS: Record<string, number> = { q: 9, r: 5, b: 3, n: 3 };

export function phase(fen: string, ply: number): Phase {
  if (ply <= 20) return 'opening';
  let total = 0;
  for (const c of fen.split(' ')[0]) total += WEIGHTS[c.toLowerCase()] ?? 0;
  return total <= 13 ? 'endgame' : 'middlegame';
}

export function computeReview(pgn: string, evals: Eval[], best: (string | null)[]) {
  const { fens, moves } = positions(pgn);
  const marks: (Mark | null)[] = [];
  const phases: Phase[] = [];
  const losses: Record<Side, number[]> = { w: [], b: [] };
  moves.forEach((m, i) => {
    const mover = turn(fens[i]);
    const loss = moveLoss(winChance(evals[i], turn(fens[i])), winChance(evals[i + 1], turn(fens[i + 1])), mover);
    losses[mover].push(loss);
    marks.push(mark(loss, m.uci, best[i] ?? null));
    phases.push(phase(fens[i], i + 1));
  });
  return { marks, phases, accuracyWhite: accuracy(losses.w), accuracyBlack: accuracy(losses.b) };
}
