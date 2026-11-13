import { importStatus, listGames, listLinkedAccounts, visibleStatuses } from '$lib/server/games';
import { parseFilters, parsePage } from '$lib/server/games/filters';
import { linkAction, syncAction } from '$lib/server/link-action';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const filters = parseFilters(url.searchParams);
  const page = parsePage(url.searchParams);
  const values = { site: filters.site ?? '', colour: filters.colour ?? '', result: filters.result ?? '', time: filters.timeClass ?? '', opening: filters.opening ?? '' };
  if (!locals.user) return { linkedCount: 0, sites: [], games: [], page: 1, prevHref: null, nextHref: null, values, imports: [], active: false };
  const [linked, list, status] = await Promise.all([
    listLinkedAccounts(locals.user.id),
    listGames(locals.user.id, filters, page),
    importStatus(locals.user.id),
  ]);
  const imports = visibleStatuses(status).map((j) => ({ site: j.site, status: j.status, imported: j.imported, skipped: j.skipped, error: j.error }));
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries(values).filter(([, v]) => v));
    if (p > 1) q.set('page', String(p));
    const qs = q.toString();
    return qs ? `/games?${qs}` : '/games';
  };
  return {
    page,
    prevHref: page > 1 ? href(page - 1) : null,
    nextHref: list.hasNext ? href(page + 1) : null,
    linkedCount: linked.length,
    sites: linked.map((a) => a.site),
    values,
    imports,
    active: imports.some((j) => j.status === 'queued' || j.status === 'running'),
    games: list.games.map((g) => ({
      id: g.id,
      site: g.site,
      endedAt: g.endedAt.toISOString(),
      timeClass: g.timeClass,
      clock: g.clock,
      colour: g.colour,
      result: g.result,
      opponent: g.colour === 'white' ? g.blackName : g.whiteName,
      opponentRating: g.colour === 'white' ? g.blackRating : g.whiteRating,
      eco: g.eco,
      opening: g.opening,
    })),
  };
};

export const actions: Actions = {
  link: (event) => linkAction(event, '/games'),
  sync: (event) => syncAction(event, '/games'),
};
