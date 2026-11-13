<script lang="ts">
  import type { Snippet } from 'svelte';

  // A native <dialog> rendered open by the server (`?modal=<kind>`), so it works without JavaScript.
  type Props = { title: string; testid: string; children: Snippet };
  let { title, testid, children }: Props = $props();
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
  <dialog
    open
    data-testid={testid}
    aria-labelledby="{testid}-title"
    class="static m-0 flex max-h-full w-full max-w-md flex-col gap-4 overflow-y-auto rounded-card border border-border bg-surface p-6 text-text"
  >
    <h2 id="{testid}-title" class="text-xl font-semibold">{title}</h2>
    {@render children()}
  </dialog>
</div>
