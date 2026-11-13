import { requestPasswordReset } from '$lib/server/accounts';
import type { Actions } from './$types';

export const actions: Actions = {
  default: async ({ request }) => {
    const form = await request.formData();
    await requestPasswordReset(String(form.get('email') ?? ''));
    return { sent: true };
  },
};
