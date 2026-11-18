<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import { translate, translatePlural } from '$lib/i18n';

  let { data } = $props();
  const t = (k: string) => translate(data.messages, k);
  const colours = $derived([
    { colour: 'white', name: t('openings.home.white'), summary: data.white },
    { colour: 'black', name: t('openings.home.black'), summary: data.black },
  ] as const);
  const plural = (key: string, n: number) => translatePlural(data.messages, data.lang, `openings.home.${key}`, n);
</script>

<svelte:head><title>{t('openings.home.title')} · {t('app.name')}</title></svelte:head>

<main class="mx-auto max-w-6xl px-4 py-8 pb-24 md:pb-8">
  <h1 class="text-2xl font-semibold md:text-[32px]">{t('openings.home.title')}</h1>
  <div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
    {#each colours as c (c.colour)}
      <Card data-testid="openings-{c.colour}" class="flex flex-col gap-3">
        <h2 class="text-xl font-semibold">{c.name}</h2>
        {#if c.summary}
          <p data-testid="openings-positions">{plural('positions', c.summary.positions)}</p>
          <p data-testid="openings-due">{plural('due', c.summary.due)}</p>
          <p data-testid="openings-learned">{plural('learned', c.summary.learned)}</p>
          <a
            data-testid="drill-start"
            href="/openings/drill?colour={c.colour}"
            class="inline-flex min-h-11 items-center justify-center rounded-control border border-transparent bg-accent px-4 font-medium text-accent-text"
          >{t('openings.home.drill')}</a>
        {:else}
          <div data-testid="openings-empty">
            <EmptyState title={t('openings.home.empty')} />
          </div>
        {/if}
        <a
          data-testid="openings-edit-{c.colour}"
          href="/openings/{c.colour}"
          class="inline-flex min-h-11 items-center justify-center rounded-control border border-border px-4 font-medium text-text"
        >{t('openings.home.edit')}</a>
      </Card>
    {/each}
  </div>
  {#if data.white || data.black}
    <a
      data-testid="drill-start-both"
      href="/openings/drill?colour=both"
      class="mt-6 inline-flex min-h-11 items-center justify-center rounded-control border border-transparent bg-accent px-4 font-medium text-accent-text"
    >{t('openings.home.drill_both')}</a>
  {/if}
</main>
