<script lang="ts">
  import { onMount } from 'svelte';

  let { message, ms = 4000 }: { message: string; ms?: number } = $props();
  let visible = $state(true);
  // Without JavaScript the toast stays in the server-rendered page; with it, it goes after `ms`.
  onMount(() => {
    const id = setTimeout(() => (visible = false), ms);
    return () => clearTimeout(id);
  });
</script>

{#if visible}
  <div
    role="status"
    data-testid="toast"
    class="fixed bottom-20 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-control border border-border bg-surface px-4 py-3 text-text shadow-lg md:bottom-6"
  >
    {message}
  </div>
{/if}
