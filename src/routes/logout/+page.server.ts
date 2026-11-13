import { redirect } from '@sveltejs/kit';
import { logout, sessionCookie } from '$lib/server/accounts';
import type { Actions } from './$types';

export const actions: Actions = {
  default: async ({ cookies }) => {
    await logout(cookies.get(sessionCookie.name));
    const { maxAge: _, ...options } = sessionCookie.options();
    cookies.delete(sessionCookie.name, options);
    redirect(303, '/');
  },
};
