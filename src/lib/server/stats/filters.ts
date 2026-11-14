// The filters of the statistics: parsed from the query string, pure (the caller passes `now`).
import { z } from 'zod';

export const SITES = ['chesscom', 'lichess'] as const;
export const TIME_CLASSES = ['bullet', 'blitz', 'rapid', 'classical', 'daily'] as const;
export type Site = (typeof SITES)[number];
export type TimeClass = (typeof TIME_CLASSES)[number];
export type Period = '30d' | '90d' | '365d' | 'all';

export interface StatsFilters {
  site?: Site;
  timeClass?: TimeClass;
  period: Period;
  /** Games count when `ended_at >= since`; null = all time. */
  since: Date | null;
  openingsColour: 'white' | 'black' | 'both';
  /** A rating series `<site>-<time>`, e.g. `lichess-blitz`. */
  series?: string;
}

const schema = {
  site: z.enum(SITES).optional().catch(undefined),
  time: z.enum(TIME_CLASSES).optional().catch(undefined),
  period: z.enum(['30d', '90d', '365d', 'all']).catch('all'),
  openingsColour: z.enum(['white', 'black', 'both']).catch('both'),
  series: z
    .string()
    .regex(new RegExp(`^(${SITES.join('|')})-(${TIME_CLASSES.join('|')})$`))
    .optional()
    .catch(undefined),
};

const DAYS: Record<Exclude<Period, 'all'>, number> = { '30d': 30, '90d': 90, '365d': 365 };
const DAY_MS = 24 * 3600_000;

/** Parses `site`, `time`, `period`, `openingsColour` and `series`; an unknown or blank value gives its default. */
export function parseStatsFilters(params: URLSearchParams, now: Date): StatsFilters {
  const get = (k: string) => params.get(k) ?? undefined;
  const period = schema.period.parse(get('period'));
  const out: StatsFilters = {
    period,
    since: period === 'all' ? null : new Date(now.getTime() - DAYS[period] * DAY_MS),
    openingsColour: schema.openingsColour.parse(get('openingsColour')),
  };
  const site = schema.site.parse(get('site'));
  if (site) out.site = site;
  const timeClass = schema.time.parse(get('time'));
  if (timeClass) out.timeClass = timeClass;
  const series = schema.series.parse(get('series'));
  if (series) out.series = series;
  return out;
}
