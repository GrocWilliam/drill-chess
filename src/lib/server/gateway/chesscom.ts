// chess.com public API.
import { z } from 'zod';
import { config } from '../config';
import { GatewayError, httpGet } from './http';

const base = () => config().CHESSCOM_URL.replace(/\/+$/, '');

async function getJson<T extends z.ZodType>(path: string, shape: T): Promise<z.infer<T>> {
  const res = await httpGet(`${base()}${path}`);
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new GatewayError('unavailable', `chess.com ${path}: not JSON`);
  }
  const parsed = shape.safeParse(body);
  if (!parsed.success) throw new GatewayError('unavailable', `chess.com ${path}: unexpected shape`);
  return parsed.data;
}

/** Whether the player exists. Throws GatewayError `unavailable` when the site does not answer. */
export async function playerExists(username: string): Promise<boolean> {
  try {
    const res = await httpGet(`${base()}/pub/player/${encodeURIComponent(username.toLowerCase())}`);
    await res.body?.cancel();
    return true;
  } catch (e) {
    if (e instanceof GatewayError && e.kind === 'not_found') return false;
    throw e;
  }
}

export interface Archive {
  year: number;
  month: number;
  /** `/pub/player/<u>/games/YYYY/MM`, to pass to `fetchArchive`. */
  path: string;
}

const ARCHIVE_PATH = /^\/pub\/player\/[^/]+\/games\/(\d{4})\/(\d{2})$/;

/** The archive of an archives-list URL, or null when its path is not a month archive. */
export function parseArchiveUrl(url: string): Archive | null {
  let path: string;
  try {
    path = new URL(url).pathname.replace(/\/+$/, '');
  } catch {
    return null;
  }
  const m = ARCHIVE_PATH.exec(path);
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year: Number(m[1]), month, path };
}

const archivesShape = z.object({ archives: z.array(z.string()) });

/** The player's month archives (other URLs dropped). A player without archives has none (404 → []). */
export async function listArchives(username: string): Promise<Archive[]> {
  let body: z.infer<typeof archivesShape>;
  try {
    body = await getJson(`/pub/player/${encodeURIComponent(username.toLowerCase())}/games/archives`, archivesShape);
  } catch (e) {
    if (e instanceof GatewayError && e.kind === 'not_found') return [];
    throw e;
  }
  return body.archives.map(parseArchiveUrl).filter((a): a is Archive => a !== null);
}

const side = z.object({
  username: z.string(),
  rating: z.number().int().nullish(),
  result: z.string(),
});

/** One game of a month archive, the fields the import reads. */
export const chesscomGame = z.object({
  url: z.string(),
  pgn: z.string().optional(),
  time_control: z.string(),
  end_time: z.number(),
  time_class: z.string(),
  rules: z.string(),
  initial_setup: z.string().optional(),
  eco: z.string().optional(),
  white: side,
  black: side,
});
export type ChesscomGame = z.infer<typeof chesscomGame>;

/** The games of a month archive. A game of an unexpected shape is returned as null (the import skips it). */
export async function fetchArchive(path: string): Promise<(ChesscomGame | null)[]> {
  const body = await getJson(path, z.object({ games: z.array(z.unknown()) }));
  return body.games.map((g) => {
    const r = chesscomGame.safeParse(g);
    return r.success ? r.data : null;
  });
}
