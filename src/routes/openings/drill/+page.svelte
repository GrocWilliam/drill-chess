<script lang="ts">
  import OpeningDrill from '$lib/components/OpeningDrill.svelte';
  import { translate } from '$lib/i18n';

  let { data } = $props();
  const t = (k: string) => translate(data.messages, k);
</script>

<svelte:head><title>{t('drill.title')} · {t('app.name')}</title></svelte:head>

<h1 class="sr-only">{t('drill.title')}</h1>
{#key data.first}
  <OpeningDrill messages={data.messages} lang={data.lang} colour={data.colour} seed={data.seed} first={data.first} />
{/key}
