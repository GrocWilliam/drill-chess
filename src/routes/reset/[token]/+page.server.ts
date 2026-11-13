import { error, fail, redirect } from '@sveltejs/kit';
import { isResetTokenValid, resetPassword, sessionCookie } from '$lib/server/accounts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, setHeaders }) => {
  setHeaders({ 'Referrer-Policy': 'no-referrer' });
  // The 400 is rendered by +error.svelte.
  if (!(await isResetTokenValid(params.token))) error(400, 'reset_invalid');
  return {};
};

export const actions: Actions = {
  default: async ({ request, params, cookies }) => {
    const form = await request.formData();
    const result = await resetPassword(params.token, String(form.get('password') ?? ''));
    if ('error' in result) return fail(400, { invalid: true, errors: {} as { password?: 'password_short' | 'password_long' } });
    if ('errors' in result) return fail(400, { invalid: false, errors: result.errors });
    cookies.set(sessionCookie.name, result.token, sessionCookie.options());
    redirect(303, '/games');
  },
};
