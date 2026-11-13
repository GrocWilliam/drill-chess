import { messagesFor } from '$lib/i18n';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
  lang: locals.lang,
  theme: locals.theme,
  messages: messagesFor(locals.lang),
  signedIn: locals.user !== null,
});
