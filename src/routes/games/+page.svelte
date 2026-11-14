<script lang="ts">
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import ResponsiveTable from '$lib/components/ResponsiveTable.svelte';
  import Button from '$lib/components/Button.svelte';
  import LinkForm from '$lib/components/LinkForm.svelte';
  import { formatOneDecimal, translate, translatePlural } from '$lib/i18n';
  import { invalidateAll } from '$app/navigation';
  import { onMount } from 'svelte';

  let { data, form } = $props();
  const t = (k: string) => translate(data.messages, k);
  const fmt = $derived(new Intl.DateTimeFormat(data.lang, { timeZone: 'UTC' }));
  const selects = [
    { name: 'site', prefix: 'site', options: ['chesscom', 'lichess'] },
    { name: 'colour', prefix: 'colour', options: ['white', 'black'] },
    { name: 'result', prefix: 'result', options: ['win', 'draw', 'loss'] },
    { name: 'time', prefix: 'timeclass', options: ['bullet', 'blitz', 'rapid', 'classical', 'daily'] },
  ] as const;
  const columns = ['date', 'site', 'timeclass', 'clock', 'colour', 'opponent', 'result', 'opening'].map((key) => ({
    key,
    label: translate(data.messages, `games.col.${key}`),
  }));

  const statusText = (j: { status: string; imported: number; skipped: number; error: string | null }) =>
    j.status === 'failed'
      ? t(j.error === 'site_unavailable' ? 'games.status.failed.site_unavailable' : 'games.status.failed.internal')
      : j.status === 'done'
      ? translate(data.messages, 'games.status.done', {
          imported: translatePlural(data.messages, data.lang, 'games.status.imported', j.imported),
          skipped: translatePlural(data.messages, data.lang, 'games.status.skipped', j.skipped),
        })
      : translatePlural(data.messages, data.lang, 'games.status.running', j.imported);

  onMount(() => {
    // A chained timeout, not setInterval: a late tick under load must not bunch up with the next one (gaps stay ≥ 2 s).
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => (timer = setTimeout(tick, 2000));
    const tick = async () => {
      schedule();
      if (!data.active) return;
      try {
        const res = await fetch('/api/import/status', { headers: { accept: 'application/json' } });
        if (!res.ok) return;
        const body = await res.json();
        if (!body.jobs.some((j: { status: string }) => j.status === 'queued' || j.status === 'running')) await invalidateAll();
      } catch {
        // network hiccup: try again on the next tick
      }
    };
    schedule();
    return () => clearTimeout(timer);
  });
</script>

<svelte:head>
  <title>{t('games.title')} · {t('app.name')}</title>
  {#if data.active}
    <noscript><meta http-equiv="refresh" content="2" /></noscript>
  {/if}
</svelte:head>

<main class="mx-auto max-w-6xl px-4 py-8">
  <h1 class="text-2xl font-semibold md:text-[32px]">{t('games.title')}</h1>
  {#if data.linkedCount === 0}
    <div data-testid="games-empty">
      <EmptyState title={t('games.empty')}>
        {#snippet action()}
          <div class="flex w-full max-w-md flex-col gap-4 text-left">
            {#each ['chesscom', 'lichess'] as const as site}
              <div data-testid="link-{site}">
                <LinkForm {site} messages={data.messages} error={form?.link?.site === site ? form.link.error : undefined} username={form?.link?.site === site ? form.link.username : ''} />
              </div>
            {/each}
          </div>
        {/snippet}
      </EmptyState>
    </div>
  {:else}
    <div class="mt-4 flex flex-wrap gap-2">
      {#each data.sites as site (site)}
        <form method="POST" action="?/sync">
          <input type="hidden" name="site" value={site} />
          <Button type="submit" variant="secondary" data-testid="games-sync-{site}" aria-label="{t('games.sync')} {t(`site.${site}`)}">{t('games.sync')}</Button>
        </form>
      {/each}
    </div>
    {#if form?.sync?.error || form?.link?.error}
      <p role="alert" class="mt-2 text-sm text-danger">{t(`link.error.${form.sync?.error ?? form.link?.error}`)}</p>
    {/if}
    {#if data.imports.length > 0}
      <div data-testid="games-status" class="mt-4 text-sm text-muted" role="status">
        {#each data.imports as j (j.site)}
          {#if j.status === 'failed'}
            <p role="alert" class="break-words text-danger">{statusText(j)}</p>
          {:else}
            <p class="break-words">{statusText(j)}</p>
          {/if}
        {/each}
      </div>
    {/if}
    <form method="GET" action="/games" data-testid="games-filters" class="mt-6 grid grid-cols-1 gap-3 md:grid-cols-5 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto_auto]">
      {#each selects as f}
        <label class="flex min-w-0 flex-col gap-1 text-sm text-muted">
          {t(`games.filter.${f.name}`)}
          <select name={f.name} class="min-h-11 w-full rounded-control border border-border bg-bg px-3 text-base text-text">
            <option value="" selected={!data.values[f.name]}>{t('games.filter.all')}</option>
            {#each f.options as o}
              <option value={o} selected={data.values[f.name] === o}>{t(`${f.prefix}.${o}`)}</option>
            {/each}
          </select>
        </label>
      {/each}
      <label class="flex min-w-0 flex-col gap-1 text-sm text-muted">
        {t('games.filter.opening')}
        <input type="text" name="opening" value={data.values.opening} maxlength="100" class="min-h-11 w-full rounded-control border border-border bg-bg px-3 text-base text-text" />
      </label>
      <button type="submit" data-testid="games-filter-submit" class="inline-flex min-h-11 min-w-11 items-center justify-center self-end rounded-control border border-transparent bg-accent px-4 font-medium text-accent-text">{t('games.filter.submit')}</button>
      <a href="/games" data-testid="games-filter-reset" class="inline-flex min-h-11 min-w-11 items-center justify-center self-end rounded-control border border-border px-4 font-medium text-text">{t('games.filter.reset')}</a>
    </form>
    {#if data.games.length === 0}
      <div data-testid="games-none" class="mt-6 flex flex-col items-start gap-4">
        <p class="text-muted">{t('games.none')}</p>
        <a href="/games" data-testid="games-filter-reset" class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border border-border px-4 font-medium text-text">{t('games.filter.reset')}</a>
      </div>
    {:else}
    <div data-testid="games-list" class="mt-6">
      <ResponsiveTable {columns} rows={data.games} rowTestid="games-row" rowId={(g) => g.id} href={(g) => `/games/${g.id}`} label={t('games.list')}>
        {#snippet cell(g, key)}
          {#if key === 'date'}
            <a href="/games/{g.id}" class="inline-flex min-h-11 min-w-11 items-center font-medium text-accent underline">{fmt.format(new Date(g.endedAt))}</a>
          {:else if key === 'site'}
            <Badge>{t(`site.${g.site}`)}</Badge>
          {:else if key === 'timeclass'}
            <Badge>{t(`timeclass.${g.timeClass}`)}</Badge>
          {:else if key === 'clock'}
            <span>{g.clock}</span>
          {:else if key === 'colour'}
            <span>{t(`colour.${g.colour}`)}</span>
          {:else if key === 'opponent'}
            <span class="break-all">{g.opponent}</span> {#if g.opponentRating !== null}<span class="text-muted">{g.opponentRating}</span>{/if}
          {:else if key === 'result'}
            <span class="font-medium {g.result === 'win' ? 'text-accent' : g.result === 'loss' ? 'text-danger' : 'text-muted'}">{t(`result.${g.result}`)}</span>
            {#if data.analysed[g.id] !== undefined}
              {@const accuracy = formatOneDecimal(data.analysed[g.id], data.lang)}
              <Badge data-testid="games-analysed" role="img" aria-label={translate(data.messages, 'games.accuracy', { value: accuracy })} tone="accent">{accuracy}</Badge>
            {/if}
          {:else if g.eco || g.opening}
            <span class="text-sm">{[g.eco, g.opening].filter(Boolean).join(' ')}</span>
          {/if}
        {/snippet}
      </ResponsiveTable>
    </div>
    {#if data.prevHref || data.nextHref}
      <nav aria-label={t('games.paging')} class="mt-6 flex items-center justify-between gap-4">
        {#if data.prevHref}
          <a href={data.prevHref} data-testid="games-prev" rel="prev" class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border border-border px-4 font-medium text-text">{t('games.prev')}</a>
        {:else}<span></span>{/if}
        {#if data.nextHref}
          <a href={data.nextHref} data-testid="games-next" rel="next" class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border border-border px-4 font-medium text-text">{t('games.next')}</a>
        {/if}
      </nav>
    {/if}
    {/if}
  {/if}
</main>
