<script lang="ts">
  import '../app.css';
  import Nav from '$lib/components/Nav.svelte';

  let { data, children } = $props();
</script>

<Nav messages={data.messages} signedIn={data.signedIn} />
<div class={data.signedIn ? 'pb-20 md:pb-0' : ''}>
  {@render children()}
</div>
