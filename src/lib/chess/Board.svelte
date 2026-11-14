<!--
  The shared board: chessground (created in onMount, so the server renders an empty square), legal moves only, a
  promotion chooser, and a text field taking SAN or UCI moves for keyboard and screen-reader users.
  The parent owns the position: `onMove(uci)` reports a legal move; the parent then passes the new `fen`.
-->
<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { Chessground } from 'chessground';
  import type { Api } from 'chessground/api';
  import type { Config } from 'chessground/config';
  import type { Key } from 'chessground/types';
  import 'chessground/assets/chessground.base.css';
  import 'chessground/assets/chessground.brown.css';
  import 'chessground/assets/chessground.cburnett.css';
  import { translate, type Messages } from '$lib/i18n';
  import { inCheck, isPromotion, legalMoves, turn, uciOf } from './rules';

  type Colour = 'white' | 'black';
  type Props = {
    messages: Messages;
    fen: string;
    orientation?: Colour;
    movable?: 'none' | Colour | 'both';
    lastMove?: [string, string];
    onMove?: (uci: string) => void;
    id?: string;
  };
  let { messages, fen, orientation = 'white', movable = 'none', lastMove, onMove, id = 'board' }: Props = $props();
  const t = (k: string) => translate(messages, k);

  const PIECES = [
    { p: 'q', white: '♕', black: '♛' },
    { p: 'r', white: '♖', black: '♜' },
    { p: 'b', white: '♗', black: '♝' },
    { p: 'n', white: '♘', black: '♞' },
  ] as const;

  let el: HTMLDivElement;
  let cg: Api | undefined;
  let pending = $state<{ from: string; to: string } | null>(null);
  let text = $state('');
  let invalid = $state(false);
  let chooser = $state<HTMLDivElement>();

  const toMove = (f: string): Colour => (turn(f) === 'w' ? 'white' : 'black');
  /** The colour the user may move now, if any. */
  const mover = (f: string): Colour | undefined =>
    movable === 'both' || movable === toMove(f) ? toMove(f) : undefined;

  function config(): Config {
    const colour = pending ? undefined : mover(fen);
    return {
      fen: fen.split(' ')[0],
      orientation,
      turnColor: toMove(fen),
      check: inCheck(fen),
      lastMove: lastMove as Key[] | undefined,
      coordinates: true,
      movable: {
        free: false,
        color: colour,
        dests: colour ? (legalMoves(fen) as Map<Key, Key[]>) : new Map(),
        showDests: true,
        events: { after: moved },
      },
      premovable: { enabled: false },
      draggable: { showGhost: true },
    };
  }

  /** Puts chessground back on the props (after a move the parent did not take, or a cancelled promotion). */
  const sync = () => cg?.set(config());

  function moved(from: Key, to: Key) {
    if (isPromotion(fen, from, to)) {
      pending = { from, to };
      sync();
      tick().then(() => chooser?.querySelector('button')?.focus());
    } else play(from + to);
  }

  async function play(uci: string) {
    pending = null;
    invalid = false;
    const before = fen;
    onMove?.(uci);
    await tick();
    if (fen === before) sync();
  }

  function submit(e: SubmitEvent) {
    e.preventDefault();
    const uci = uciOf(fen, text);
    if (!uci) {
      invalid = true;
      return;
    }
    text = '';
    play(uci);
  }

  function keydown(e: KeyboardEvent) {
    if (pending && e.key === 'Escape') {
      e.preventDefault();
      play(pending.from + pending.to + 'q');
    }
  }

  $effect(() => {
    const c = config();
    cg?.set(c);
  });

  onMount(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    cg = Chessground(el, { ...config(), animation: { enabled: !reduced, duration: 200 } });
    return () => cg?.destroy();
  });
</script>

<svelte:window onkeydown={keydown} />

<div class="flex w-full flex-col gap-2">
  <div class="relative aspect-square w-full">
    <div
      bind:this={el}
      data-testid="board"
      data-fen={fen}
      data-orientation={orientation}
      class="board h-full w-full"
    ></div>
    {#if pending}
      <div
        bind:this={chooser}
        data-testid="board-promotion"
        role="dialog"
        aria-label={t('board.promotion')}
        class="absolute inset-0 z-10 flex items-center justify-center bg-black/40"
      >
        <div class="flex gap-2 rounded-card border border-border bg-surface p-2">
          {#each PIECES as piece (piece.p)}
            <button
              type="button"
              data-testid="board-promotion-{piece.p}"
              aria-label={t(`board.piece.${piece.p}`)}
              title={t(`board.piece.${piece.p}`)}
              onclick={() => pending && play(pending.from + pending.to + piece.p)}
              class="flex h-14 w-14 items-center justify-center rounded-control border border-border text-4xl leading-none hover:bg-bg"
            >{toMove(fen) === 'white' ? piece.white : piece.black}</button>
          {/each}
        </div>
      </div>
    {/if}
  </div>
  {#if movable !== 'none'}
    <form onsubmit={submit} class="flex flex-col gap-1">
      <label for="{id}-move-input" class="text-sm font-medium">{t('board.move_input')}</label>
      <input
        id="{id}-move-input"
        data-testid="board-move-input"
        bind:value={text}
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={invalid ? `${id}-move-invalid` : undefined}
        class="min-h-11 rounded-control border border-border bg-surface px-3 font-mono text-text"
      />
      {#if invalid}
        <p id="{id}-move-invalid" data-testid="board-move-invalid" role="alert" class="text-sm text-danger">
          {t('board.move_invalid')}
        </p>
      {/if}
    </form>
  {/if}
</div>

<style>
  /* Squares #f0d9b5 / #b58863 (docs/ui.md); last move from the brown theme, rgba(155, 199, 0, 0.41). */
  .board :global(cg-board) {
    background-color: #f0d9b5;
    background-image: repeating-conic-gradient(#b58863 0 25%, #f0d9b5 0 50%);
    background-size: 25% 25%;
  }
  .board :global(cg-board square.last-move) {
    background-color: rgba(155, 199, 0, 0.41);
  }
</style>
