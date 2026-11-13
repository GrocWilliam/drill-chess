<script lang="ts">
  import { enhance } from '$app/forms';
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import Field from '$lib/components/Field.svelte';
  import { translate } from '$lib/i18n';

  let { data, form } = $props();
  const t = (k: string) => translate(data.messages, k);
  let busy = $state(false);
</script>

<svelte:head>
  <title>{t('reset.title')} · {t('app.name')}</title>
</svelte:head>

<main class="mx-auto w-full max-w-sm px-4 py-8">
  <Card>
    <h1 class="mb-4 text-2xl font-semibold">{t('reset.title')}</h1>
    <form
      method="POST"
      class="flex flex-col gap-4"
      use:enhance={() => {
        busy = true;
        return async ({ update }) => {
          await update({ reset: false });
          busy = false;
        };
      }}
    >
      {#if form?.sent}
        <p role="status" data-testid="reset-sent">{t('reset.reset_sent')}</p>
      {/if}
      <Field
        id="reset-email"
        data-testid="reset-email"
        name="email"
        type="email"
        autocomplete="email"
        required
        label={t('reset.email')}
      />
      <Button data-testid="reset-submit" type="submit" variant="primary" {busy}>{t('reset.submit')}</Button>
    </form>
    <div class="mt-4 flex flex-col">
      <a href="/login" class="inline-flex min-h-11 items-center text-accent underline">{t('reset.to_login')}</a>
    </div>
  </Card>
</main>
