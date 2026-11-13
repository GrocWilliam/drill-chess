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
  <title>{t('signup.title')} · {t('app.name')}</title>
</svelte:head>

<main class="mx-auto w-full max-w-sm px-4 py-8">
  <Card>
    <h1 class="mb-4 text-2xl font-semibold">{t('signup.title')}</h1>
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
      <Field
        id="signup-email"
        data-testid="signup-email"
        name="email"
        type="email"
        autocomplete="email"
        required
        label={t('signup.email')}
        value={form?.email ?? ''}
        error={form?.errors?.email ? t(`signup.error.${form.errors.email}`) : undefined}
      />
      <Field
        id="signup-password"
        data-testid="signup-password"
        name="password"
        type="password"
        autocomplete="new-password"
        required
        label={t('signup.password')}
        hint={t('signup.password_hint')}
        error={form?.errors?.password ? t(`signup.error.${form.errors.password}`) : undefined}
      />
      <Button data-testid="signup-submit" type="submit" variant="primary" {busy}>{t('signup.submit')}</Button>
    </form>
    <div class="mt-4 flex flex-col">
      <a href="/login" class="inline-flex min-h-11 items-center text-accent underline">{t('signup.to_login')}</a>
      <a href="/reset" class="inline-flex min-h-11 items-center text-accent underline">{t('signup.to_reset')}</a>
    </div>
  </Card>
</main>
