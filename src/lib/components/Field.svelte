<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  type Props = HTMLInputAttributes & { label: string; id: string; hint?: string; error?: string };
  let { label, id, hint, error, value = $bindable(), class: cls = '', ...rest }: Props = $props();
  const describedby = $derived([hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined);
</script>

<div class="flex flex-col gap-1">
  <label for={id} class="text-sm font-medium">{label}</label>
  <input
    {...rest}
    {id}
    bind:value
    aria-invalid={error ? 'true' : undefined}
    aria-describedby={describedby}
    class="min-h-11 rounded-control border border-border bg-surface px-3 text-text {cls}"
  />
  {#if hint}<p id="{id}-hint" class="text-sm text-muted">{hint}</p>{/if}
  {#if error}<p id="{id}-error" role="alert" class="text-sm text-danger">{error}</p>{/if}
</div>
