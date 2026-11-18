<!--
  The drill client of /openings/drill: plays the line from the start (opponent moves and the player's non-due moves
  automatically, 300 ms apart), waits at each due card for the player's move, reviews the card (right first time =
  correct; a wrong move is undone, shows the right one with an arrow and reviews the card wrong once), then fetches
  the next line. With no line left it shows `drill-none`.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Board from '$lib/chess/Board.svelte';
  import { play } from '$lib/chess/rules';
  import BoardLayout from '$lib/components/BoardLayout.svelte';
  import Card from '$lib/components/Card.svelte';
  import { translate, type Messages } from '$lib/i18n';
  import {
    AUTO_DELAY, DRILL_CARDS, START_FEN, arrowOf, editHref, formatDay, judge, lineQuery, parseLine, stepAt,
    type DrillColour, type DrillLine, type DrillMove,
  } from './opening-drill';

  type Props = { messages: Messages; lang: string; colour: DrillColour; seed: number | null; first: DrillLine };
  let { messages, lang, colour, seed, first }: Props = $props();
  const t = (k: string, p: Record<string, string | number> = {}) => translate(messages, k, p);

  let line = $state<DrillLine>(untrack(() => first));
  let fen = $state(START_FEN);
  let lastMove = $state<[string, string] | undefined>();
  let waiting = $state<DrillMove | null>(null);
  let feedback = $state<{ kind: 'right' | 'wrong'; text: string } | null>(null);
  let shapes = $state<{ orig: string; dest: string; brush?: string }[]>([]);
  let reviewed = $state(0);
  let right = $state(0);
  let wrong = $state(0);
  /** Set when the drill is over: the next due date (`'today'` when a line is due, a YYYY-MM-DD day, or null). */
  let summary = $state<{ next: string | null; today: boolean } | null>(null);
  let error = $state('');

  /** Index of the next move of the line; line number k of this drill; whether the awaited card was missed. */
  let i = 0;
  let k = 0;
  let missed = false;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
  const pending: Promise<unknown>[] = [];

  const active = $derived('colour' in line ? line : null);
  const nextDue = $derived('nextDue' in line ? line.nextDue : null);

  function apply(uci: string): boolean {
    const next = play(fen, uci);
    if (!next) return false;
    fen = next;
    lastMove = [uci.slice(0, 2), uci.slice(2, 4)];
    i++;
    return true;
  }

  function advance() {
    if (stopped || !active) return;
    const step = stepAt(active.moves, i);
    if (step.kind === 'wait') {
      waiting = step.move;
      missed = false;
      return;
    }
    timer = setTimeout(() => {
      if (stopped) return;
      if (step.kind === 'end' || !apply(step.move.uci)) void loadNext();
      else advance();
    }, AUTO_DELAY);
  }

  function send(cardId: string, correct: boolean) {
    reviewed++;
    if (correct) right++;
    else wrong++;
    const p = fetch(`/api/openings/cards/${encodeURIComponent(cardId)}/review`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ correct }),
    })
      .then(async (res) => {
        // Read the body (the updated card) so the request completes.
        await res.json().catch(() => null);
        if (!res.ok) throw new Error();
      })
      .catch(() => {
        error = t('drill.error.network');
      });
    pending.push(p);
  }

  /** Fetches line `n` of the drill; null when the request failed or the answer is malformed. */
  async function fetchLine(n: number): Promise<DrillLine | null> {
    try {
      const res = await fetch(`/api/openings/drill?${lineQuery(colour, seed, n)}`);
      return res.ok ? parseLine(await res.json()) : null;
    } catch {
      return null;
    }
  }

  /** Whether the player has a due card to answer in `l` (a line without one is skipped, not played). */
  const hasDue = (l: DrillLine) => l.moves.some((_, n) => stepAt(l.moves, n).kind === 'wait');

  async function loadNext() {
    await Promise.all(pending.splice(0));
    if (stopped) return;
    let next: DrillLine | null = null;
    // The server picks lines at random weighted by their due cards, so it may return a line with none: skip it.
    for (let tries = 0; tries < 200; tries++) {
      k++;
      next = await fetchLine(k);
      if (stopped) return;
      if (!next || next.moves.length === 0 || hasDue(next)) break;
    }
    if (!next) {
      error = t('drill.error.network');
      return;
    }
    if (next.moves.length === 0) {
      summary = { next: 'nextDue' in next ? next.nextDue : null, today: false };
      waiting = null;
      return;
    }
    line = next;
    fen = START_FEN;
    lastMove = undefined;
    shapes = [];
    i = 0;
    advance();
  }

  /** Ends the drill after DRILL_CARDS cards: one more fetch tells whether a line is still due. */
  async function finish() {
    waiting = null;
    await Promise.all(pending.splice(0));
    if (stopped) return;
    const next = await fetchLine(k + 1);
    if (stopped) return;
    if (!next) {
      error = t('drill.error.network');
      return;
    }
    summary = next.moves.length > 0 ? { next: null, today: true } : { next: 'nextDue' in next ? next.nextDue : null, today: false };
  }

  function showFeedback(kind: 'right' | 'wrong', text: string) {
    clearTimeout(feedbackTimer);
    feedback = { kind, text };
    if (kind === 'right') feedbackTimer = setTimeout(() => (feedback = null), 1500);
  }

  function onMove(uci: string) {
    const move = waiting;
    if (!move) return;
    const { correct, review } = judge(move, uci, missed);
    if (review !== null) send(move.cardId!, review);
    if (!correct) {
      missed = true;
      shapes = [arrowOf(move.uci)];
      showFeedback('wrong', t('drill.wrong', { san: move.san }));
      return;
    }
    waiting = null;
    shapes = [];
    if (review !== null) showFeedback('right', t('drill.correct'));
    else {
      clearTimeout(feedbackTimer);
      feedback = null;
    }
    apply(uci);
    if (reviewed >= DRILL_CARDS) {
      void finish();
      return;
    }
    advance();
  }

  onMount(() => {
    advance();
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(feedbackTimer);
    };
  });
</script>

{#if summary}
  <main class="mx-auto max-w-6xl px-4 py-8 pb-24 md:pb-8">
    <Card data-testid="drill-summary" class="flex flex-col items-start gap-3">
      <h2 class="text-lg font-bold">{t('drill.summary.title')}</h2>
      <p data-testid="drill-summary-right">{t('drill.summary.right', { n: right })}</p>
      <p data-testid="drill-summary-wrong">{t('drill.summary.wrong', { n: wrong })}</p>
      <p data-testid="drill-summary-next">
        {t('drill.summary.next', { date: summary.today ? t('drill.summary.today') : summary.next ? formatDay(summary.next, lang) : t('drill.summary.none') })}
      </p>
      {#if error}
        <p data-testid="drill-error" role="alert" class="text-danger">{error}</p>
      {/if}
      <div class="flex flex-wrap gap-3">
        <a
          data-testid="drill-summary-again"
          href="/openings/drill?colour={colour}"
          class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border border-transparent bg-accent px-4 font-medium text-accent-text"
        >{t('drill.summary.again')}</a>
        <a data-testid="drill-summary-back" href="/openings" class="inline-flex min-h-11 min-w-11 items-center text-accent underline">{t('drill.summary.back')}</a>
      </div>
    </Card>
  </main>
{:else if active}
  <BoardLayout>
    {#snippet board()}
      <div data-testid="drill-board">
        <Board {messages} {fen} orientation={active.colour} movable={active.colour} {lastMove} {shapes} {onMove} id="drill" />
      </div>
    {/snippet}
    {#snippet panel()}
      <p data-testid="drill-progress" class="flex flex-col gap-1">
        <span class="font-mono text-muted">{t('drill.progress', { n: reviewed, total: DRILL_CARDS })}</span>
        <span data-testid="opening-name" class="text-lg font-bold">{active.opening ? `${active.opening.eco} ${active.opening.name}` : ''}</span>
      </p>
      <p
        data-testid="drill-feedback"
        role="status"
        class="min-h-6 font-medium {feedback?.kind === 'wrong' ? 'text-danger' : 'text-accent'}"
      >{feedback?.text ?? ''}</p>
      {#if error}
        <p data-testid="drill-error" role="alert" class="text-danger">{error}</p>
      {/if}
      <noscript><p data-testid="drill-noscript" role="alert">{t('drill.noscript')}</p></noscript>
      <a href="/openings" data-testid="drill-back" class="inline-flex min-h-11 min-w-11 items-center text-accent underline">{t('drill.back')}</a>
    {/snippet}
  </BoardLayout>
{:else}
  <main class="mx-auto max-w-6xl px-4 py-8 pb-24 md:pb-8">
    <Card data-testid="drill-none" class="flex flex-col items-start gap-3">
      <p class="text-lg">{nextDue ? t('drill.none.until', { date: formatDay(nextDue, lang) }) : t('drill.none.yet')}</p>
      {#if error}
        <p data-testid="drill-error" role="alert" class="text-danger">{error}</p>
      {/if}
      <a
        data-testid="drill-none-edit"
        href={editHref(colour)}
        class="inline-flex min-h-11 items-center justify-center rounded-control border border-transparent bg-accent px-4 font-medium text-accent-text"
      >{t('drill.none.edit')}</a>
    </Card>
  </main>
{/if}
