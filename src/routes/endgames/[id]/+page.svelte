<script lang="ts">
  import EndgamePlay from '$lib/components/EndgamePlay.svelte';
  import { translate } from '$lib/i18n';

  let { data } = $props();
  const t = (k: string) => translate(data.messages, k);
</script>

<svelte:head><title>{t(`endgame.${data.endgame.id}.name`)} · {t('app.name')}</title></svelte:head>

<EndgamePlay messages={data.messages} endgame={data.endgame} />
