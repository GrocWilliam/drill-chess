<script lang="ts">
  import { page } from '$app/state';
  import { translate, type Messages } from '$lib/i18n';

  let { messages, signedIn = false }: { messages: Messages; signedIn?: boolean } = $props();
  const t = (k: string) => translate(messages, k);
  const current = (href: string) =>
    page.url.pathname === href || page.url.pathname.startsWith(href + '/') ? 'page' : undefined;
</script>

{#snippet gamesIcon()}
  <svg aria-hidden="true" viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 12h16M12 4v16" />
  </svg>
{/snippet}

<header class="border-b border-border bg-surface">
  <nav aria-label={t('nav.main')} class="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2">
    <a href={signedIn ? '/games' : '/'} class="inline-flex min-h-11 items-center text-xl font-semibold">{t('app.name')}</a>
    {#if signedIn}
      <div class="flex items-center gap-2">
        <a
          data-testid="nav-games"
          href="/games"
          aria-current={current('/games')}
          class="hidden min-h-11 items-center rounded-control px-3 font-medium aria-[current=page]:text-accent md:inline-flex"
        >{t('nav.games')}</a>
        <details class="relative">
          <summary
            data-testid="nav-account"
            class="inline-flex min-h-11 min-w-11 cursor-pointer list-none items-center rounded-control px-3 font-medium [&::-webkit-details-marker]:hidden"
          >{t('nav.account')}</summary>
          <div class="absolute right-0 z-20 mt-1 flex w-48 flex-col rounded-card border border-border bg-surface p-2">
            <a href="/account" class="inline-flex min-h-11 items-center rounded-control px-3">{t('nav.account')}</a>
            <form data-testid="nav-logout" method="POST" action="/logout">
              <button type="submit" class="inline-flex min-h-11 w-full items-center rounded-control px-3 text-left">{t('nav.logout')}</button>
            </form>
          </div>
        </details>
      </div>
    {:else}
      <div class="flex items-center gap-2">
        <a data-testid="nav-login" href="/login" class="inline-flex min-h-11 items-center rounded-control px-3 font-medium">{t('nav.login')}</a>
        <a data-testid="nav-signup" href="/signup" class="inline-flex min-h-11 items-center rounded-control bg-accent px-4 font-medium text-accent-text">{t('nav.signup')}</a>
      </div>
    {/if}
  </nav>
</header>

{#if signedIn}
  <nav
    data-testid="nav-tabs"
    aria-label={t('nav.main')}
    class="fixed inset-x-0 bottom-0 z-10 flex h-16 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    style="box-sizing: content-box"
  >
    <a
      data-testid="nav-games"
      href="/games"
      aria-current={current('/games')}
      class="flex min-h-11 flex-1 flex-col items-center justify-center gap-1 text-sm text-muted aria-[current=page]:text-accent"
    >{@render gamesIcon()}<span>{t('nav.games')}</span></a>
  </nav>
{/if}
