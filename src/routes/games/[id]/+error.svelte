<script lang="ts">
  import { page } from '$app/state';
  import { translate } from '$lib/i18n';

  const t = (k: string) => translate(page.data.messages ?? {}, k);
</script>

<svelte:head>
  <title>{t('game.notfound')} · {t('app.name')}</title>
</svelte:head>

<main class="mx-auto max-w-6xl px-4 py-8">
  <h1 class="text-2xl font-semibold">{t('game.notfound')}</h1>
  <a href="/games" class="mt-4 inline-flex min-h-11 items-center text-accent underline">{t('game.back')}</a>
</main>
