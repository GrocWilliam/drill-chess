import { listLinkedAccounts } from '$lib/server/games';
import { getStats } from '$lib/server/stats';
import { parseStatsFilters } from '$lib/server/stats/filters';
import { pickSeries } from '$lib/server/stats/score';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const userId = locals.user!.id;
  const filters = parseStatsFilters(url.searchParams, new Date());
  const [stats, linked] = await Promise.all([getStats(userId, filters), listLinkedAccounts(userId)]);
  const hasLinked = linked.length > 0;
  return {
    stats,
    values: { site: filters.site ?? 'all', time: filters.timeClass ?? 'all', period: filters.period, openingsColour: filters.openingsColour },
    selectedSeries: pickSeries(stats.rating.series, filters.series),
    hasLinked,
    emptyHref: hasLinked ? '/stats' : '/games',
    openingHrefs: stats.openings.map((o) => {
      const key = o.eco ?? o.opening;
      if (!o.opening || !key) return null;
      const q = new URLSearchParams({ opening: key });
      if (filters.openingsColour !== 'both') q.set('colour', filters.openingsColour);
      if (filters.site) q.set('site', filters.site);
      if (filters.timeClass) q.set('time', filters.timeClass);
      return `/games?${q}`;
    }),
    timeHrefs: Object.fromEntries(stats.time.map((r) => [r.time, `/games?time=${r.time}`])),
  };
};
