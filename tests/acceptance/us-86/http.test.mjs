// US-86: opening names at import (HTTP against the built app wired to the fake chess.com and Lichess), the dataset
// file and README, and the client bundle.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { signedUpUser } from '../support/accounts.mjs';
import { hasToken, listedGames, openGames } from '../support/games.mjs';
import { waitForImportEnd } from '../support/imports.mjs';
import { linkAccount, startAppWithFakeSites } from '../support/links.mjs';
import { clientFilesContaining, datasetRows, datasetText, expectedOpeningOfMoves, rowWith } from '../support/openings.mjs';
import { repoFile } from '../support/repo.mjs';

let env;
after(async () => env?.stop());
before(async () => {
  env = await startAppWithFakeSites();
});

/** A user who linked `site` as `username` and whose import is done → the rows of /games. */
async function importedRows(site, username) {
  const u = await signedUpUser(env.app.url);
  assert.equal((await linkAccount(env.app.url, u.token, { site, username })).status, 303, 'setup: linking failed');
  assert.equal((await waitForImportEnd(env.app.url, u.token, site, 20000))?.status, 'done', 'setup: the import did not finish');
  return listedGames((await openGames(env.app.url, u.token, { acceptLanguage: 'en' })).html);
}

describe('the dataset in the repository', () => {
  test('static/openings/openings.tsv starts with eco\\tname\\tpgn and has between 3,000 and 5,000 data rows', () => {
    const text = datasetText();
    assert.ok(text.length > 0, 'static/openings/openings.tsv is missing');
    assert.equal(text.split('\n')[0].replace(/\r$/, ''), 'eco\tname\tpgn');
    const n = datasetRows().length;
    assert.ok(n >= 3000 && n <= 5000, `${n} data rows`);
  });

  test('README.md mentions the Lichess chess-openings dataset and CC0', () => {
    const readme = repoFile('README.md');
    assert.match(readme, /chess-openings/i);
    assert.match(readme, /lichess/i);
    assert.match(readme, /CC0/);
  });
});

describe('the client bundle', () => {
  test('no file of build/client contains "Najdorf Variation"', () => {
    assert.deepEqual(clientFilesContaining('Najdorf Variation'), []);
  });
});

describe('opening names at import', () => {
  test('chess.com alpha_pawn: the C50 Rapid draw shows C50 and an Italian Game name; the B90 game keeps the site name', async () => {
    const rows = await importedRows('chesscom', 'alpha_pawn');
    const italian = rows.find((r) => hasToken(r.text, 'Rapid') && hasToken(r.text, 'Draw') && hasToken(r.text, 'C50'));
    assert.ok(italian, `no C50 Rapid draw among: ${rows.map((r) => r.text).join(' | ')}`);
    assert.ok(/Italian Game/.test(italian.text), italian.text);
    assert.ok(!/undefined|null/.test(italian.text), italian.text);
    const najdorf = rowWith(rows, 'B90');
    assert.ok(najdorf, 'no B90 row');
    assert.ok(najdorf.text.includes('Sicilian Defense Najdorf Variation'), najdorf.text);
    assert.ok(!najdorf.text.includes('Sicilian Defense: Najdorf Variation'), najdorf.text);
  });

  test('Lichess game without opening (1. e4 e5 2. Nf3 Nf6): its row shows the ECO and name openingFor gives', async () => {
    const rows = await importedRows('lichess', 'beta_rook');
    const row = rowWith(rows, 'made_up_draw');
    assert.ok(row, 'game not listed');
    const expected = expectedOpeningOfMoves('1. e4 e5 2. Nf3 Nf6');
    assert.ok(expected, 'the dataset has no line for the game');
    assert.ok(hasToken(row.text, expected.eco), `${expected.eco} missing from: ${row.text}`);
    assert.ok(row.text.includes(expected.name), `"${expected.name}" missing from: ${row.text}`);
  });

  test('a Lichess game with a site opening keeps it', async () => {
    const rows = await importedRows('lichess', 'beta_rook');
    const row = rowWith(rows, 'made_up_foe');
    assert.ok(row, 'game not listed');
    assert.ok(hasToken(row.text, 'B01'), row.text);
    assert.ok(row.text.includes('Scandinavian Defense'), row.text);
  });
});
