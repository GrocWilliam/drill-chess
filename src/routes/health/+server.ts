import { json } from '@sveltejs/kit';
import { health } from '$lib/server/health';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
  const h = health();
  return json(h.body, { status: h.status, headers: { 'cache-control': 'no-store' } });
};
