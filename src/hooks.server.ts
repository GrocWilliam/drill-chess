import { redirect, type Handle, type ServerInit } from '@sveltejs/kit';
import { config } from '$lib/server/config';
import { pickLang, pickTheme } from '$lib/i18n';
import { getSessionUser, sessionCookie } from '$lib/server/accounts';
import { close, migrate } from '$lib/server/db';
import { guard } from '$lib/server/guard';
import { startJobLoop, type JobLoop } from '$lib/server/jobs';

/** Runs once before the server answers: the configuration (exits on an invalid value), then the migrations. */
export const init: ServerInit = async () => {
  config();
  let jobs: JobLoop | undefined;
  // adapter-node emits this after a SIGINT/SIGTERM once requests are done: stop taking jobs, close the database.
  // A job still running is not awaited (it can take a while); it is put back to `queued` at the next start.
  process.once('sveltekit:shutdown' as 'exit', () => {
    void jobs?.stop();
    void close();
  });
  try {
    await migrate();
  } catch (e) {
    console.error('Database migration failed:', e);
    process.exit(1);
  }
  jobs = startJobLoop();
};

export const handle: Handle = async ({ event, resolve }) => {
  const token = event.cookies.get(sessionCookie.name);
  const user = token ? await getSessionUser(token) : null;
  event.locals.user = user;

  const to = guard(event.url, user !== null);
  if (to) redirect(303, to);

  // A signed-in user's own language and theme win over the cookies and Accept-Language.
  const lang = user ? user.lang : pickLang(event.request.headers.get('accept-language'), event.cookies.get('lang'));
  const theme = pickTheme(user ? user.theme : event.cookies.get('theme'));
  event.locals.lang = lang;
  event.locals.theme = theme;
  return resolve(event, {
    transformPageChunk: ({ html }) =>
      html.replace('%lang%', lang).replace('%theme%', theme ? `data-theme="${theme}"` : ''),
  });
};
