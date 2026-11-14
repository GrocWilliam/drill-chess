<script lang="ts">
  import EmptyState from '$lib/components/EmptyState.svelte';
  import ResponsiveTable from '$lib/components/ResponsiveTable.svelte';
  import ResultBar from '$lib/components/ResultBar.svelte';
  import RatingChart from '$lib/components/RatingChart.svelte';
  import Card from '$lib/components/Card.svelte';
  import { formatOneDecimal, translate, translatePlural } from '$lib/i18n';

  let { data } = $props();
  const t = (k: string) => translate(data.messages, k);
  const selects = [
    { name: 'site', options: ['chesscom', 'lichess'], label: (o: string) => t(`site.${o}`) },
    { name: 'time', options: ['bullet', 'blitz', 'rapid', 'classical', 'daily'], label: (o: string) => t(`timeclass.${o}`) },
    { name: 'period', options: ['30d', '90d', '365d', 'all'], label: (o: string) => t(`stats.period.${o}`) },
  ] as const;
  const figures = ['games', 'wins', 'draws', 'losses'] as const;
  const columns = (first: string) =>
    [first, ...figures, 'score', 'bar'].map((k) => ({ key: k, label: t(`stats.col.${k === first ? first : k}`) }));
  type Row = (typeof data.stats.colour)[number] | (typeof data.stats.time)[number] | (typeof data.stats.openings)[number];
  const series = $derived(data.stats.rating.series);
  const current = $derived(data.selectedSeries >= 0 ? series[data.selectedSeries] : null);
  const ratings = $derived(current ? current.points.map((p) => p.rating) : []);
  const summary = $derived(
    ratings.length >= 2
      ? ([['first', ratings[0]], ['last', ratings[ratings.length - 1]], ['highest', Math.max(...ratings)], ['lowest', Math.min(...ratings)]] as const)
      : [],
  );
  const phases = ['opening', 'middlegame', 'endgame'] as const;
  const marks = [
    { key: 'inaccuracy', symbol: '?!', colour: 'text-inaccuracy' },
    { key: 'mistake', symbol: '?', colour: 'text-mistake' },
    { key: 'blunder', symbol: '??', colour: 'text-blunder' },
  ] as const;
  const num = (n: number) => formatOneDecimal(n, data.lang);
  const openingColumns = ['eco', 'games', 'wins', 'draws', 'losses', 'score', 'bar', 'opening'].map((k) => ({
    key: k,
    label: t(k === 'eco' ? 'stats.col.eco' : k === 'opening' ? 'stats.col.opening' : `stats.col.${k}`),
  }));
  type OpeningRow = (typeof data.stats.openings)[number];
  const total = $derived(data.stats.colour.reduce((n, r) => n + r.games, 0));
</script>

<svelte:head><title>{t('stats.title')} · {t('app.name')}</title></svelte:head>

{#snippet figure(r: Row, key: string, name: string)}
  {#if key === 'bar'}
    <ResultBar wins={r.wins} draws={r.draws} losses={r.losses} messages={data.messages} />
  {:else if key === 'score'}
    <span class="text-muted md:hidden">{t('stats.col.score')} </span><span class="font-medium">{r.score}%</span>
  {:else if key !== name}
    <span class="text-muted md:hidden">{t(`stats.col.${key}`)} </span><span>{r[key as (typeof figures)[number]]}</span>
  {/if}
{/snippet}

<main class="mx-auto max-w-6xl px-4 py-8 pb-24 md:pb-8">
  <h1 class="text-2xl font-semibold md:text-[32px]">{t('stats.title')}</h1>
  <form method="GET" action="/stats" data-testid="stats-filters" aria-label={t('stats.filters')} class="mt-6 grid grid-cols-1 gap-3 md:grid-cols-5">
    {#each selects as f}
      <label class="flex min-w-0 flex-col gap-1 text-sm text-muted">
        {t(`stats.filter.${f.name}`)}
        <select name={f.name} class="min-h-11 w-full rounded-control border border-border bg-bg px-3 text-base text-text">
          {#if f.name !== 'period'}<option value="all" selected={data.values[f.name] === 'all'}>{t('stats.filter.all')}</option>{/if}
          {#each f.options as o}
            <option value={o} selected={data.values[f.name] === o}>{f.label(o)}</option>
          {/each}
        </select>
      </label>
    {/each}
    {#if series.length > 0}
      <label class="flex min-w-0 flex-col gap-1 text-sm text-muted">
        {t('stats.rating.series')}
        <select name="series" data-testid="stats-rating-series" class="min-h-11 w-full rounded-control border border-border bg-bg px-3 text-base text-text">
          {#each series as s, i (i)}
            <option value="{s.site}-{s.time}" selected={i === data.selectedSeries}>{t(`site.${s.site}`)} · {t(`timeclass.${s.time}`)}</option>
          {/each}
        </select>
      </label>
    {/if}
    <label class="flex min-w-0 flex-col gap-1 text-sm text-muted">
      {t('stats.filter.openingsColour')}
      <select name="openingsColour" data-testid="stats-openings-colour" class="min-h-11 w-full rounded-control border border-border bg-bg px-3 text-base text-text">
        {#each ['both', 'white', 'black'] as o}
          <option value={o} selected={data.values.openingsColour === o}>{t(`stats.openings.${o}`)}</option>
        {/each}
      </select>
    </label>
    <button type="submit" data-testid="stats-filter-submit" class="inline-flex min-h-11 min-w-11 items-center justify-center self-end rounded-control border border-transparent bg-accent px-4 font-medium text-accent-text">{t('stats.filter.submit')}</button>
  </form>

  {#if total === 0}
    <div data-testid="stats-empty" class="mt-6">
      <EmptyState title={t(data.hasLinked ? 'stats.empty.filtered' : 'stats.empty.none')} text={t(data.hasLinked ? 'stats.empty.filtered.text' : 'stats.empty.none.text')}>
        {#snippet action()}
          <a href={data.emptyHref} class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border border-border px-4 font-medium text-text">{t(data.hasLinked ? 'stats.empty.filtered.action' : 'stats.empty.none.action')}</a>
        {/snippet}
      </EmptyState>
    </div>
  {:else}
    <section data-testid="stats-colour" class="mt-8">
      <h2 class="mb-2 text-xl font-semibold">{t('stats.colour.title')}</h2>
      <Card>
        <ResponsiveTable columns={columns('colour')} rows={data.stats.colour} rowTestid="stats-colour-row" rowId={(r) => r.colour} href={() => '/games'} rowAttrs={(r) => ({ 'data-colour': r.colour })} label={t('stats.colour.title')}>
          {#snippet cell(r, key)}
            {#if key === 'colour'}<span class="font-medium">{t(`colour.${r.colour}`)}</span>{:else}{@render figure(r, key, 'colour')}{/if}
          {/snippet}
        </ResponsiveTable>
      </Card>
    </section>

    <section data-testid="stats-time" class="mt-8">
      <h2 class="mb-2 text-xl font-semibold">{t('stats.time.title')}</h2>
      <Card>
        <ResponsiveTable columns={columns('time')} rows={data.stats.time} rowTestid="stats-time-row" rowId={(r) => r.time} href={(r) => data.timeHrefs[r.time]} rowAttrs={(r) => ({ 'data-time': r.time })} label={t('stats.time.title')}>
          {#snippet cell(r, key)}
            {#if key === 'time'}<a href={data.timeHrefs[r.time]} class="inline-flex min-h-11 min-w-11 items-center font-medium text-accent underline">{t(`timeclass.${r.time}`)}</a>{:else}{@render figure(r, key, 'time')}{/if}
          {/snippet}
        </ResponsiveTable>
      </Card>
    </section>

    <section data-testid="stats-openings" class="mt-8">
      <h2 class="mb-2 text-xl font-semibold">{t('stats.openings.title')}</h2>
      <Card>
        <ResponsiveTable columns={openingColumns} rows={data.stats.openings} rowTestid="stats-opening-row" rowId={(r) => `${r.eco ?? ''}|${r.opening ?? ''}`} href={(r) => data.openingHrefs[data.stats.openings.indexOf(r)] ?? '/games'} label={t('stats.openings.title')}>
          {#snippet cell(r: OpeningRow, key)}
            {@const link = data.openingHrefs[data.stats.openings.indexOf(r)]}
            {#if key === 'eco'}<span class="text-muted">{r.eco ?? ''}</span>
            {:else if key === 'opening'}
              {#if link}<a href={link} class="inline-flex min-h-11 min-w-11 items-center break-words font-medium text-accent underline">{r.opening}</a>
              {:else}<span class="break-words font-medium">{t('stats.openings.unknown')}</span>{/if}
            {:else}{@render figure(r, key, 'opening')}{/if}
          {/snippet}
        </ResponsiveTable>
      </Card>
    </section>

    <section data-testid="stats-rating" class="mt-8">
      <h2 class="mb-2 text-xl font-semibold">{t('stats.rating.title')}</h2>
      <Card>
        {#if current && current.points.length >= 2}
          <RatingChart points={current.points} messages={data.messages} lang={data.lang} />
          <dl data-testid="stats-rating-summary" class="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
            {#each summary as [k, v] (k)}
              <div><dt class="text-muted">{t(`stats.rating.${k}`)}</dt><dd class="font-medium">{v}</dd></div>
            {/each}
          </dl>
        {:else}
          <p data-testid="stats-rating-not-enough" class="text-muted">{t('stats.rating.not_enough')}</p>
        {/if}
      </Card>
    </section>

    <section data-testid="stats-mistakes" class="mt-8">
      <h2 class="mb-2 text-xl font-semibold">{t('stats.mistakes.title')}</h2>
      <Card>
        {#if data.stats.mistakes.games === 0}
          <div data-testid="stats-mistakes-empty">
            <EmptyState title={t('stats.mistakes.empty')}>
              {#snippet action()}
                <a href="/games" class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border border-border px-4 font-medium text-text">{t('stats.mistakes.empty.action')}</a>
              {/snippet}
            </EmptyState>
          </div>
        {:else}
          <p class="mb-3 flex flex-wrap gap-x-6 gap-y-1">
            <span data-testid="stats-mistakes-games">{translatePlural(data.messages, data.lang, 'stats.mistakes.games', data.stats.mistakes.games)}</span>
            <span data-testid="stats-mistakes-accuracy">{t('stats.mistakes.accuracy')} {num(data.stats.mistakes.accuracy ?? 0)}%</span>
          </p>
          <table class="w-full text-left">
            <caption class="sr-only">{t('stats.mistakes.title')}</caption>
            <thead>
              <tr>
                <th scope="col" class="py-2 pr-2 font-medium text-muted">{t('stats.mistakes.phase')}</th>
                {#each marks as m}
                  <th scope="col" class="px-1 py-2 text-right font-medium"><span class="font-bold {m.colour}">{m.symbol}</span> <span class="block text-sm text-muted sm:inline">{t(`review.mark.${m.key}`)}</span></th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each phases as ph}
                <tr data-testid="stats-mistakes-phase" data-phase={ph} class="border-t border-border">
                  <th scope="row" class="py-2 pr-2 font-medium">{t(`stats.phase.${ph}`)}</th>
                  {#each marks as m}
                    <td class="px-1 py-2 text-right">{num(data.stats.mistakes.byPhase[ph][m.key])}</td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </Card>
    </section>
  {/if}
</main>
