import { fail, redirect } from '@sveltejs/kit';
import { sessionCookie, signup } from '$lib/server/accounts';
import type { Actions } from './$types';

export const actions: Actions = {
  default: async ({ request, cookies, locals }) => {
    const form = await request.formData();
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    const result = await signup(email, password, locals.lang);
    if ('errors' in result) return fail(400, { email, errors: result.errors });
    cookies.set(sessionCookie.name, result.token, sessionCookie.options());
    redirect(303, '/games');
  },
};
