// The `game-review` module: validates the browser's engine evaluations, recomputes marks, phases and accuracies from
// the game's PGN (never trusting marks sent by the browser) and stores one analysis per game.
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { computeReview, type Mark, type Phase } from '../../chess/analysis';
import { positions } from '../../chess/rules';
import { db } from '../db';
import { getGame } from '../games';
import { analyses } from './schema';

const evalEntry = z.union([
  z.strictObject({ cp: z.int().min(-100_000).max(100_000) }),
  z.strictObject({ mate: z.int().min(-250).max(250) }),
]);

/** The fields of a POSTed analysis, checked in this order; any other field is ignored. */
export const analysisBody = z.object({
  depth: z.int().min(1).max(30),
  evals: z.array(evalEntry).max(2_000),
  best: z.array(z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/).nullable()).max(2_000),
});
export type AnalysisBody = z.infer<typeof analysisBody>;
export type AnalysisField = 'depth' | 'evals' | 'best' | 'body';

export interface Analysis {
  depth: number;
  evals: AnalysisBody['evals'];
  best: (string | null)[];
  marks: (Mark | null)[];
  phases: Phase[];
  accuracyWhite: number;
  accuracyBlack: number;
}

export type SaveResult =
  | { ok: true; marks: (Mark | null)[]; accuracyWhite: number; accuracyBlack: number }
  | { ok: false; code: 'not_found' }
  | { ok: false; code: 'invalid_analysis'; field: AnalysisField };

/** `real` columns are float4: back to the one decimal they were computed with. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const oneDecimal = (x: number) => Math.round(x * 10) / 10;

/** Parses `body`, reporting the first failing field in the order depth, evals, best. */
function parse(body: unknown): { ok: true; value: AnalysisBody } | { ok: false; field: AnalysisField } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return { ok: false, field: 'body' };
  const b = body as Record<string, unknown>;
  for (const field of ['depth', 'evals', 'best'] as const) {
    if (!analysisBody.shape[field].safeParse(b[field]).success) return { ok: false, field };
  }
  return { ok: true, value: analysisBody.parse(b) };
}

/** Validates and stores (or replaces) the analysis of the user's game `gameId`. */
export async function saveAnalysis(userId: string, gameId: string, body: unknown): Promise<SaveResult> {
  const game = await getGame(userId, gameId);
  if (!game) return { ok: false, code: 'not_found' };
  const parsed = parse(body);
  if (!parsed.ok) return { ok: false, code: 'invalid_analysis', field: parsed.field };
  const { depth, evals, best } = parsed.value;
  const plies = positions(game.pgn).moves.length;
  if (evals.length !== plies + 1) return { ok: false, code: 'invalid_analysis', field: 'evals' };
  if (best.length !== plies) return { ok: false, code: 'invalid_analysis', field: 'best' };
  const { marks, phases, accuracyWhite, accuracyBlack } = computeReview(game.pgn, evals, best);
  const row = { depth, evals, best, marks, phases, accuracyWhite, accuracyBlack, createdAt: new Date() };
  await db
    .insert(analyses)
    .values({ gameId: game.id, userId, ...row })
    .onConflictDoUpdate({ target: analyses.gameId, set: row });
  return { ok: true, marks, accuracyWhite, accuracyBlack };
}

/** The stored analysis of the user's game, or null. */
export async function getAnalysis(userId: string, gameId: string): Promise<Analysis | null> {
  if (!UUID.test(gameId)) return null;
  const [a] = await db
    .select()
    .from(analyses)
    .where(and(eq(analyses.userId, userId), eq(analyses.gameId, gameId)))
    .limit(1);
  if (!a) return null;
  return {
    depth: a.depth,
    evals: a.evals,
    best: a.best,
    marks: a.marks,
    phases: a.phases,
    accuracyWhite: oneDecimal(a.accuracyWhite),
    accuracyBlack: oneDecimal(a.accuracyBlack),
  };
}

/** The accuracies of those of `gameIds` the user has analysed. */
export async function accuracies(userId: string, gameIds: string[]): Promise<Map<string, { white: number; black: number }>> {
  const map = new Map<string, { white: number; black: number }>();
  const ids = gameIds.filter((id) => UUID.test(id));
  if (ids.length === 0) return map;
  const rows = await db
    .select({ gameId: analyses.gameId, white: analyses.accuracyWhite, black: analyses.accuracyBlack })
    .from(analyses)
    .where(and(eq(analyses.userId, userId), inArray(analyses.gameId, ids)));
  for (const r of rows) map.set(r.gameId, { white: oneDecimal(r.white), black: oneDecimal(r.black) });
  return map;
}
