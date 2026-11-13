<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  let { children, class: cls = '', ...rest }: HTMLAttributes<HTMLDivElement> & { children: Snippet } = $props();
</script>

<div {...rest} class="rounded-card border border-border bg-surface p-4 {cls}">
  {@render children()}
</div>
