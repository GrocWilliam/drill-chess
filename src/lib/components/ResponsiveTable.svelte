<script lang="ts" generics="T">
  import { goto } from '$app/navigation';
  import type { Snippet } from 'svelte';

  let {
    columns,
    rows,
    rowTestid,
    rowId,
    href,
    cell,
    label,
    ...rest
  }: {
    columns: { key: string; label: string }[];
    rows: T[];
    rowTestid: string;
    rowId: (row: T) => string;
    href: (row: T) => string;
    cell: Snippet<[T, string]>;
    label: string;
  } & Record<string, unknown> = $props();

  const open = (e: MouseEvent, row: T) => {
    if ((e.target as HTMLElement).closest('a')) return;
    goto(href(row));
  };
</script>

<!-- One markup: a table from 768px, each row a card below. -->
<table class="block w-full text-left md:table" aria-label={label} {...rest}>
  <thead class="sr-only md:table-header-group md:not-sr-only">
    <tr class="md:table-row">
      {#each columns as c}
        <th scope="col" class="px-3 py-2 text-sm font-medium text-muted">{c.label}</th>
      {/each}
    </tr>
  </thead>
  <tbody class="block md:table-row-group">
    {#each rows as row (rowId(row))}
      <tr
        data-testid={rowTestid}
        data-game-id={rowId(row)}
        onclick={(e) => open(e, row)}
        class="mb-3 flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-card border border-border bg-surface p-3 hover:bg-bg md:mb-0 md:table-row md:rounded-none md:border-0 md:border-t md:bg-transparent md:p-0"
      >
        {#each columns as c, i}
          <td class="md:table-cell md:px-3 md:py-1 {i === 0 ? 'w-full md:w-auto' : ''}">{@render cell(row, c.key)}</td>
        {/each}
      </tr>
    {/each}
  </tbody>
</table>
