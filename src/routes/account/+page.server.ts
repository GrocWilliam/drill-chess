import { fail, redirect } from '@sveltejs/kit';
import { deleteAccount, sessionCookie, updatePreferences } from '$lib/server/accounts';
import { isSite, listLinkedAccounts, unlinkAccount } from '$lib/server/games';
import { linkAction } from '$lib/server/link-action';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  // hooks.server.ts already guards /account; this keeps the type narrow.
  if (!locals.user) redirect(303, `/login?next=${encodeURIComponent(url.pathname)}`);
  const { email, lang, theme } = locals.user;
  const linked = await listLinkedAccounts(locals.user.id);
  return {
    email,
    lang,
    theme,
    linked: linked.map(({ site, username }) => ({ site, username })),
    saved: url.searchParams.get('saved') === '1',
    modal: url.searchParams.get('modal')
  };
};

export const actions: Actions = {
  link: (event) => linkAction(event, '/account'),
  unlink: async ({ request, locals }) => {
    if (!locals.user) redirect(303, '/login?next=%2Faccount');
    const site = String((await request.formData()).get('site') ?? '');
    if (!isSite(site)) return fail(400, { unlink: { site, error: 'invalid' as const } });
    if ((await unlinkAccount(locals.user.id, site)) === 'import_running') return fail(409, { unlink: { site, error: 'import_running' as const } });
    redirect(303, '/account');
  },
  preferences: async ({ request, locals }) => {
    if (!locals.user) redirect(303, '/login?next=%2Faccount');
    const form = await request.formData();
    const lang = String(form.get('lang') ?? '');
    const theme = String(form.get('theme') ?? '');
    if (!(await updatePreferences(locals.user.id, { lang, theme }))) return fail(400, { error: 'invalid' });
    redirect(303, '/account?saved=1');
  },
  delete: async ({ request, locals, cookies }) => {
    if (!locals.user) redirect(303, '/login?next=%2Faccount');
    const password = String((await request.formData()).get('password') ?? '');
    if ((await deleteAccount(locals.user.id, password)) !== 'ok') return fail(400, { deleteError: 'password_wrong' as const });
    const { maxAge: _, ...options } = sessionCookie.options();
    cookies.delete(sessionCookie.name, options);
    redirect(303, '/');
  },
};
