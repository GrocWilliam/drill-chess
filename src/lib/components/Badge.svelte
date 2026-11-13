<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children, tone = 'neutral' }: { children: Snippet; tone?: 'neutral' | 'accent' | 'danger' } = $props();
  const tones = { neutral: 'border-border text-muted', accent: 'border-accent text-accent', danger: 'border-danger text-danger' };
</script>

<span class="inline-block rounded-control border px-2 text-sm {tones[tone]}">{@render children()}</span>
