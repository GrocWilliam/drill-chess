import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { nextLine, type Colour } from '$lib/server/openings';
import type { RequestHandler } from './$types';

const query = z.object({
  colour: z.enum(['white', 'black', 'both']),
  seed: z
    .string()
    .regex(/^\d{1,15}$/)
    .transform(Number)
    .optional(),
});
const headers = { 'cache-control': 'no-store' };
const fail = (status: number, code: string, message: string) => json({ error: { code, message } }, { status, headers });

/** The next line to drill in the signed-in user's repertoire(s). */
export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.user) return fail(401, 'unauthorized', 'Sign in to drill your repertoire.');
  const parsed = query.safeParse({
    colour: url.searchParams.get('colour') ?? undefined,
    seed: url.searchParams.get('seed') ?? undefined,
  });
  if (!parsed.success) return fail(400, 'invalid_query', 'Send colour=white|black|both and an optional integer seed ≥ 0.');
  const { colour, seed } = parsed.data;
  const colours: Colour[] = colour === 'both' ? ['white', 'black'] : [colour];
  return json(await nextLine(locals.user.id, colours, new Date(), seed), { headers });
};
