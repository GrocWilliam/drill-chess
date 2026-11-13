// The filters of the games list: parsed from the query string, turned into SQL conditions.
import { eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { games } from './schema';

export interface GameFilters {
  site?: 'chesscom' | 'lichess';
  colour?: 'white' | 'black';
  result?: 'win' | 'draw' | 'loss';
  timeClass?: 'bullet' | 'blitz' | 'rapid' | 'classical' | 'daily';
  opening?: string;
}

const schema = {
  site: z.enum(['chesscom', 'lichess']).optional().catch(undefined),
  colour: z.enum(['white', 'black']).optional().catch(undefined),
  result: z.enum(['win', 'draw', 'loss']).optional().catch(undefined),
  time: z.enum(['bullet', 'blitz', 'rapid', 'classical', 'daily']).optional().catch(undefined),
  opening: z.string().trim().max(100).optional().catch(undefined),
};

/** Parses the query string; an unknown or blank value is ignored. */
export function parseFilters(params: URLSearchParams): GameFilters {
  const get = (k: string) => params.get(k) ?? undefined;
  const out: GameFilters = {};
  const site = schema.site.parse(get('site'));
  if (site) out.site = site;
  const colour = schema.colour.parse(get('colour'));
  if (colour) out.colour = colour;
  const result = schema.result.parse(get('result'));
  if (result) out.result = result;
  const timeClass = schema.time.parse(get('time'));
  if (timeClass) out.timeClass = timeClass;
  const opening = schema.opening.parse(get('opening'));
  if (opening) out.opening = opening;
  return out;
}

export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** The SQL conditions of the filters, combined with AND. */
export function filterConditions(f: GameFilters): SQL[] {
  const c: SQL[] = [];
  if (f.site) c.push(eq(games.site, f.site));
  if (f.colour) c.push(eq(games.colour, f.colour));
  if (f.result) c.push(eq(games.result, f.result));
  if (f.timeClass) c.push(eq(games.timeClass, f.timeClass));
  if (f.opening) {
    const o = or(ilike(games.opening, sql`'%' || ${escapeLike(f.opening)} || '%'`), sql`lower(${games.eco}) = lower(${f.opening})`);
    if (o) c.push(o);
  }
  return c;
}

const pageSchema = z.string().regex(/^[1-9]\d{0,6}$/).transform(Number).refine((n) => n <= 1_000_000);

/** `?page=N`: a plain positive integer up to 1,000,000; anything else is page 1. */
export function parsePage(params: URLSearchParams): number {
  const r = pageSchema.safeParse(params.get('page'));
  return r.success ? r.data : 1;
}
