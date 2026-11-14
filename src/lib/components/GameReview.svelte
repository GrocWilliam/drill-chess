<!--
  The board page: board, game details, move list and replay controls. The ply lives in `?ply=N` (shallow
  replaceState, no page load); a move played on the board leaves the game line (free play) until the user returns.
  With no stored `analysis`, Stockfish analyses every position in the browser (`engine.ts`, created in onMount and
  stopped on leave); with `save` false (the demo) the review is computed locally and nothing is sent; with `save` true
  the evals and best moves are POSTed to /api/games/<gameId>/analysis and the page shows the server's marks.
-->
<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import { replaceState } from '$app/navigation';
  import { computeReview, winChance, type Eval, type Mark } from '$lib/chess/analysis';
  import Board from '$lib/chess/Board.svelte';
  import { runAnalysis, type AnalysisRun } from '$lib/chess/engine';
  import EvalCurve from '$lib/chess/EvalCurve.svelte';
  import EvalBar from '$lib/chess/EvalBar.svelte';
  import MoveList from '$lib/chess/MoveList.svelte';
  import { play, positions, sanOf, turn } from '$lib/chess/rules';
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import { saveAnalysis } from '$lib/components/save-analysis';
  import { formatOneDecimal, translate, type Lang, type Messages } from '$lib/i18n';

  /** A finished review: evals from White's view (plies + 1), best moves in UCI (plies), marks (plies). */
  export type Review = {
    evals: Eval[];
    best: (string | null)[];
    marks: (Mark | null)[];
    accuracyWhite: number;
    accuracyBlack: number;
  };

  type Props = {
    /** `id` is needed when `save` is true. */
    game: { pgn: string; id?: string };
    analysis: Review | null;
    ply: number;
    orientation: 'white' | 'black';
    engineDepth: number;
    save: boolean;
    /** Board moves: 'both' (free play, the demo) or 'none'. */
    movable?: 'none' | 'both';
    messages: Messages;
    lang: Lang;
    details?: Snippet;
    /** Rendered at the end of the panel (e.g. the link to the game on its site). */
    footer?: Snippet;
  };
  let {
    game,
    analysis,
    ply: initialPly,
    orientation: initialOrientation,
    engineDepth,
    save,
    movable = 'both',
    messages,
    lang,
    details,
    footer
  }: Props = $props();
  const t = (k: string, params: Record<string, string | number> = {}) => translate(messages, k, params);

  const line = $derived(positions(game.pgn));
  const last = $derived(line.moves.length);

  let ply = $state(initialPly);
  let orientation = $state(initialOrientation);
  let free = $state<{ fen: string; lastMove: [string, string]; from: number } | null>(null);

  const fen = $derived(free ? free.fen : line.fens[ply]);
  const lastMove = $derived.by<[string, string] | undefined>(() => {
    if (free) return free.lastMove;
    const m = line.moves[ply - 1];
    return m ? [m.from, m.to] : undefined;
  });

  // The analysis: the stored one, else the engine's (state 'running' | 'done' | 'error').
  let review = $state<Review | null>(analysis);
  let status = $state<'idle' | 'running' | 'done' | 'error'>(analysis ? 'done' : 'idle');
  // What failed: the engine ('engine') or saving its result ('save').
  let failure = $state<'engine' | 'save'>('engine');
  let progress = $state({ n: 1, total: 1 });
  // The current engine run; a run that was cancelled (page left, or a retry started) writes no state.
  let current: AnalysisRun | null = null;

  async function analyse() {
    current?.cancel();
    const { fens } = line;
    progress = { n: 1, total: Math.max(1, fens.length - 1) };
    status = 'running';
    const run = runAnalysis(fens, engineDepth, (n, total) => (progress = { n, total }));
    current = run;
    let evals: Eval[], best: (string | null)[];
    try {
      ({ evals, best } = await run.result);
    } catch {
      if (current === run) {
        failure = 'engine';
        status = 'error';
      }
      return;
    }
    if (current !== run) return;
    if (!save) {
      const { marks, accuracyWhite, accuracyBlack } = computeReview(game.pgn, evals, best);
      review = { evals, best, marks, accuracyWhite, accuracyBlack };
      status = 'done';
      return;
    }
    try {
      // The server computes the marks; the page shows its answer, never marks of its own.
      const saved = await saveAnalysis(game.id ?? '', { depth: engineDepth, evals, best });
      if (current !== run) return;
      review = { evals, best, ...saved };
      status = 'done';
    } catch {
      if (current === run) {
        failure = 'save';
        status = 'error';
      }
    }
  }

  onMount(() => {
    if (!analysis) analyse();
    return () => {
      current?.cancel();
      current = null;
    };
  });

  // The eval bar and best move follow the game ply (the one left in free play).
  const gamePly = $derived(free ? free.from : ply);
  const gameFen = $derived(line.fens[gamePly]);
  const evalNow = $derived(review?.evals[gamePly] ?? null);
  const bestNow = $derived.by(() => {
    const uci = review?.best[gamePly];
    return uci ? (sanOf(gameFen, uci) ?? '') : '';
  });

  const wins = $derived(review ? review.evals.map((e, i) => winChance(e, turn(line.fens[i]))) : []);

  function go(target: number) {
    const next = Math.max(0, Math.min(last, target));
    free = null;
    ply = next;
    replaceState(`?ply=${next}`, {});
  }

  function onMove(uci: string) {
    const next = play(fen, uci);
    if (!next) return;
    free = { fen: next, lastMove: [uci.slice(0, 2), uci.slice(2, 4)], from: free ? free.from : ply };
  }

  function keydown(e: KeyboardEvent) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const target = e.target as HTMLElement | null;
    if (target?.dataset?.testid === 'board-move-input') return;
    const key = e.key;
    if (key === 'ArrowLeft') go(ply - 1);
    else if (key === 'ArrowRight') go(ply + 1);
    else if (key === 'Home') go(0);
    else if (key === 'End') go(last);
    else if (key === 'f' || key === 'F') orientation = orientation === 'white' ? 'black' : 'white';
    else return;
    e.preventDefault();
  }

  const controls = [
    ['start', () => go(0)],
    ['prev', () => go(ply - 1)],
    ['next', () => go(ply + 1)],
    ['end', () => go(last)],
    ['flip', () => (orientation = orientation === 'white' ? 'black' : 'white')]
  ] as const;
  const glyph = { start: '⏮', prev: '◀', next: '▶', end: '⏭', flip: '⇅' };
</script>

<svelte:window onkeydown={keydown} />

<main class="mx-auto max-w-6xl px-4 py-4 lg:px-0">
  <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-1">
    <div class="flex flex-col gap-2 lg:flex-row lg:gap-1">
      <EvalBar ev={evalNow} turn={turn(gameFen)} label={t('review.eval')} class="shrink-0" />
      <div class="board-col w-full">
        <Board {messages} {fen} {orientation} {movable} {lastMove} {onMove} />
      </div>
    </div>
    <Card data-testid="review-panel" class="flex flex-col gap-3 break-words lg:w-[380px] lg:shrink-0">
      {@render details?.()}
      {#if status === 'running'}
        <p data-testid="review-progress" class="text-sm text-muted" aria-live="polite">
          {t('review.progress', progress)}
        </p>
      {:else if status === 'error'}
        <div class="flex flex-wrap items-center gap-2">
          <p data-testid="review-error" role="alert" class="text-danger">
            {t(failure === 'save' ? 'review.save_error' : 'review.error')}
          </p>
          <Button type="button" variant="secondary" data-testid="review-retry" onclick={analyse}>{t('review.retry')}</Button>
        </div>
      {/if}
      <MoveList
        sans={line.moves.map((m) => m.san)}
        ply={free ? null : ply > 0 ? ply : null}
        onSelect={go}
        marks={review?.marks ?? null}
        {messages}
      />
      {#if review}
        <p data-testid="review-best" class="text-sm">
          <span class="text-muted">{t('review.best')}</span>
          <span class="font-mono font-bold text-best">{bestNow}</span>
        </p>
        <p data-testid="review-accuracy" class="flex flex-wrap gap-x-4 text-sm">
          <span class="text-muted">{t('review.accuracy')}</span>
          <span data-testid="review-accuracy-white">
            {t('review.accuracy_white')} <strong class="font-mono">{formatOneDecimal(review.accuracyWhite, lang)}</strong>
          </span>
          <span data-testid="review-accuracy-black">
            {t('review.accuracy_black')} <strong class="font-mono">{formatOneDecimal(review.accuracyBlack, lang)}</strong>
          </span>
        </p>
      {/if}
      {#if review && status === 'done'}
        <EvalCurve
          {wins}
          marks={review.marks}
          sans={line.moves.map((m) => m.san)}
          ply={gamePly}
          onSelect={go}
          {messages}
          {lang}
        />
      {/if}
      <div class="flex flex-wrap gap-1">
        {#each controls as [name, action] (name)}
          <Button
            type="button"
            variant="ghost"
            data-testid="review-{name}"
            aria-label={t(`review.${name}`)}
            title={t(`review.${name}`)}
            onclick={action}
            class="min-w-11 px-2"
          >{glyph[name]}</Button>
        {/each}
      </div>
      {#if save && status === 'done'}
        <Button type="button" variant="secondary" data-testid="review-reanalyse" onclick={analyse}>
          {t('review.reanalyse')}
        </Button>
      {/if}
      {#if free}
        <Button type="button" variant="secondary" data-testid="review-back-to-game" onclick={() => free && go(free.from)}>
          {t('review.back_to_game')}
        </Button>
      {/if}
      {@render footer?.()}
    </Card>
  </div>
</main>

<style>
  /* docs/ui.md board pages: full width (max 100vw − 32px) below 1024px; from 1024px min(640px, 100vh − 160px),
     leaving room for the 24px eval bar and the 380px panel. */
  .board-col {
    max-width: calc(100vw - 32px);
    overflow-x: clip; /* chessground coordinates overflow by a pixel */
  }
  @media (min-width: 1024px) {
    .board-col {
      width: min(640px, calc(100vh - 160px), calc(100vw - 380px - 24px - 8px));
      flex-shrink: 0;
    }
  }
</style>
