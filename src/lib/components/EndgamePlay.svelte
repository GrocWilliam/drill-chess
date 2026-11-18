<!--
  The endgame board page: the position, oriented to the player's side. After each player move the browser checks
  for mate and draws, else asks /api/endgames/<id>/reply and plays the tablebase's reply 300 ms later. Each attempt
  ends in a pass or a fail, posted once to /api/endgames/<id>/attempts; Retry restores the position.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Board from '$lib/chess/Board.svelte';
  import BoardLayout from '$lib/components/BoardLayout.svelte';
  import Button from '$lib/components/Button.svelte';
  import { translate, type Messages } from '$lib/i18n';
  import { DRAW_MOVES, applyMove, initialState, judgeMove, outcome, playerMoveIndex, playerMoves, type PlayState } from './endgame-play';

  type Props = {
    messages: Messages;
    endgame: { id: string; goal: 'win' | 'draw'; fen: string; side: 'white' | 'black' };
  };
  let { messages, endgame }: Props = $props();
  const t = (k: string, p: Record<string, string> = {}) => translate(messages, k, p);

  type Phase = 'play' | 'waiting' | 'unavailable' | 'pass' | 'fail';
  let pos = $state<PlayState>(initialState(untrack(() => endgame.fen)));
  let phase = $state<Phase>('play');
  let failed = $state<number | null>(null);
  /** Bumped by Retry: answers and timers of an earlier attempt are ignored. */
  let attempt = 0;

  const ended = $derived(phase === 'pass' || phase === 'fail');
  const status = $derived.by(() => {
    if (phase === 'pass') return t('endgame.status.pass');
    if (phase === 'unavailable') return t('endgame.status.unavailable');
    if (phase === 'fail') {
      const san = failed === null ? '' : pos.moves[failed];
      return t(endgame.goal === 'win' ? 'endgame.status.gives_away' : 'endgame.status.loses', { san });
    }
    return t('endgame.status.your_move');
  });

  function finish(passed: boolean, failing: number | null = null) {
    phase = passed ? 'pass' : 'fail';
    failed = failing;
    fetch(`/api/endgames/${endgame.id}/attempts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ passed }),
    })
      .then((r) => r.json())
      .catch(() => {});
  }

  /** The browser's terminal checks after a move; true when the attempt ended. */
  function ends(byPlayer: boolean): boolean {
    const result = outcome(endgame.goal, pos, byPlayer);
    if (!result) return false;
    finish(result === 'pass', result === 'fail' ? playerMoveIndex(pos, byPlayer) : null);
    return true;
  }

  async function askReply() {
    const mine = attempt;
    const fen = pos.fen;
    phase = 'waiting';
    let answer: { category: string; reply: { uci: string; san: string } | null } | null = null;
    try {
      const res = await fetch(`/api/endgames/${endgame.id}/reply?fen=${encodeURIComponent(fen)}`);
      const body = await res.json().catch(() => null);
      if (res.ok) answer = body;
    } catch {
      answer = null;
    }
    if (mine !== attempt) return;
    if (!answer) {
      phase = 'unavailable';
      return;
    }
    if (judgeMove(endgame.goal, answer.category) === 'fail') return finish(false, pos.moves.length - 1);
    if (endgame.goal === 'draw' && playerMoves(pos) >= DRAW_MOVES) return finish(true);
    const reply = answer.reply;
    setTimeout(() => {
      if (mine !== attempt) return;
      const next = reply ? applyMove(pos, reply.uci) : null;
      if (!next) {
        phase = 'unavailable';
        return;
      }
      pos = next;
      phase = 'play';
      ends(false);
    }, 300);
  }

  function onMove(uci: string) {
    if (phase !== 'play') return;
    const next = applyMove(pos, uci);
    if (!next) return;
    pos = next;
    if (!ends(true)) askReply();
  }

  function retry() {
    attempt++;
    pos = initialState(endgame.fen);
    phase = 'play';
    failed = null;
  }
</script>

<BoardLayout>
  {#snippet board()}
    <Board {messages} fen={pos.fen} orientation={endgame.side} movable={ended ? 'none' : endgame.side} lastMove={pos.lastMove} {onMove} id="endgame" />
  {/snippet}
  {#snippet panel()}
    <h1 data-testid="endgame-name" class="text-xl font-bold">{t(`endgame.${endgame.id}.name`)}</h1>
    <p data-testid="endgame-goal" class="font-medium">{t(`endgames.goal.${endgame.goal}`)}</p>
    <p data-testid="endgame-lesson" class="text-muted">{t(`endgame.${endgame.id}.lesson`)}</p>
    <ol data-testid="endgame-moves" class="flex min-h-6 flex-wrap gap-2 font-mono">
      {#each pos.moves as san, n (n)}
        <li
          data-testid="endgame-move"
          data-failed={failed === n ? 'true' : undefined}
          class={failed === n ? 'rounded-control bg-danger/15 px-1 text-danger' : ''}
        >{san}</li>
      {/each}
    </ol>
    <p
      data-testid="endgame-status"
      role="status"
      class="font-medium {phase === 'fail' || phase === 'unavailable' ? 'text-danger' : ''}"
    >{status}</p>
    <div class="flex flex-wrap items-center gap-3">
      {#if phase === 'unavailable'}
        <Button variant="primary" data-testid="endgame-retry-move" onclick={askReply}>{t('endgame.retry_move')}</Button>
      {/if}
      <Button variant="secondary" data-testid="endgame-retry" onclick={retry}>{t('endgame.retry')}</Button>
      <a href="/endgames" data-testid="endgame-back" class="inline-flex min-h-11 min-w-11 items-center text-accent underline">{t('endgame.back')}</a>
    </div>
  {/snippet}
</BoardLayout>
