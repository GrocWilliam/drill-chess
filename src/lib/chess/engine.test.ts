import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEngine, parseBestMove, parseInfo, runAnalysis, toWhite } from './engine';

describe('parseInfo', () => {
  it('reads cp and mate scores, null otherwise', () => {
    expect(parseInfo('info depth 6 seldepth 8 multipv 1 score cp 34 nodes 1000 pv e2e4')).toEqual({ cp: 34 });
    expect(parseInfo('info depth 6 score mate -2 pv e7e8q')).toEqual({ mate: -2 });
    expect(parseInfo('info depth 12 score cp -15 lowerbound nodes 9')).toEqual({ cp: -15 });
    expect(parseInfo('info string NNUE enabled')).toBeNull();
    expect(parseInfo('bestmove e2e4')).toBeNull();
  });
});

describe('toWhite', () => {
  it("turns the side to move's score to White's view", () => {
    expect(toWhite({ cp: 34 }, 'b')).toEqual({ cp: -34 });
    expect(toWhite({ mate: 2 }, 'b')).toEqual({ mate: -2 });
    expect(toWhite({ cp: 34 }, 'w')).toEqual({ cp: 34 });
    expect(Object.is(toWhite({ cp: 0 }, 'b').cp, 0)).toBe(true);
  });
});

describe('parseBestMove', () => {
  it('reads the move, null for (none), undefined for other lines', () => {
    expect(parseBestMove('bestmove e2e4 ponder e7e5')).toBe('e2e4');
    expect(parseBestMove('bestmove (none)')).toBeNull();
    expect(parseBestMove('info depth 1')).toBeUndefined();
  });
});

/** A fake Stockfish worker: answers every `go` with a score of +50 for the side to move and best move e2e4. */
class FakeWorker extends EventTarget {
  static last: FakeWorker;
  static broken = false;
  sent: string[] = [];
  terminated = false;
  constructor(public url: string) {
    super();
    FakeWorker.last = this;
    if (FakeWorker.broken) setTimeout(() => this.dispatchEvent(new Event('error')));
  }
  postMessage(cmd: string) {
    this.sent.push(cmd);
    if (FakeWorker.broken || this.terminated) return;
    const reply = (data: string) => setTimeout(() => this.dispatchEvent(new MessageEvent('message', { data })));
    if (cmd === 'isready') reply('readyok');
    if (cmd.startsWith('go')) {
      reply('info depth 1 score cp 10 pv e2e4');
      reply('info depth 2 score cp 50 pv e2e4');
      reply('bestmove e2e4');
    }
  }
  terminate() {
    this.terminated = true;
  }
}

describe('createEngine', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeWorker.broken = false;
  });

  it('analyses each position, scores from White, the final checkmate not sent', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const engine = await createEngine();
    const w = FakeWorker.last;
    expect(w.url).toBe('/stockfish/stockfish.js#stockfish.wasm');
    expect(w.sent).toEqual(['uci', 'setoption name Hash value 16', 'isready']);
    const fens = [
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      'rnbqkbnr/pppppppp/8/8/8/5P2/PPPPP1PP/RNBQKBNR b KQkq - 0 1',
      'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'
    ];
    const progress: [number, number][] = [];
    const result = await engine.analyse(fens, 6, (n, total) => progress.push([n, total]));
    expect(result.evals).toEqual([{ cp: 50 }, { cp: -50 }, { mate: 0 }]);
    expect(result.best).toEqual(['e2e4', 'e2e4']);
    expect(progress).toEqual([[1, 2], [2, 2]]);
    expect(w.sent.slice(3, 5)).toEqual(['ucinewgame', 'isready']);
    expect(w.sent.filter((c) => c.startsWith('position'))).toHaveLength(2);
    expect(w.sent).toContain('go depth 6');
    engine.stop();
    expect(w.terminated).toBe(true);
  });

  it('gives a stalemate {cp: 0}', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const engine = await createEngine();
    const result = await engine.analyse(['7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'], 6);
    expect(result).toEqual({ evals: [{ cp: 0 }], best: [] });
  });

  it('rejects when the worker fails to load', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    FakeWorker.broken = true;
    await expect(createEngine()).rejects.toThrow('engine_failed');
    expect(FakeWorker.last.terminated).toBe(true);
  });
});

describe('runAnalysis', () => {
  afterEach(() => vi.unstubAllGlobals());
  const fens = [
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    'rnbqkbnr/pppppppp/8/8/8/5P2/PPPPP1PP/RNBQKBNR b KQkq - 0 1'
  ];

  it('resolves the analysis and stops the engine', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const run = runAnalysis(fens, 6);
    expect(await run.result).toEqual({ evals: [{ cp: 50 }, { cp: -50 }], best: ['e2e4'] });
    expect(FakeWorker.last.terminated).toBe(true);
  });

  it('cancelled while the engine is starting: stops it, analyses nothing, rejects', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const onProgress = vi.fn();
    const run = runAnalysis(fens, 6, onProgress);
    const w = FakeWorker.last;
    run.cancel();
    expect(w.terminated).toBe(true);
    await expect(run.result).rejects.toThrow('engine_stopped');
    expect(w.terminated).toBe(true);
    expect(w.sent.some((c) => c.startsWith('go'))).toBe(false);
    expect(onProgress).not.toHaveBeenCalled();
  });

  it('cancelled while analysing: stops the engine and rejects', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    let run: ReturnType<typeof runAnalysis>;
    const onProgress = vi.fn(() => run.cancel());
    run = runAnalysis(fens, 6, onProgress);
    await expect(run.result).rejects.toThrow('engine_stopped');
    expect(FakeWorker.last.terminated).toBe(true);
    expect(onProgress).toHaveBeenCalledTimes(1);
  });
});
