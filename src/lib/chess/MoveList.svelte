<!--
  The moves of a game as an <ol> of move pairs; each move a button going to its ply. A marked move shows its symbol
  in its mark colour, and its aria-label adds the mark ("14. Nf3, mistake").
-->
<script lang="ts">
  import { translate, type Messages } from '$lib/i18n';
  import type { Mark } from './analysis';

  type Props = {
    sans: string[];
    ply: number | null;
    onSelect: (ply: number) => void;
    marks?: (Mark | null)[] | null;
    messages: Messages;
  };
  let { sans, ply, onSelect, marks = null, messages }: Props = $props();
  const pairs = $derived(Array.from({ length: Math.ceil(sans.length / 2) }, (_, i) => i));
  const SYMBOL: Record<Mark, string> = { inaccuracy: '?!', mistake: '?', blunder: '??' };
  const COLOUR: Record<Mark, string> = { inaccuracy: 'text-inaccuracy', mistake: 'text-mistake', blunder: 'text-blunder' };

  function label(p: number): string {
    const n = Math.ceil(p / 2);
    const base = p % 2 === 1 ? `${n}. ${sans[p - 1]}` : `${n}... ${sans[p - 1]}`;
    const m = marks?.[p - 1];
    return m ? `${base}, ${translate(messages, `review.mark.${m}`)}` : base;
  }
</script>

<ol data-testid="move-list" class="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-x-2 gap-y-1 font-mono text-sm">
  {#each pairs as i (i)}
    <li class="flex items-center gap-1">
      <span class="w-8 shrink-0 text-muted">{i + 1}.</span>
      {#each [2 * i + 1, 2 * i + 2] as p (p)}
        {#if p <= sans.length}
          {@const m = marks?.[p - 1] ?? null}
          <button
            type="button"
            data-testid="move"
            data-ply={p}
            aria-label={label(p)}
            aria-current={ply === p ? 'true' : undefined}
            onclick={() => onSelect(p)}
            class="group min-h-11 min-w-11 rounded-control px-2 hover:bg-bg aria-[current=true]:bg-accent aria-[current=true]:text-accent-text"
          >{sans[p - 1]}{#if m}<span
                aria-hidden="true"
                class="font-bold {COLOUR[m]} group-aria-[current=true]:text-accent-text">{SYMBOL[m]}</span
              >{/if}</button>
        {/if}
      {/each}
    </li>
  {/each}
</ol>
