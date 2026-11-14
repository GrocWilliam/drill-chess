<script lang="ts">
  import GameReview from '$lib/components/GameReview.svelte';
  import { translate } from '$lib/i18n';

  let { data } = $props();
  const t = (k: string) => translate(data.messages, k);
  const g = $derived(data.game);
</script>

<svelte:head>
  <title>{g.whiteName} – {g.blackName} · {t('app.name')}</title>
</svelte:head>

<h1 class="sr-only">{t('demo.title')}</h1>
<GameReview
  game={g}
  analysis={null}
  ply={data.ply}
  orientation={data.orientation}
  engineDepth={data.engineDepth}
  save={false}
  messages={data.messages}
  lang={data.lang}
>
  {#snippet details()}
    <p><span class="text-muted">{t('game.white')}</span> <strong>{g.whiteName}</strong></p>
    <p><span class="text-muted">{t('game.black')}</span> <strong>{g.blackName}</strong></p>
    <p><span class="text-muted">{t('game.event')}</span> <span>{g.event}</span></p>
    <p><span class="text-muted">{t('game.result')}</span> <span class="font-mono">{g.result}</span></p>
    <noscript>
      <p data-testid="review-noscript" role="alert">{t('review.noscript')}</p>
      <p class="font-mono text-sm">{g.moves}</p>
    </noscript>
  {/snippet}
</GameReview>
