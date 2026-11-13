<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
  import Button from '$lib/components/Button.svelte';
  import Field from '$lib/components/Field.svelte';
  import { translate } from '$lib/i18n';

  let {
    site,
    messages,
    error,
    username = '',
  }: { site: 'chesscom' | 'lichess'; messages: Record<string, string>; error?: string; username?: string } = $props();
  const t = (k: string) => translate(messages, k);
</script>

<form method="POST" action="?/link" use:enhance={() => async ({ result, update }) => {
    // Already on the page it redirects to: reload its data instead of navigating (no history entry, no page load).
    if (result.type === 'redirect' && new URL(result.location, page.url).href === page.url.href) await invalidateAll();
    else await update({ reset: false });
  }} class="flex flex-col gap-2 sm:flex-row sm:items-end">
  <input type="hidden" name="site" value={site} />
  <Field
    id="link-{site}-username"
    data-testid="link-{site}-username"
    name="username"
    label={t(`site.${site}`)}
    value={username}
    autocomplete="off"
    autocapitalize="off"
    spellcheck={false}
    error={error ? t(`link.error.${error}`) : undefined}
  />
  <Button type="submit" variant="primary" data-testid="link-{site}-submit">{t('link.submit')}</Button>
</form>
