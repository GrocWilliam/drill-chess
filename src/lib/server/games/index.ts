// The game-import module: linked usernames, import jobs and games.
import { and, asc, desc, eq, notInArray, sql } from 'drizzle-orm';
import { countPlies } from '../../chess/rules';
import { db } from '../db';
import * as chesscom from '../gateway/chesscom';
import { GatewayError } from '../gateway/http';
import * as lichess from '../gateway/lichess';
import { filterConditions, type GameFilters } from './filters';
import { mapChesscomGame } from './map-chesscom';
import { mapLichessGame } from './map-lichess';
import { withOpening } from './opening';
import { games, importJobs, linkedAccounts } from './schema';

export { backfillOpenings, withOpening } from './opening';

export type Site = 'chesscom' | 'lichess';
export type LinkResult = 'ok' | 'username_invalid' | 'import_running' | 'username_unknown' | 'site_unavailable';

const USERNAME = /^[A-Za-z0-9_-]{1,50}$/;

export const isSite = (s: unknown): s is Site => s === 'chesscom' || s === 'lichess';

const isActiveJobConflict = (e: unknown): boolean => {
  for (let x: any = e; x; x = x.cause) {
    if (x.code === '23505' && String(x.constraint ?? x.message).includes('import_jobs_one_active_per_user_idx')) return true;
    if (String(x.message ?? '').includes('import_jobs_one_active_per_user_idx')) return true;
  }
  return false;
};

/** Links the username and queues its first import: format, then active job, then remote existence. */
export async function linkAccount(userId: string, site: Site, username: string): Promise<LinkResult> {
  if (!USERNAME.test(username)) return 'username_invalid';
  const active = await db.query.importJobs.findFirst({
    where: (j, { and, eq, inArray }) => and(eq(j.userId, userId), inArray(j.status, ['queued', 'running'])),
  });
  if (active) return 'import_running';
  try {
    const exists = site === 'chesscom' ? await chesscom.playerExists(username) : await lichess.userExists(username);
    if (!exists) return 'username_unknown';
  } catch (e) {
    if (e instanceof GatewayError) return 'site_unavailable';
    throw e;
  }
  try {
    await db.transaction(async (tx) => {
      await tx.insert(linkedAccounts).values({ userId, site, username }).onConflictDoNothing();
      await tx.insert(importJobs).values({ userId, site, status: 'queued' });
    });
  } catch (e) {
    if (isActiveJobConflict(e)) return 'import_running';
    throw e;
  }
  notifyQueued();
  return 'ok';
}

/** Queues a sync of a linked site. */
export async function requestSync(userId: string, site: Site): Promise<'ok' | 'import_running' | 'not_linked'> {
  const account = await db.query.linkedAccounts.findFirst({
    where: (a, { and, eq }) => and(eq(a.userId, userId), eq(a.site, site)),
  });
  if (!account) return 'not_linked';
  try {
    await db.insert(importJobs).values({ userId, site, status: 'queued' });
  } catch (e) {
    if (isActiveJobConflict(e)) return 'import_running';
    throw e;
  }
  notifyQueued();
  return 'ok';
}

/** The `ended_at` of the user's newest stored game of the site, or null when there is none. */
async function newestEndedAt(userId: string, site: Site): Promise<Date | null> {
  const rows = await db
    .select({ at: sql<Date | null>`max(${games.endedAt})` })
    .from(games)
    .where(and(eq(games.userId, userId), eq(games.site, site)));
  const at = rows[0]?.at;
  return at ? new Date(at) : null;
}

/** Unlinks the site's username and deletes its games and import jobs; refused while a job of the user is active. */
export async function unlinkAccount(userId: string, site: Site): Promise<'ok' | 'import_running'> {
  return db.transaction(async (tx) => {
    const active = await tx.query.importJobs.findFirst({
      where: (j, { and, eq, inArray }) => and(eq(j.userId, userId), inArray(j.status, ['queued', 'running'])),
    });
    if (active) return 'import_running' as const;
    await tx.delete(games).where(and(eq(games.userId, userId), eq(games.site, site)));
    await tx.delete(importJobs).where(and(eq(importJobs.userId, userId), eq(importJobs.site, site)));
    await tx.delete(linkedAccounts).where(and(eq(linkedAccounts.userId, userId), eq(linkedAccounts.site, site)));
    return 'ok' as const;
  });
}

export interface LinkedAccount {
  site: Site;
  username: string;
  lastSyncedAt: Date | null;
}

export async function listLinkedAccounts(userId: string): Promise<LinkedAccount[]> {
  const rows = await db
    .select({ site: linkedAccounts.site, username: linkedAccounts.username, lastSyncedAt: linkedAccounts.lastSyncedAt })
    .from(linkedAccounts)
    .where(eq(linkedAccounts.userId, userId))
    .orderBy(asc(linkedAccounts.site));
  return rows as LinkedAccount[];
}

// ---- Import jobs ----

const queuedListeners = new Set<() => void>();
/** Calls `listener` whenever a job is queued (the job loop wakes on it). → unsubscribe. */
export function onJobQueued(listener: () => void): () => void {
  queuedListeners.add(listener);
  return () => queuedListeners.delete(listener);
}
function notifyQueued() {
  for (const l of queuedListeners) l();
}

export type JobStatus = 'queued' | 'running' | 'done' | 'failed';
export interface ImportJob {
  id: string;
  userId: string;
  site: Site;
  status: JobStatus;
  imported: number;
  skipped: number;
  error: string | null;
}

/** Puts the jobs left `running` (a stopped server) back to `queued`. → how many. */
export async function resetRunningJobs(): Promise<number> {
  const rows = await db
    .update(importJobs)
    .set({ status: 'queued' })
    .where(eq(importJobs.status, 'running'))
    .returning({ id: importJobs.id });
  return rows.length;
}

/** Marks the oldest queued job `running` and returns it, or null when none is queued. */
export async function claimNextJob(): Promise<ImportJob | null> {
  const rows = await db
    .update(importJobs)
    .set({ status: 'running' })
    .where(
      eq(
        importJobs.id,
        sql`(select ${importJobs.id} from ${importJobs} where ${importJobs.status} = 'queued' order by ${importJobs.createdAt} limit 1 for update skip locked)`,
      ),
    )
    .returning();
  const j = rows[0];
  return j ? toJob(j) : null;
}

const toJob = (j: typeof importJobs.$inferSelect): ImportJob => ({
  id: j.id,
  userId: j.userId,
  site: j.site as Site,
  status: j.status as JobStatus,
  imported: j.imported,
  skipped: j.skipped,
  error: j.error,
});

/** The current UTC month and the `n - 1` previous ones, oldest first, as { year, month (1-12) }. */
export function lastMonths(n: number, now = new Date()): { year: number; month: number }[] {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
  }
  return out;
}

async function updateCounts(job: ImportJob, imported: number, skipped: number) {
  await db.update(importJobs).set({ imported, skipped }).where(eq(importJobs.id, job.id));
}

/** Stores the chess.com games of the first import: the archives of the current month and the 2 previous. */
async function importChesscom(job: ImportJob, username: string, now: Date) {
  const newest = await newestEndedAt(job.userId, 'chesscom');
  const wanted = newest
    ? lastMonths(
        (now.getUTCFullYear() - newest.getUTCFullYear()) * 12 + now.getUTCMonth() - newest.getUTCMonth() + 1,
        now,
      )
    : lastMonths(3, now);
  const archives = await chesscom.listArchives(username);
  let imported = 0;
  let skipped = 0;
  for (const { year, month } of wanted) {
    const archive = archives.find((a) => a.year === year && a.month === month);
    if (!archive) continue;
    const rows = [];
    for (const g of await chesscom.fetchArchive(archive.path)) {
      const mapped = g && mapChesscomGame(g, username);
      const plies = mapped ? countPlies(mapped.pgn) : null;
      if (!mapped || plies === null) {
        // In a sync, a game not newer than the newest stored one was already skipped by an earlier import.
        if (!(newest && g && g.end_time * 1000 <= newest.getTime())) skipped++;
        continue;
      }
      rows.push(withOpening({ ...mapped, userId: job.userId, site: 'chesscom' as const, plies }));
    }
    if (rows.length) {
      const inserted = await db.insert(games).values(rows).onConflictDoNothing().returning({ id: games.id });
      imported += inserted.length;
    }
    await updateCounts(job, imported, skipped);
  }
}

/** Stores the Lichess games of the first import: those since the first day of the month 2 months ago, UTC. */
async function importLichess(job: ImportJob, username: string, now: Date) {
  const newest = await newestEndedAt(job.userId, 'lichess');
  const since = newest ? newest.getTime() + 1 : Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1);
  let imported = 0;
  let skipped = 0;
  let lines = 0;
  let rows: (typeof games.$inferInsert)[] = [];
  const flush = async () => {
    if (rows.length) {
      const inserted = await db.insert(games).values(rows).onConflictDoNothing().returning({ id: games.id });
      imported += inserted.length;
      rows = [];
    }
    await updateCounts(job, imported, skipped);
  };
  for await (const g of lichess.streamGames(username, since)) {
    const mapped = 'invalid' in g ? null : mapLichessGame(g, username);
    const plies = mapped ? countPlies(mapped.pgn) : null;
    if (!mapped || plies === null) skipped++;
    else rows.push(withOpening({ ...mapped, clock: mapped.clock ?? '', userId: job.userId, site: 'lichess', plies }));
    if (++lines % 100 === 0) await flush();
  }
  await flush();
}

/**
 * Runs a claimed job to its end: `done` (and the account's `last_synced_at`), or `failed` with `site_unavailable`
 * when the site does not answer. Games already stored are kept. Other errors are thrown.
 */
export async function runImportJob(job: ImportJob, now = new Date()): Promise<void> {
  const account = await db.query.linkedAccounts.findFirst({
    where: (a, { and, eq }) => and(eq(a.userId, job.userId), eq(a.site, job.site)),
  });
  try {
    if (account && job.site === 'chesscom') await importChesscom(job, account.username, now);
    if (account && job.site === 'lichess') await importLichess(job, account.username, now);
  } catch (e) {
    if (!(e instanceof GatewayError)) throw e;
    await db
      .update(importJobs)
      .set({ status: 'failed', error: 'site_unavailable', finishedAt: new Date() })
      .where(eq(importJobs.id, job.id));
    await capGames(job.userId);
    return;
  }
  const finishedAt = new Date();
  await db.transaction(async (tx) => {
    await tx.update(importJobs).set({ status: 'done', error: null, finishedAt }).where(eq(importJobs.id, job.id));
    if (account)
      await tx.update(linkedAccounts).set({ lastSyncedAt: finishedAt }).where(eq(linkedAccounts.id, account.id));
  });
  await capGames(job.userId);
}

export const MAX_GAMES = 5_000;

/** Deletes the user's oldest games by `ended_at` beyond `max` (run after every job). → how many were deleted. */
export async function capGames(userId: string, max = MAX_GAMES): Promise<number> {
  const keep = db
    .select({ id: games.id })
    .from(games)
    .where(eq(games.userId, userId))
    .orderBy(desc(games.endedAt), desc(games.id))
    .limit(max);
  const rows = await db
    .delete(games)
    .where(and(eq(games.userId, userId), notInArray(games.id, keep)))
    .returning({ id: games.id });
  return rows.length;
}

/** Ends a job that threw unexpectedly as `failed` (`internal`), if its row still exists. */
export async function failJob(jobId: string): Promise<void> {
  await db
    .update(importJobs)
    .set({ status: 'failed', error: 'internal', finishedAt: new Date() })
    .where(and(eq(importJobs.id, jobId), eq(importJobs.status, 'running')));
}

export interface JobStatusView {
  site: Site;
  status: JobStatus;
  imported: number;
  skipped: number;
  error: string | null;
  finishedAt: Date | null;
}

/** Jobs shown on the status line: queued, running or failed (until a new job), or done less than 24 h ago. */
export function visibleStatuses(jobs: JobStatusView[], now = new Date()): JobStatusView[] {
  return jobs.filter(
    (j) =>
      j.status === 'queued' ||
      j.status === 'running' ||
      j.status === 'failed' ||
      (j.status === 'done' && j.finishedAt !== null && now.getTime() - j.finishedAt.getTime() < 24 * 3600 * 1000),
  );
}

/** The latest job of each site of the user, ordered by site. */
export async function importStatus(userId: string): Promise<JobStatusView[]> {
  const rows = await db
    .selectDistinctOn([importJobs.site], {
      site: importJobs.site,
      status: importJobs.status,
      imported: importJobs.imported,
      skipped: importJobs.skipped,
      error: importJobs.error,
      finishedAt: importJobs.finishedAt,
    })
    .from(importJobs)
    .where(eq(importJobs.userId, userId))
    .orderBy(asc(importJobs.site), desc(importJobs.createdAt));
  return rows as JobStatusView[];
}

// ---- Listing ----

export type Game = typeof games.$inferSelect;
export type { GameFilters } from './filters';
export const PAGE_SIZE = 50;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The user's games, newest first by `ended_at`; `page` starts at 1. */
export async function listGames(
  userId: string,
  filters: GameFilters = {},
  page = 1,
): Promise<{ games: Game[]; page: number; hasNext: boolean }> {
  const p = Number.isInteger(page) && page >= 1 ? page : 1;
  const rows = await db
    .select()
    .from(games)
    .where(and(eq(games.userId, userId), ...filterConditions(filters)))
    .orderBy(desc(games.endedAt), desc(games.id))
    .limit(PAGE_SIZE + 1)
    .offset((p - 1) * PAGE_SIZE);
  return { games: rows.slice(0, PAGE_SIZE), page: p, hasNext: rows.length > PAGE_SIZE };
}

/** One of the user's games, or null (unknown, another user's, or a non-UUID id). */
export async function getGame(userId: string, id: string): Promise<Game | null> {
  if (!UUID.test(id)) return null;
  const rows = await db.select().from(games).where(and(eq(games.userId, userId), eq(games.id, id))).limit(1);
  return rows[0] ?? null;
}

/** The moves of a PGN as one line of text (headers and `{comments}` removed). */
export function movesText(pgn: string): string {
  return pgn
    .replace(/^\[.*\]\s*$/gm, '')
    .replace(/\{[^}]*\}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
