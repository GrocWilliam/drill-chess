<!--
  The board column + panel shell of the openings pages: full-width board below 1024px, board and a 380px panel side
  by side from 1024px (same rules as GameReview, which keeps its own copy).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import Card from '$lib/components/Card.svelte';

  let { board, panel }: { board: Snippet; panel: Snippet } = $props();
</script>

<main class="mx-auto max-w-6xl px-4 py-4 lg:px-0">
  <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-1">
    <div class="board-col w-full">{@render board()}</div>
    <Card class="flex flex-col gap-3 break-words lg:w-[380px] lg:shrink-0">
      {@render panel()}
    </Card>
  </div>
</main>

<style>
  .board-col {
    max-width: calc(100vw - 32px);
    overflow-x: clip;
  }
  @media (min-width: 1024px) {
    .board-col {
      width: min(640px, calc(100vh - 160px), calc(100vw - 380px - 8px));
      flex-shrink: 0;
    }
  }
</style>
