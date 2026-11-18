<script lang="ts">
  import Badge from '$lib/components/Badge.svelte';
  import { translate } from '$lib/i18n';

  let { data } = $props();
  const t = (k: string, p: Record<string, string | number> = {}) => translate(data.messages, k, p);
  // French treats 0 as singular; here only exactly 1 is ("0 essais").
  const attempts = (n: number) => translate(data.messages, `endgames.attempts_${n === 1 ? 'one' : 'other'}`, { n });
</script>

<svelte:head><title>{t('endgames.title')} · {t('app.name')}</title></svelte:head>

<main class="mx-auto max-w-6xl px-4 py-8 pb-24 md:pb-8">
  <h1 class="text-2xl font-semibold md:text-[32px]">{t('endgames.title')}</h1>
  {#each data.levels as lvl (lvl.level)}
    {@const done = lvl.positions.filter((p) => p.progress.mastered).length}
    <section data-testid="endgames-level-{lvl.level}" class="mt-8">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="text-xl font-semibold">{t(`endgames.level.${lvl.level}`)}</h2>
        <p data-testid="endgames-level-count" class="text-muted">{t('endgames.count', { done, total: lvl.positions.length })}</p>
      </div>
      <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {#each lvl.positions as p (p.id)}
          <a
            data-testid="endgame-card"
            data-id={p.id}
            href="/endgames/{p.id}"
            class="flex min-h-11 flex-col gap-2 rounded-card border border-border bg-surface p-4"
          >
            <span class="flex flex-wrap items-center justify-between gap-2">
              <span class="font-medium">{t(`endgame.${p.id}.name`)}</span>
              {#if p.progress.mastered}<Badge tone="accent" data-testid="endgame-mastered">{t('endgames.mastered')}</Badge>{/if}
            </span>
            <span class="text-muted">{t(`endgames.goal.${p.goal}`)}</span>
            <span class="flex gap-4 text-sm text-muted">
              <span data-testid="endgame-streak">{Math.min(p.progress.streak, 3)}/3</span>
              <span data-testid="endgame-attempts">{attempts(p.progress.attempts)}</span>
            </span>
          </a>
        {/each}
      </div>
    </section>
  {/each}
</main>
