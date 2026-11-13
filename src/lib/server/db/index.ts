// The Drizzle client: PostgreSQL through `pg` when DATABASE_URL is set, else PGlite (PGLITE_DATA_DIR).
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import { migrate as pgMigrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle as liteDrizzle } from 'drizzle-orm/pglite';
import { migrate as liteMigrate } from 'drizzle-orm/pglite/migrator';
import pg from 'pg';
import { config } from '../config';
import * as schema from './schema';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/** Read at runtime from the working directory: the Docker image copies this folder next to `build/`. */
export const migrationsFolder = resolve('src/lib/server/db/drizzle');

export interface Connection {
  db: Db;
  /** Applies the pending migrations of `migrationsFolder` (already applied ones are skipped). */
  migrate(): Promise<void>;
  close(): Promise<void>;
}

/** Opens a connection: PostgreSQL when `databaseUrl` is set, else PGlite on `pgliteDataDir` (`memory://` allowed). */
export function connect(opts: { databaseUrl?: string; pgliteDataDir: string }): Connection {
  if (opts.databaseUrl) {
    const pool = new pg.Pool({ connectionString: opts.databaseUrl });
    const db = pgDrizzle({ client: pool, schema });
    return {
      db: db as unknown as Db,
      migrate: () => pgMigrate(db, { migrationsFolder }),
      close: () => pool.end(),
    };
  }
  const dir = opts.pgliteDataDir;
  if (!dir.includes('://')) mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  const db = liteDrizzle({ client, schema });
  return {
    db: db as unknown as Db,
    migrate: () => liteMigrate(db, { migrationsFolder }),
    close: () => client.close(),
  };
}

let connection: Connection | undefined;
function current(): Connection {
  connection ??= connect({ databaseUrl: config().DATABASE_URL, pgliteDataDir: config().PGLITE_DATA_DIR });
  return connection;
}

/** The process's database, opened on first use from the configuration. */
export const db: Db = new Proxy({} as Db, {
  get(_, prop) {
    const target = current().db;
    const value = Reflect.get(target, prop, target);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});

const readiness = Promise.withResolvers<void>();
let isReady = false;
/** Resolves once `migrate()` has run on the process's database. */
export const ready: Promise<void> = readiness.promise;
// A failed migration rejects `ready`; whoever awaits migrate() reports it, so this copy must not crash the process.
ready.catch(() => {});

/** True once `ready` has resolved. */
export const migrated = () => isReady;

let migrating: Promise<void> | undefined;
/** Runs the migrations on the process's database, once; resolves `ready`. */
export function migrate(): Promise<void> {
  migrating ??= current()
    .migrate()
    .then(
      () => {
        isReady = true;
        readiness.resolve();
      },
      (e) => {
        readiness.reject(e);
        throw e;
      },
    );
  return migrating;
}

/** Closes the process's database, if it was opened. */
export async function close(): Promise<void> {
  const c = connection;
  connection = undefined;
  await c?.close();
}
