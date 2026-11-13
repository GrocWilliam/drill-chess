<script lang="ts">
  import type { Snippet } from 'svelte';

  let { title, text, action }: { title: string; text?: string; action?: Snippet } = $props();
</script>

<div data-testid="empty-state" class="flex flex-col items-center gap-2 py-8 text-center">
  <h2 class="text-xl font-semibold md:text-2xl">{title}</h2>
  {#if text}<p class="text-muted">{text}</p>{/if}
  {#if action}{@render action()}{/if}
</div>
