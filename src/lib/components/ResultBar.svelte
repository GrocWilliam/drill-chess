<script lang="ts">
  import { translate, type Messages } from '$lib/i18n';

  let { wins, draws, losses, messages }: { wins: number; draws: number; losses: number; messages: Messages } = $props();
  const segments = $derived(
    [
      { key: 'win', count: wins, cls: 'bg-accent text-accent-text' },
      { key: 'draw', count: draws, cls: 'bg-muted text-bg' },
      { key: 'loss', count: losses, cls: 'bg-danger text-bg' },
    ].filter((s) => s.count > 0),
  );
</script>

<!-- Stacked win/draw/loss bar: each segment holds its count as text. -->
<div data-testid="result-bar" class="flex min-h-6 w-full min-w-32 overflow-hidden rounded-control text-sm font-medium">
  {#each segments as s (s.key)}
    <div
      class="flex items-center justify-center px-2 {s.cls}"
      style="flex: {s.count} 1 auto"
      aria-label={translate(messages, `stats.bar.${s.key}`, { count: s.count })}
    >{s.count}</div>
  {/each}
</div>
