<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  type Props = HTMLButtonAttributes & {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    busy?: boolean;
    children: Snippet;
  };
  let { variant = 'secondary', busy = false, children, class: cls = '', ...rest }: Props = $props();

  const variants = {
    primary: 'bg-accent text-accent-text border-transparent',
    secondary: 'border-border text-text',
    ghost: 'border-transparent text-text',
    danger: 'border-danger text-danger'
  };
</script>

<button
  {...rest}
  aria-busy={busy}
  class="inline-flex min-h-11 items-center justify-center rounded-control border px-4 font-medium {variants[variant]} {cls}"
>
  {@render children()}
</button>
