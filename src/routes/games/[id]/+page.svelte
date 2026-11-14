<script lang="ts">
  import Badge from '$lib/components/Badge.svelte';
  import GameReview from '$lib/components/GameReview.svelte';
  import { translate } from '$lib/i18n';

  let { data } = $props();
  const t = (k: string) => translate(data.messages, k);
  const g = $derived(data.game);
  const date = $derived(new Intl.DateTimeFormat(data.lang, { timeZone: 'UTC' }).format(new Date(g.endedAt)));
  const rating = (r: number | null) => (r === null ? '' : String(r));
</script>

<svelte:head>
  <title>{g.whiteName} – {g.blackName} · {t('app.name')}</title>
</svelte:head>

<h1 class="sr-only">{t('game.title')}</h1>
<GameReview
  game={g}
  analysis={data.analysis}
  ply={data.ply}
  orientation={data.orientation}
  engineDepth={data.engineDepth}
  save={true}
  movable="none"
  messages={data.messages}
  lang={data.lang}
>
  {#snippet details()}
    <a href="/games" class="inline-flex min-h-11 items-center text-accent underline">{t('game.back')}</a>
    <div data-testid="game-details" class="flex flex-col gap-2 break-words">
      <p>
        <span class="text-muted">{t('game.white')}</span> <strong>{g.whiteName}</strong> <span>{rating(g.whiteRating)}</span>
      </p>
      <p>
        <span class="text-muted">{t('game.black')}</span> <strong>{g.blackName}</strong> <span>{rating(g.blackRating)}</span>
      </p>
      <p>
        <span class="text-muted">{t('game.result')}</span>
        <Badge tone={g.result === 'win' ? 'accent' : g.result === 'loss' ? 'danger' : 'neutral'}>{t(`result.${g.result}`)}</Badge>
      </p>
      <p><span class="text-muted">{t('game.date')}</span> <span>{date}</span></p>
      <p class="flex flex-wrap items-center gap-2">
        <Badge>{t(`timeclass.${g.timeClass}`)}</Badge> <span>{g.clock}</span>
      </p>
      {#if g.eco || g.opening}
        <p><span class="text-muted">{t('game.opening')}</span> <span>{[g.eco, g.opening].filter(Boolean).join(' ')}</span></p>
      {/if}
    </div>
    <noscript>
      <p data-testid="review-noscript" role="alert">{t('review.noscript')}</p>
      <p data-testid="game-moves" class="break-words font-mono text-sm">{g.moves}</p>
    </noscript>
  {/snippet}
  {#snippet footer()}
    <p>
      <a data-testid="game-site-link" href={g.url} rel="noopener noreferrer" target="_blank" class="inline-flex min-h-11 items-center text-accent underline">
        {t(`site.${g.site}.open`)}
      </a>
    </p>
  {/snippet}
</GameReview>
