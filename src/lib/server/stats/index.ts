// The `stats` module: read-only aggregates over the user's games (and, in later stories, analyses).
// It reads the `games` table directly (docs/architecture.md), never writes.
import { and, asc, desc, eq, gte, sql, type SQL } from 'drizzle-orm';
import { db } from '../db';
import { games } from '../games/schema';
import { TIME_CLASSES, type StatsFilters, type TimeClass } from './filters';
import { scorePercent } from './score';

export type { StatsFilters } from './filters';

export interface Counts {
  games: number;
  wins: number;
  draws: number;
  losses: number;
  score: number;
}
export type Colour = 'white' | 'black';
export type Phase = 'opening' | 'middlegame' | 'endgame';
export interface MarkCounts {
  inaccuracy: number;
  mistake: number;
  blunder: number;
}

export interface Stats {
  colour: (Counts & { colour: Colour })[];
  time: (Counts & { time: TimeClass })[];
  openings: (Counts & { eco: string | null; opening: string | null })[];
  /** Filled by a later story. */
  rating: { series: unknown[] };
  /** Filled by a later story. */
  mistakes: { games: number; accuracy: number | null; byPhase: Record<Phase, MarkCounts> };
}

/** The conditions every block applies: the user's games, then the filters. */
function conditions(userId: string, f: StatsFilters): SQL | undefined {
  const c: SQL[] = [eq(games.userId, userId)];
  if (f.site) c.push(eq(games.site, f.site));
  if (f.timeClass) c.push(eq(games.timeClass, f.timeClass));
  if (f.since) c.push(gte(games.endedAt, f.since));
  return and(...c);
}

const countColumns = {
  games: sql<number>`count(*)::int`,
  wins: sql<number>`(count(*) filter (where ${games.result} = 'win'))::int`,
  draws: sql<number>`(count(*) filter (where ${games.result} = 'draw'))::int`,
  losses: sql<number>`(count(*) filter (where ${games.result} = 'loss'))::int`,
};

const counts = (r: { games: number; wins: number; draws: number; losses: number }): Counts => {
  const n = { games: Number(r.games), wins: Number(r.wins), draws: Number(r.draws), losses: Number(r.losses) };
  return { ...n, score: scorePercent(n.wins, n.draws, n.games) };
};

const COLOURS: Colour[] = ['white', 'black'];
const order = <T extends string>(keys: readonly T[], k: T) => keys.indexOf(k);

async function colourBlock(where: SQL | undefined): Promise<Stats['colour']> {
  const rows = await db.select({ key: games.colour, ...countColumns }).from(games).where(where).groupBy(games.colour);
  return rows
    .map((r) => ({ colour: r.key as Colour, ...counts(r) }))
    .sort((a, b) => order(COLOURS, a.colour) - order(COLOURS, b.colour));
}

async function timeBlock(where: SQL | undefined): Promise<Stats['time']> {
  const rows = await db.select({ key: games.timeClass, ...countColumns }).from(games).where(where).groupBy(games.timeClass);
  return rows
    .map((r) => ({ time: r.key as TimeClass, ...counts(r) }))
    .sort((a, b) => order(TIME_CLASSES, a.time) - order(TIME_CLASSES, b.time));
}

/** The 10 most played openings; every game without an opening name is one group (eco and opening null). */
async function openingsBlock(where: SQL | undefined, colour: StatsFilters['openingsColour']): Promise<Stats['openings']> {
  const w = colour === 'both' ? where : and(where, eq(games.colour, colour));
  const opening = sql<string | null>`${games.opening}`;
  const eco = sql<string | null>`case when ${games.opening} is null then null else ${games.eco} end`;
  const rows = await db
    .select({ eco, opening, ...countColumns })
    .from(games)
    .where(w)
    .groupBy(eco, opening)
    .orderBy(
      desc(sql`count(*)`),
      desc(sql`(2 * count(*) filter (where ${games.result} = 'win') + count(*) filter (where ${games.result} = 'draw'))::float8 / (2 * count(*))::float8`),
      sql`${eco} asc nulls last`,
      asc(opening),
    )
    .limit(10);
  return rows.map((r) => ({ eco: r.eco, opening: r.opening, ...counts(r) }));
}

const noMarks = (): MarkCounts => ({ inaccuracy: 0, mistake: 0, blunder: 0 });

/** The statistics of `userId`'s games matching the filters, one query per block. */
export async function getStats(userId: string, f: StatsFilters): Promise<Stats> {
  const where = conditions(userId, f);
  const [colour, time, openings] = await Promise.all([
    colourBlock(where),
    timeBlock(where),
    openingsBlock(where, f.openingsColour),
  ]);
  return {
    colour,
    time,
    openings,
    rating: { series: [] },
    mistakes: { games: 0, accuracy: null, byPhase: { opening: noMarks(), middlegame: noMarks(), endgame: noMarks() } },
  };
}
