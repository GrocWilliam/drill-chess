// Browser side of saving an analysis: POST /api/games/<id>/analysis and read the server's marks and accuracies.
import type { Eval, Mark } from '$lib/chess/analysis';

export type SavedReview = { marks: (Mark | null)[]; accuracyWhite: number; accuracyBlack: number };

const MARKS = new Set(['inaccuracy', 'mistake', 'blunder']);

/**
 * Sends `{depth, evals, best}` for game `gameId` → the server's marks and accuracies (the page shows those, never
 * marks computed in the browser). Throws `save_failed` on a network error, a non-201 answer or a malformed body.
 */
export async function saveAnalysis(
  gameId: string,
  body: { depth: number; evals: Eval[]; best: (string | null)[] },
  fetchFn: typeof fetch = fetch
): Promise<SavedReview> {
  let res: Response;
  try {
    res = await fetchFn(`/api/games/${encodeURIComponent(gameId)}/analysis`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch {
    throw new Error('save_failed');
  }
  if (res.status !== 201) throw new Error('save_failed');
  const data: unknown = await res.json().catch(() => null);
  if (!isSaved(data, body.best.length)) throw new Error('save_failed');
  return { marks: data.marks, accuracyWhite: data.accuracyWhite, accuracyBlack: data.accuracyBlack };
}

function isSaved(d: unknown, plies: number): d is SavedReview {
  if (typeof d !== 'object' || d === null) return false;
  const o = d as Record<string, unknown>;
  return (
    Array.isArray(o.marks) &&
    o.marks.length === plies &&
    o.marks.every((m) => m === null || (typeof m === 'string' && MARKS.has(m))) &&
    typeof o.accuracyWhite === 'number' &&
    typeof o.accuracyBlack === 'number'
  );
}
