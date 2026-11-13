<script lang="ts">
  import { enhance } from '$app/forms';
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import Field from '$lib/components/Field.svelte';
  import { translate } from '$lib/i18n';

  let { data, form } = $props();
  const t = (k: string) => translate(data.messages, k);
  let busy = $state(false);
  const invalid = $derived(form?.invalid ?? false);
</script>

<svelte:head>
  <title>{t('reset.title')} · {t('app.name')}</title>
</svelte:head>

<main class="mx-auto w-full max-w-sm px-4 py-8">
  <Card>
    <h1 class="mb-4 text-2xl font-semibold">{t('reset.title')}</h1>
    {#if invalid}
      <p role="alert" data-testid="reset-invalid" class="text-danger">{t('reset.error.reset_invalid')}</p>
      <a href="/reset" class="mt-4 inline-flex min-h-11 items-center text-accent underline">{t('reset.invalid_to_reset')}</a>
    {:else}
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
          id="reset-password"
          data-testid="reset-password"
          name="password"
          type="password"
          autocomplete="new-password"
          required
          label={t('reset.password')}
          hint={t('reset.password_hint')}
          error={form?.errors?.password ? t(`reset.error.${form.errors.password}`) : undefined}
        />
        <Button data-testid="reset-password-submit" type="submit" variant="primary" {busy}>{t('reset.password_submit')}</Button>
      </form>
      <div class="mt-4 flex flex-col">
        <a href="/login" class="inline-flex min-h-11 items-center text-accent underline">{t('reset.to_login')}</a>
      </div>
    {/if}
  </Card>
</main>
