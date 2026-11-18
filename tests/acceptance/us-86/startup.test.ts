// US-86: a server started on a database already holding games without opening names answers /health 200 only
// once they have their names (PGlite on a temporary directory, the games inserted before the server starts).
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { logIn, visitAs } from '../support/accounts.mjs';
import { listedGames } from '../support/games.mjs';
import { expectedOpeningOfMoves } from '../support/openings.mjs';
import { insertGames, insertLink, insertUser } from '../support/openings-db';
import { startServer } from '../support/server.mjs';

let dir: string;
let server: Awaited<ReturnType<typeof startServer>> | undefined;
const email = `${crypto.randomUUID()}@example.test`;
const password = 'correct-horse-1';

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drill-chess-pglite-'));
  const { connect } = await import('../../../src/lib/server/db/index');
  const { hashPassword } = await import('../../../src/lib/server/accounts/password');
  const conn = connect({ pgliteDataDir: dir });
  await conn.migrate();
  const userId = await insertUser(conn.db, email, await hashPassword(password));
  await insertLink(conn.db, userId, 'made_up_player');
  await insertGames(conn.db, userId, [{ moves: '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6' }, { moves: '1. a3' }]);
  await conn.close();
}, 120000);

afterAll(async () => {
  await server?.stop();
  rmSync(dir, { recursive: true, force: true });
});

describe('server start on a database with games without opening names', () => {
  it('when /health first answers 200, those games have their names', async () => {
    server = await startServer({ env: { PGLITE_DATA_DIR: dir } });
    const session = (await logIn(server.url, { email, password })).session?.value;
    expect(session, 'setup: login failed').toBeTruthy();
    const rows = listedGames((await visitAs(server.url, session, { path: '/games' })).html);
    expect(rows).toHaveLength(2);
    const najdorf = expectedOpeningOfMoves('1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6')!;
    const anderssen = expectedOpeningOfMoves('1. a3')!;
    const text = rows.map((r: { text: string }) => r.text).join(' | ');
    expect(text).toContain(najdorf.name);
    expect(text).toContain(anderssen.name);
    expect(text).toContain(najdorf.eco);
  }, 120000);
});
