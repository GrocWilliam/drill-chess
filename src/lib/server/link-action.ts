// The `?/link` form action shared by /account and /games.
import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { isSite, linkAccount, requestSync } from './games';

const STATUS = { username_invalid: 400, username_unknown: 400, site_unavailable: 502, import_running: 409 } as const;

export async function linkAction({ request, locals }: RequestEvent, page: string) {
  if (!locals.user) redirect(303, `/login?next=${encodeURIComponent(page)}`);
  const form = await request.formData();
  const site = String(form.get('site') ?? '');
  const username = String(form.get('username') ?? '');
  if (!isSite(site)) return fail(400, { link: { site, username, error: 'username_invalid' as const } });
  const result = await linkAccount(locals.user.id, site, username);
  if (result === 'ok') redirect(303, page);
  return fail(STATUS[result], { link: { site, username, error: result } });
}

const SYNC_STATUS = { import_running: 409, not_linked: 400 } as const;

export async function syncAction({ request, locals }: RequestEvent, page: string) {
  if (!locals.user) redirect(303, `/login?next=${encodeURIComponent(page)}`);
  const form = await request.formData();
  const site = String(form.get('site') ?? '');
  if (!isSite(site)) return fail(400, { sync: { site, error: 'not_linked' as const } });
  const result = await requestSync(locals.user.id, site);
  if (result === 'ok') redirect(303, page);
  return fail(SYNC_STATUS[result], { sync: { site, error: result } });
}
