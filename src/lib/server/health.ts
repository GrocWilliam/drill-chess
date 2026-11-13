// The app's health: ok once the database is migrated.
import { migrated } from './db';

export function health(isMigrated: () => boolean = migrated) {
  return isMigrated()
    ? { status: 200, body: { status: 'ok' as const } }
    : { status: 503, body: { status: 'starting' as const } };
}
