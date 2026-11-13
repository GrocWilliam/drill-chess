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
  <title>{t('login.title')} · {t('app.name')}</title>
</svelte:head>

<main class="mx-auto w-full max-w-sm px-4 py-8">
  <Card>
    <h1 class="mb-4 text-2xl font-semibold">{t('login.title')}</h1>
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
      <input type="hidden" name="next" value={form?.next ?? data.next} />
      {#if form?.errors?.form}
        <p role="alert" class="text-danger">{t(`login.error.${form.errors.form}`)}</p>
      {/if}
      <Field
        id="login-email"
        data-testid="login-email"
        name="email"
        type="email"
        autocomplete="email"
        required
        label={t('login.email')}
        value={form?.email ?? ''}
      />
      <Field
        id="login-password"
        data-testid="login-password"
        name="password"
        type="password"
        autocomplete="current-password"
        required
        label={t('login.password')}
      />
      <Button data-testid="login-submit" type="submit" variant="primary" {busy}>{t('login.title')}</Button>
    </form>
    <div class="mt-4 flex flex-col">
      <a href="/signup" class="inline-flex min-h-11 items-center text-accent underline">{t('login.to_signup')}</a>
      <a href="/reset" class="inline-flex min-h-11 items-center text-accent underline">{t('login.to_reset')}</a>
    </div>
  </Card>
</main>
