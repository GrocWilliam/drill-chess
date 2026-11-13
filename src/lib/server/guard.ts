// Route guards: where a request must be redirected (303) given whether a user is signed in, or null.

/** Pages only for signed-in users (`/games/demo` is public). */
const PRIVATE = ['/games', '/stats', '/openings', '/endgames', '/account'];
/** Pages only for visitors. */
const VISITOR_ONLY = ['/', '/signup', '/login'];

const under = (path: string, prefix: string) => path === prefix || path.startsWith(prefix + '/');

export function guard(url: URL, signedIn: boolean): string | null {
  const path = url.pathname;
  if (signedIn) return VISITOR_ONLY.includes(path) ? '/games' : null;
  if (path === '/games/demo' || under(path, '/games/demo')) return null;
  if (PRIVATE.some((p) => under(path, p))) return `/login?next=${encodeURIComponent(path + url.search)}`;
  return null;
}
