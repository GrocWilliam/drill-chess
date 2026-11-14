<!--
  The evaluation curve: inline SVG of White's win chance (0–100) per ply 0…plies, a 50 line, the marked moves as dots
  in their mark colour and the current ply as a vertical line. Each ply has a full-height click target. Below, the
  same data as a table in a <details>.
-->
<script lang="ts">
  import { translate, formatOneDecimal, type Lang, type Messages } from '$lib/i18n';
  import type { Mark } from './analysis';

  type Props = {
    /** White's win chance (0–100) for plies 0…plies. */
    wins: number[];
    marks: (Mark | null)[];
    sans: string[];
    ply: number | null;
    onSelect: (ply: number) => void;
    messages: Messages;
    lang: Lang;
  };
  let { wins, marks, sans, ply, onSelect, messages, lang }: Props = $props();
  const t = (k: string) => translate(messages, k);

  const W = 340;
  const H = 100;
  const n = $derived(Math.max(1, wins.length - 1));
  const x = (i: number) => (i / n) * W;
  const y = (v: number) => H - (v / 100) * H;
  const path = $derived(wins.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' '));
  const FILL: Record<Mark, string> = { inaccuracy: 'fill-inaccuracy', mistake: 'fill-mistake', blunder: 'fill-blunder' };

  function label(p: number): string {
    return p % 2 === 1 ? `${Math.ceil(p / 2)}. ${sans[p - 1]}` : `${p / 2}... ${sans[p - 1]}`;
  }
</script>

<div data-testid="eval-curve" class="flex flex-col gap-2">
  <svg viewBox="0 0 {W} {H}" class="block h-auto w-full rounded-control border border-border bg-bg" role="img" aria-label={t('review.curve')}>
    <line x1="0" x2={W} y1={y(50)} y2={y(50)} class="stroke-border" stroke-width="1" stroke-dasharray="4 3" />
    <path d={path} fill="none" class="stroke-text" stroke-width="1.5" />
    {#if ply !== null}
      <line x1={x(ply)} x2={x(ply)} y1="0" y2={H} class="stroke-accent" stroke-width="1.5" />
    {/if}
    {#each marks as m, i (i)}
      {#if m}
        <circle cx={x(i + 1)} cy={y(wins[i + 1] ?? 50)} r="3" class={FILL[m]} />
      {/if}
    {/each}
    {#each wins as _, i (i)}
      <rect
        data-testid="eval-curve-ply"
        data-ply={i}
        role="button"
        tabindex="-1"
        aria-label={i === 0 ? t('review.start') : label(i)}
        x={i === 0 ? 0 : x(i) - W / n / 2}
        width={i === 0 || i === n ? W / n / 2 : W / n}
        y="0"
        height={H}
        fill="transparent"
        class="cursor-pointer"
        onclick={() => onSelect(i)}
        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(i)}
      />
    {/each}
  </svg>
  <details>
    <summary class="flex min-h-11 cursor-pointer items-center text-sm">{t('review.curve_table')}</summary>
    <table class="w-full text-left text-sm">
      <thead>
        <tr>
          <th class="py-1 pr-2 font-medium">{t('review.col_move')}</th>
          <th class="py-1 pr-2 font-medium">{t('review.col_white')}</th>
          <th class="py-1 font-medium">{t('review.col_mark')}</th>
        </tr>
      </thead>
      <tbody>
        {#each sans as _, i (i)}
          {@const m = marks[i]}
          <tr>
            <td class="py-0.5 pr-2 font-mono">{label(i + 1)}</td>
            <td class="py-0.5 pr-2 font-mono">{formatOneDecimal(wins[i + 1] ?? 50, lang)}</td>
            <td class="py-0.5">{m ? t(`review.mark.${m}`) : ''}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </details>
</div>
