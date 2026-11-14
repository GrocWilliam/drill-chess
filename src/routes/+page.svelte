<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import { translate } from '$lib/i18n';

  let { data } = $props();
  const t = (k: string) => translate(data.messages, k);
  const features = ['review', 'openings', 'endgames'];
</script>

<svelte:head>
  <title>{t('app.name')}</title>
</svelte:head>

<main class="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
  <section class="flex flex-col gap-4">
    <h1 class="text-2xl font-semibold md:text-[32px]">{t('landing.title')}</h1>
    <p class="max-w-2xl text-muted">{t('landing.pitch')}</p>
    <div class="flex flex-wrap gap-3">
      <a
        data-testid="landing-signup"
        href="/signup"
        class="inline-flex min-h-11 items-center rounded-control bg-accent px-4 font-medium text-accent-text"
      >{t('nav.signup')}</a>
      <a
        data-testid="landing-demo"
        href="/games/demo"
        class="inline-flex min-h-11 items-center rounded-control border border-border bg-surface px-4 font-medium"
      >{t('landing.demo')}</a>
    </div>
  </section>
  <section class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    {#each features as f (f)}
      <Card>
        <h2 class="text-xl font-semibold">{t(`landing.${f}.title`)}</h2>
        <p class="mt-2 text-muted">{t(`landing.${f}.text`)}</p>
      </Card>
    {/each}
  </section>
</main>
