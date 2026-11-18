<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import Board from '$lib/chess/Board.svelte';
  import BoardLayout from '$lib/components/BoardLayout.svelte';
  import Button from '$lib/components/Button.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { translate, translatePlural } from '$lib/i18n';

  let { data } = $props();
  const t = (k: string, p: Record<string, string | number> = {}) => translate(data.messages, k, p);

  let error = $state('');
  const ucis = $derived(data.line.map((m) => m.uci));
  const href = (l: string[]) => `/openings/${data.colour}` + (l.length ? `?line=${l.join(',')}` : '');
  const nameOf = (o: { eco: string; name: string } | null) => (o ? `${o.eco} ${o.name}` : '');
  const lastMove = $derived.by<[string, string] | undefined>(() => {
    const u = ucis.at(-1);
    return u ? [u.slice(0, 2), u.slice(2, 4)] : undefined;
  });

  $effect(() => {
    void data.line;
    error = '';
  });

  const lineHref = $derived(href(ucis));
  const deleteHref = (id: string) => `${lineHref}${ucis.length ? '&' : '?'}modal=opening-delete&move=${id}`;
  const deleteBody = $derived(
    data.deleting
      ? data.deleting.count > 1
        ? translatePlural(data.messages, data.lang, 'openings.delete.body', data.deleting.count - 1, { san: data.deleting.san })
        : t('openings.delete.body_none', { san: data.deleting.san })
      : ''
  );

  async function removeMove(id: string) {
    try {
      const res = await fetch(`/api/openings/${data.colour}/moves/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch {
      error = t('openings.error.network');
      return;
    }
    await goto(lineHref, { invalidateAll: true });
  }

  async function onMove(uci: string) {
    error = '';
    const known = data.moves.some((m) => m.uci === uci);
    if (!known) {
      let res: Response;
      try {
        res = await fetch(`/api/openings/${data.colour}/moves`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ fromFen: data.fen, uci })
        });
      } catch {
        error = t('openings.error.network');
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const err = body?.error;
        const san = typeof err?.message === 'string' ? /^Delete (\S+) first/.exec(err.message)?.[1] : undefined;
        const code = ['illegal_move', 'unknown_position', 'player_move_exists', 'repertoire_full'].includes(err?.code)
          ? err.code
          : 'network';
        error = t(`openings.error.${code}`, { san: san ?? '' });
        return;
      }
    }
    await goto(href([...ucis, uci]));
  }
</script>

<svelte:head>
  <title>{t('openings.title')} · {t('app.name')}</title>
</svelte:head>

<h1 class="sr-only">{t('openings.title')}</h1>
<BoardLayout>
  {#snippet board()}
    <Board messages={data.messages} fen={data.fen} orientation={data.colour} movable="both" {lastMove} {onMove} />
  {/snippet}
  {#snippet panel()}
    <p data-testid="opening-name" class="text-lg font-bold">
      {data.opening ? nameOf(data.opening) : ucis.length === 0 ? t('openings.start') : ''}
    </p>
    <nav aria-label={t('openings.path')}>
      <ol data-testid="opening-path" class="flex flex-wrap items-center gap-x-1 text-sm">
        <li>
          <a data-testid="opening-path-start" href={href([])} class="inline-flex min-h-11 min-w-11 items-center justify-center px-2 text-accent underline">{t('openings.start_short')}</a>
        </li>
        {#each data.line as m, i (i)}
          <li>
            <a data-testid="opening-path-move" href={href(ucis.slice(0, i + 1))} class="inline-flex min-h-11 min-w-11 items-center justify-center px-2 font-mono text-accent underline">{m.san}</a>
          </li>
        {/each}
      </ol>
    </nav>
    {#if error}
      <p data-testid="opening-error" role="alert" class="text-danger">{error}</p>
    {/if}
    {#if data.moves.length === 0}
      <p data-testid="opening-moves-empty" class="text-muted">{t('openings.moves_empty')}</p>
    {:else}
      <ul data-testid="opening-moves" class="flex flex-col gap-1">
        {#each data.moves as m (m.id)}
          <li
            data-testid="opening-move"
            data-uci={m.uci}
            data-by={m.by}
            {...{ href: href([...ucis, m.uci]) }}
            class="flex flex-wrap items-center gap-x-1 rounded border border-border hover:bg-bg"
          >
            <a href={href([...ucis, m.uci])} class="flex min-h-11 flex-1 flex-wrap items-center gap-x-3 px-2 py-1">
              <span class="font-mono font-bold">{m.san}</span>
              <span class="text-sm text-muted">{t(`openings.by.${m.by}`)}</span>
              {#if m.opening}<span class="text-sm">{nameOf(m.opening)}</span>{/if}
            </a>
            <a
              data-testid="opening-delete"
              href={deleteHref(m.id)}
              aria-label={t('openings.delete.label', { san: m.san })}
              class="inline-flex min-h-11 min-w-11 items-center justify-center px-2 text-sm text-danger underline"
            >{t('openings.delete')}</a>
          </li>
        {/each}
      </ul>
    {/if}
  {/snippet}
</BoardLayout>

{#if data.deleting}
  <Modal title={t('openings.delete.title')} testid="modal-opening-delete">
    <form
      method="POST"
      action="?/delete&line={ucis.join(',')}"
      class="flex flex-col gap-4"
      use:enhance={({ cancel, formData }) => {
        cancel();
        void removeMove(String(formData.get('moveId')));
      }}
    >
      <input type="hidden" name="moveId" value={data.deleting.id} />
      <p>{deleteBody}</p>
      <div class="flex flex-wrap gap-3">
        <Button type="submit" variant="danger" data-testid="opening-delete-confirm">{t('openings.delete.confirm')}</Button>
        <a href={lineHref} data-testid="opening-delete-cancel" class="inline-flex min-h-11 items-center justify-center rounded-control border border-border px-4 font-medium">{t('openings.delete.cancel')}</a>
      </div>
    </form>
  </Modal>
{/if}
