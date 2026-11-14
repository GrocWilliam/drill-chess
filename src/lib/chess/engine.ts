// Stockfish client: the engine runs in a Web Worker in the browser only (create it in onMount; never on the server).
// Scores from Stockfish are from the side to move; `analyse` turns them to White's point of view.
import type { Eval } from './analysis';
import { terminal, turn } from './rules';

const WORKER_URL = '/stockfish/stockfish.js#stockfish.wasm';

/** The score of an `info ... score cp|mate N` line, or null for any other line. */
export function parseInfo(line: string): Eval | null {
  const m = /^info\b.*?\bscore (cp|mate) (-?\d+)/.exec(line.trim());
  if (!m) return null;
  const n = Number.parseInt(m[2], 10);
  return m[1] === 'cp' ? { cp: n } : { mate: n };
}

/** A score of the side to move (`turn`) from White's point of view. */
export function toWhite(score: Eval, side: 'w' | 'b'): Eval {
  if (side === 'w') return score;
  // `0 - x` keeps 0 a plain 0 (never -0).
  return 'cp' in score ? { cp: 0 - score.cp } : { mate: 0 - score.mate };
}

/** The best move of a `bestmove` line (null for `(none)`), or undefined for any other line. */
export function parseBestMove(line: string): string | null | undefined {
  const m = /^bestmove (\S+)/.exec(line.trim());
  if (!m) return undefined;
  return m[1] === '(none)' ? null : m[1];
}

export type Analysis = { evals: Eval[]; best: (string | null)[] };

export type Engine = {
  analyse(fens: string[], depth: number, onProgress?: (n: number, total: number) => void): Promise<Analysis>;
  stop(): void;
};

/**
 * Starts the worker and resolves once Stockfish answers `readyok`; rejects when the worker fails to load, or with
 * `engine_stopped` when `signal` aborts first (the worker is then terminated at once).
 */
export function createEngine(signal?: AbortSignal): Promise<Engine> {
  const worker = new Worker(WORKER_URL);
  let waiter: { match: (line: string) => boolean; resolve: () => void } | null = null;
  let fail: ((e: Error) => void) | null = null;
  let stopped = false;

  worker.addEventListener('message', (e: MessageEvent) => {
    for (const line of String(e.data).split('\n')) {
      if (waiter?.match(line)) {
        const w = waiter;
        waiter = null;
        w.resolve();
      }
    }
  });
  const onError = (e: Event) => {
    e.preventDefault?.();
    fail?.(new Error('engine_failed'));
  };
  worker.addEventListener('error', onError);
  worker.addEventListener('messageerror', onError);

  const send = (cmd: string) => worker.postMessage(cmd);
  /** Resolves when a line matching `match` arrives. */
  const until = (match: (line: string) => boolean) =>
    new Promise<void>((resolve, reject) => {
      if (stopped) return reject(new Error('engine_stopped'));
      fail = reject;
      waiter = { match, resolve };
    });

  const stop = () => {
    if (stopped) return;
    stopped = true;
    worker.terminate();
    fail?.(new Error('engine_stopped'));
  };

  async function analyse(fens: string[], depth: number, onProgress?: (n: number, total: number) => void) {
    const total = Math.max(1, fens.length - 1);
    const evals: Eval[] = [];
    const best: (string | null)[] = [];
    const ready = until((l) => l.trim() === 'readyok');
    send('ucinewgame');
    send('isready');
    await ready;
    for (let i = 0; i < fens.length; i++) {
      const fen = fens[i];
      const end = terminal(fen);
      if (end) {
        evals.push(end === 'checkmate' ? { mate: 0 } : { cp: 0 });
        if (i < fens.length - 1) best.push(null);
        continue;
      }
      onProgress?.(Math.min(i + 1, total), total);
      const found: { score: Eval | null; move: string | null } = { score: null, move: null };
      const done = until((l) => {
        found.score = parseInfo(l) ?? found.score;
        const b = parseBestMove(l);
        if (b === undefined) return false;
        found.move = b;
        return true;
      });
      send(`position fen ${fen}`);
      send(`go depth ${depth}`);
      await done;
      evals.push(toWhite(found.score ?? { cp: 0 }, turn(fen)));
      if (i < fens.length - 1) best.push(found.move);
    }
    return { evals, best };
  }

  return new Promise<Engine>((resolve, reject) => {
    const ready = until((l) => l.trim() === 'readyok');
    if (signal?.aborted) stop();
    signal?.addEventListener('abort', stop, { once: true });
    send('uci');
    send('setoption name Hash value 16');
    send('isready');
    ready.then(
      () => resolve({ analyse, stop }),
      (e) => {
        stop();
        reject(e);
      }
    );
  });
}

export type AnalysisRun = { result: Promise<Analysis>; cancel(): void };

/**
 * Starts an engine and analyses `fens`; `cancel()` stops the engine whether it is still starting or analysing, and
 * `result` then rejects with `engine_stopped`. `onProgress` is never called after `cancel()`.
 */
export function runAnalysis(
  fens: string[],
  depth: number,
  onProgress?: (n: number, total: number) => void
): AnalysisRun {
  const abort = new AbortController();
  const result = (async () => {
    const engine = await createEngine(abort.signal);
    try {
      const out = await engine.analyse(fens, depth, (n, total) => {
        if (!abort.signal.aborted) onProgress?.(n, total);
      });
      if (abort.signal.aborted) throw new Error('engine_stopped');
      return out;
    } finally {
      engine.stop();
    }
  })();
  return { result, cancel: () => abort.abort() };
}
