<script lang="ts">
  import { enhance } from '$app/forms';
  import Button from '$lib/components/Button.svelte';
  import LinkForm from '$lib/components/LinkForm.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import Field from '$lib/components/Field.svelte';
  import Card from '$lib/components/Card.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import { translate } from '$lib/i18n';

  let { data, form } = $props();
  const t = (k: string) => translate(data.messages, k);
  const select = 'min-h-11 rounded-control border border-border bg-surface px-3 text-text';
</script>

<svelte:head>
  <title>{t('account.title')} · {t('app.name')}</title>
</svelte:head>

<main class="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8">
  <h1 class="text-2xl font-semibold md:text-[32px]">{t('account.title')}</h1>
  <Card>
    <p class="text-sm text-muted">{t('account.email')}</p>
    <p data-testid="account-email" class="break-all">{data.email}</p>
  </Card>
  <Card>
    <h2 class="mb-2 text-lg font-semibold">{t('link.title')}</h2>
    <div class="flex flex-col gap-4">
      {#each ['chesscom', 'lichess'] as const as site}
        {@const linked = data.linked.find((l) => l.site === site)}
        <div data-testid="link-{site}" class="flex flex-col gap-2">
          {#if linked}
            <div class="flex items-center justify-between gap-2">
              <p><span class="text-sm text-muted">{t(`site.${site}`)}</span> <span class="break-all font-medium">{linked.username}</span></p>
              <a href="/account?modal=unlink-{site}" data-testid="unlink-{site}"
                class="inline-flex min-h-11 items-center justify-center rounded-control border border-danger px-4 font-medium text-danger">{t('link.unlink')}</a>
            </div>
          {:else}
            <LinkForm {site} messages={data.messages} error={form?.link?.site === site ? form.link.error : undefined} username={form?.link?.site === site ? form.link.username : ''} />
          {/if}
        </div>
      {/each}
    </div>
  </Card>
  <Card>
    <form method="POST" action="?/preferences" use:enhance={() => async ({ result, update }) => {
      // <html lang> and data-theme come from app.html: a successful save needs a full page load.
      if (result.type === 'redirect') location.href = result.location;
      else await update({ reset: false });
    }} class="flex max-w-sm flex-col gap-4">
      <div class="flex flex-col gap-1">
        <label for="account-lang" class="text-sm font-medium">{t('account.lang')}</label>
        <select id="account-lang" name="lang" data-testid="account-lang" class={select}>
          {#each ['en', 'fr'] as l}
            <option value={l} selected={l === data.lang}>{t(`account.lang.${l}`)}</option>
          {/each}
        </select>
      </div>
      <div class="flex flex-col gap-1">
        <label for="account-theme" class="text-sm font-medium">{t('account.theme')}</label>
        <select id="account-theme" name="theme" data-testid="account-theme" class={select}>
          {#each ['system', 'light', 'dark'] as th}
            <option value={th} selected={th === data.theme}>{t(`account.theme.${th}`)}</option>
          {/each}
        </select>
      </div>
      {#if form?.error}<p role="alert" class="text-sm text-danger">{t('account.error.invalid')}</p>{/if}
      <Button type="submit" variant="primary" data-testid="account-save">{t('account.save')}</Button>
    </form>
  </Card>
  <Card>
    <a href="/account?modal=delete-account" data-testid="account-delete"
      class="inline-flex min-h-11 items-center justify-center rounded-control border border-danger px-4 font-medium text-danger">{t('account.delete')}</a>
  </Card>
</main>

{#if data.modal === 'delete-account' || form?.deleteError}
  <Modal title={t('account.delete.title')} testid="modal-delete-account">
    <form method="POST" action="?/delete" class="flex flex-col gap-4">
      <p class="text-sm text-muted">{t('account.delete.body')}</p>
      <Field id="delete-password" name="password" type="password" autocomplete="current-password" required
        data-testid="delete-password" label={t('account.delete.password')}
        error={form?.deleteError ? t(`account.error.${form.deleteError}`) : undefined} />
      <div class="flex flex-wrap gap-3">
        <Button type="submit" variant="danger" data-testid="delete-confirm">{t('account.delete')}</Button>
        <a href="/account" data-testid="delete-cancel" class="inline-flex min-h-11 items-center justify-center rounded-control border border-border px-4 font-medium">{t('account.delete.cancel')}</a>
      </div>
    </form>
  </Modal>
{/if}

{#each ['chesscom', 'lichess'] as const as site}
  {#if data.modal === `unlink-${site}` || form?.unlink?.site === site}
    <Modal title={t('link.unlink.title')} testid="modal-unlink-{site}">
      <form method="POST" action="?/unlink" class="flex flex-col gap-4">
        <input type="hidden" name="site" value={site} />
        <p class="text-sm text-muted">{t('link.unlink.body')}</p>
        {#if form?.unlink?.site === site}<p role="alert" class="text-sm text-danger">{t(`link.error.${form.unlink.error === 'invalid' ? 'username_invalid' : form.unlink.error}`)}</p>{/if}
        <div class="flex flex-wrap gap-3">
          <Button type="submit" variant="danger" data-testid="unlink-{site}-confirm">{t('link.unlink')}</Button>
          <a href="/account" data-testid="unlink-{site}-cancel" class="inline-flex min-h-11 items-center justify-center rounded-control border border-border px-4 font-medium">{t('link.unlink.cancel')}</a>
        </div>
      </form>
    </Modal>
  {/if}
{/each}

{#if data.saved}<Toast message={t('account.saved')} />{/if}
