// The `stats` module: read-only aggregates over the user's games and their analyses.
// It reads the `games` and `analyses` tables directly (docs/architecture.md), never writes.
import { and, asc, desc, eq, gte, sql, type SQL } from 'drizzle-orm';
import { db } from '../db';
import { games } from '../games/schema';
import { analyses } from '../review/schema';
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
const PHASES: Phase[] = ['opening', 'middlegame', 'endgame'];
const MARKS = ['inaccuracy', 'mistake', 'blunder'] as const;
const round1 = (x: number) => Math.round(x * 10) / 10;

/** The analysed games among the filtered ones: their count and the player's average accuracy. */
async function analysedSummary(where: SQL | undefined) {
  const [row] = await db
    .select({
      games: sql<number>`count(*)::int`,
      accuracy: sql<number | null>`avg(case when ${games.colour} = 'white' then ${analyses.accuracyWhite} else ${analyses.accuracyBlack} end)::float8`,
    })
    .from(games)
    .innerJoin(analyses, eq(analyses.gameId, games.id))
    .where(where);
  return { games: Number(row?.games ?? 0), accuracy: row?.accuracy == null ? null : Number(row.accuracy) };
}

/**
 * The player's marks of the filtered analysed games, per phase and kind. `marks[i]`/`phases[i]` are for ply i + 1:
 * White's plies are the odd ordinalities, Black's the even ones. Both arrays are zipped in one `rows from` scan
 * (joining two `with ordinality` scans on `n` re-runs the second per row: about 1 s at 1,000 analyses).
 */
async function markTotals(where: SQL | undefined) {
  return db
    .select({ phase: sql<string>`t.phase`, mark: sql<string>`t.mark`, n: sql<number>`count(*)::int` })
    .from(games)
    .innerJoin(analyses, eq(analyses.gameId, games.id))
    .innerJoin(
      sql`lateral rows from (jsonb_array_elements_text(${analyses.marks}), jsonb_array_elements_text(${analyses.phases})) with ordinality t(mark, phase, n)`,
      sql`true`,
    )
    .where(
      and(
        where,
        sql`t.mark is not null`,
        sql`(t.n - 1) % 2 = case when ${games.colour} = 'white' then 0 else 1 end`,
      ),
    )
    .groupBy(sql`t.phase`, sql`t.mark`);
}

async function mistakesBlock(userId: string, where: SQL | undefined): Promise<Stats['mistakes']> {
  // `analyses.user_id` repeats the owner so the planner can use `analyses_user_id_idx`.
  const w = and(where, eq(analyses.userId, userId));
  const [summary, totals] = await Promise.all([analysedSummary(w), markTotals(w)]);
  const byPhase = { opening: noMarks(), middlegame: noMarks(), endgame: noMarks() };
  if (summary.games > 0) {
    for (const t of totals) {
      const phase = t.phase as Phase;
      const mark = t.mark as (typeof MARKS)[number];
      if (PHASES.includes(phase) && MARKS.includes(mark)) byPhase[phase][mark] = round1(Number(t.n) / summary.games);
    }
  }
  return {
    games: summary.games,
    accuracy: summary.games > 0 && summary.accuracy !== null ? round1(summary.accuracy) : null,
    byPhase,
  };
}

/** The statistics of `userId`'s games matching the filters, one query per block. */
export async function getStats(userId: string, f: StatsFilters): Promise<Stats> {
  const where = conditions(userId, f);
  const [colour, time, openings, mistakes] = await Promise.all([
    colourBlock(where),
    timeBlock(where),
    openingsBlock(where, f.openingsColour),
    mistakesBlock(userId, where),
  ]);
  return {
    colour,
    time,
    openings,
    rating: { series: [] },
    mistakes,
  };
}
