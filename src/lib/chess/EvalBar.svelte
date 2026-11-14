<!--
  The evaluation bar: White's share of the bar = White's win chance (`winChance`), the score as text. Horizontal
  12px strip below 1024px, vertical 24px from 1024px (the parent sizes it). `ev` null = not analysed yet (50, no text).
-->
<script lang="ts">
  import { evalText, winChance, type Eval } from './analysis';

  type Props = { ev: Eval | null; turn: 'w' | 'b'; label: string; class?: string };
  let { ev, turn, label, class: extra = '' }: Props = $props();

  const white = $derived(ev ? Math.round(winChance(ev, turn) * 10) / 10 : 50);
  const text = $derived(ev ? evalText(ev, turn) : '');
</script>

<div
  data-testid="eval-bar"
  role="meter"
  aria-label={label}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-valuenow={white}
  aria-valuetext={text || undefined}
  class="eval-bar relative overflow-hidden rounded-control border border-border bg-[#2b2b2b] {extra}"
>
  <div class="eval-white absolute bg-[#f2f2f2] transition-all motion-reduce:transition-none" style="--w: {white}%"></div>
  <span
    class="absolute inset-0 flex items-center justify-center font-mono text-[10px] leading-none text-white mix-blend-difference lg:items-end lg:pb-1"
  >{text}</span>
</div>

<style>
  .eval-bar {
    height: 12px;
    width: 100%;
  }
  .eval-white {
    left: 0;
    top: 0;
    bottom: 0;
    width: var(--w);
  }
  @media (min-width: 1024px) {
    .eval-bar {
      height: auto;
      align-self: stretch;
      width: 24px;
    }
    .eval-white {
      top: auto;
      right: 0;
      width: auto;
      height: var(--w);
    }
  }
</style>
