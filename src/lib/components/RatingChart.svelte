<!--
  The rating chart: inline SVG line chart of the rating after each game (x by date, y from the minimum − 20 to the
  maximum + 20), the line in the accent colour with a dot per game. Below, the same data as a table in a <details>.
-->
<script lang="ts">
  import { translate, type Lang, type Messages } from '$lib/i18n';

  type Props = { points: { at: string; rating: number }[]; messages: Messages; lang: Lang };
  let { points, messages, lang }: Props = $props();
  const t = (k: string) => translate(messages, k);

  const W = 340;
  const H = 120;
  const times = $derived(points.map((p) => new Date(p.at).getTime()));
  const t0 = $derived(Math.min(...times));
  const span = $derived(Math.max(...times) - t0);
  const lo = $derived(Math.min(...points.map((p) => p.rating)) - 20);
  const hi = $derived(Math.max(...points.map((p) => p.rating)) + 20);
  const x = (i: number) => (span > 0 ? ((times[i] - t0) / span) * W : (i / Math.max(1, points.length - 1)) * W);
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  const path = $derived(points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.rating).toFixed(1)}`).join(' '));
  const fmt = $derived(new Intl.DateTimeFormat(lang, { timeZone: 'UTC', dateStyle: 'medium' }));
</script>

<div data-testid="stats-rating-chart" class="flex flex-col gap-2">
  <svg viewBox="0 0 {W} {H}" class="block h-auto w-full max-w-full rounded-control border border-border bg-bg" role="img" aria-label={t('stats.rating.chart')}>
    <path d={path} fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
    {#each points as p, i (i)}
      <circle cx={x(i)} cy={y(p.rating)} r="2.5" fill="var(--accent)" />
    {/each}
  </svg>
  <details>
    <summary class="flex min-h-11 cursor-pointer items-center text-sm">{t('stats.rating.table')}</summary>
    <table class="w-full text-left text-sm">
      <thead>
        <tr>
          <th class="py-1 pr-2 font-medium">{t('stats.rating.col_date')}</th>
          <th class="py-1 font-medium">{t('stats.rating.col_rating')}</th>
        </tr>
      </thead>
      <tbody>
        {#each points as p, i (i)}
          <tr>
            <td class="py-0.5 pr-2">{fmt.format(new Date(p.at))}</td>
            <td class="py-0.5 font-mono">{p.rating}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </details>
</div>
