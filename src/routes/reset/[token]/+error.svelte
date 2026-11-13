<script lang="ts">
  import { page } from '$app/state';
  import Card from '$lib/components/Card.svelte';
  import { translate } from '$lib/i18n';

  const t = (k: string) => translate(page.data.messages ?? {}, k);
</script>

<svelte:head>
  <title>{t('reset.title')} · {t('app.name')}</title>
</svelte:head>

<main class="mx-auto w-full max-w-sm px-4 py-8">
  <Card>
    <h1 class="mb-4 text-2xl font-semibold">{t('reset.title')}</h1>
    <p role="alert" data-testid="reset-invalid" class="text-danger">{t('reset.error.reset_invalid')}</p>
    <a href="/reset" class="mt-4 inline-flex min-h-11 items-center text-accent underline">{t('reset.invalid_to_reset')}</a>
  </Card>
</main>
