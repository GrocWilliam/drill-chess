// US-85: the openings architecture is documented in docs/architecture.md, docs/ui.md and CLAUDE.md, and the
// Deployment text of docs/architecture.md matches the us-43 fixture. Reads the documents only; the expected texts
// are the story's, the helpers are in ../support/docs.mjs.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  architectureDoc,
  bullet,
  flat,
  hasCode,
  projectMemoryDoc,
  section,
  tableCells,
  tableRow,
  uiDoc,
} from '../support/docs.mjs';

const here = dirname(fileURLToPath(import.meta.url));

const openingIds = [
  'nav-openings',
  'openings-white',
  'openings-black',
  'openings-positions',
  'openings-due',
  'openings-learned',
  'openings-empty',
  'drill-start',
  'drill-start-both',
  'opening-name',
  'opening-path',
  'opening-path-start',
  'opening-path-move',
  'opening-moves',
  'opening-move',
  'opening-delete',
  'opening-moves-empty',
  'opening-error',
  'modal-opening-delete',
  'opening-delete-confirm',
  'opening-delete-cancel',
  'drill-board',
  'drill-progress',
  'drill-feedback',
  'drill-summary',
  'drill-summary-right',
  'drill-summary-wrong',
  'drill-summary-next',
  'drill-summary-back',
  'drill-summary-again',
  'drill-none',
  'drill-none-edit',
];

test('architecture.md chess row: openingFor(uci[]) over the dataset, imported by server code only, Board takes shapes', () => {
  const row = tableRow(architectureDoc(), 'src/lib/chess/');
  assert.ok(row, 'architecture.md has no "| `src/lib/chess/` |" row');
  for (const text of [
    'openingFor(uci[])',
    'static/openings/openings.tsv',
    'imported by server code only',
    '`Board.svelte` takes `shapes`',
  ]) {
    assert.ok(row.includes(text), `the src/lib/chess/ row lacks "${text}"`);
  }
  assert.ok(!row.includes('(name lookup)'), 'the src/lib/chess/ row still describes openings.ts as "(name lookup)"');
});

test('architecture.md has a src/params/ row naming colour and white|black', () => {
  const row = tableRow(architectureDoc(), 'src/params/');
  assert.ok(row, 'architecture.md has no "| `src/params/` |" row');
  assert.ok(row.includes('`colour`'), 'the src/params/ row does not name `colour`');
  assert.ok(row.includes('white|black'), 'the src/params/ row does not name white|black');
});

test('architecture.md components row names BoardLayout.svelte', () => {
  const row = tableRow(architectureDoc(), 'src/lib/components/');
  assert.ok(row, 'architecture.md has no "| `src/lib/components/` |" row');
  assert.ok(row.includes('BoardLayout.svelte'), 'the src/lib/components/ row does not name BoardLayout.svelte');
});

test('architecture.md game-import module row depends on board and mentions the startup backfill', () => {
  const row = tableRow(architectureDoc(), 'game-import');
  assert.ok(row, 'architecture.md has no module map row for `game-import`');
  const cells = tableCells(architectureDoc(), 'game-import');
  assert.ok(cells.at(-1).includes('`board`'), `the game-import row depends on "${cells.at(-1)}", not on board`);
  assert.ok(row.includes('startup backfill'), 'the game-import row does not mention the startup backfill');
});

test('architecture.md dependency rules say browser code never imports openings.ts', () => {
  const rules = flat(section(architectureDoc(), 'Dependency rules'));
  assert.ok(rules.includes('browser code never imports openings.ts'), 'the dependency rules lack "browser code never imports openings.ts"');
  assert.ok(
    !rules.includes('the server imports `analysis.ts` and `rules.ts` from it'),
    'the dependency rules still hold the sentence this story replaces',
  );
});

test('architecture.md openings data model line has the partial unique index, the 2,000 cap and the walk rule', () => {
  const line = bullet(section(architectureDoc(), 'Data model'), 'openings');
  assert.ok(line, 'the Data model section has no line starting with "- `openings`:"');
  for (const text of [
    "partial unique (repertoire_id, from_fen) where by = 'player'",
    'at most 2,000 player moves per repertoire',
    'every walk tracks visited positions',
  ]) {
    assert.ok(line.includes(text), `the openings data model line lacks "${text}"`);
  }
});

test('architecture.md interfaces contain the 409 codes and the empty drill answer', () => {
  const interfaces = flat(section(architectureDoc(), 'Interfaces'));
  for (const text of ['409 `player_move_exists`/`repertoire_full`', '{moves: [], nextDue}']) {
    assert.ok(interfaces.includes(text), `the interfaces lack "${text}"`);
  }
});

test('architecture.md Deployment section names the startup order with then `games.backfillOpenings()`', () => {
  const deployment = flat(section(architectureDoc(), 'Deployment'));
  assert.ok(deployment.includes('then `games.backfillOpenings()`'), 'the Deployment section lacks "then `games.backfillOpenings()`"');
});

test('us-43 docs checks pass against the updated fixture (Stack, Configuration, Deployment, Testing)', () => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT; // a nested `node --test` must not inherit the parent's reporter context
  try {
    execFileSync(process.execPath, ['--test', '--test-concurrency=1', join(here, '..', 'us-43', 'docs.test.mjs')], {
      env,
      stdio: 'pipe',
      encoding: 'utf8',
    });
  } catch (error) {
    assert.fail(`us-43 docs checks fail:\n${error.stdout ?? ''}${error.stderr ?? ''}`);
  }
});

test('ui.md Test ids section lists each openings id in backticks', () => {
  const ids = section(uiDoc(), 'Test ids');
  assert.ok(ids, 'ui.md has no "## Test ids" section');
  const missing = openingIds.filter((id) => !hasCode(ids, id));
  assert.deepEqual(missing, [], 'ui.md "Test ids" section lacks these openings ids (each in backticks)');
});

test('ui.md Components section names BoardLayout and OpeningDrill', () => {
  const components = section(uiDoc(), 'Components');
  assert.ok(components, 'ui.md has no "## Components" section');
  for (const name of ['BoardLayout', 'OpeningDrill']) {
    assert.ok(components.includes(name), `the ui.md Components section does not name ${name}`);
  }
});

test('CLAUDE.md still links docs/prd.md, docs/architecture.md and docs/ui.md', () => {
  const memory = projectMemoryDoc();
  for (const path of ['docs/prd.md', 'docs/architecture.md', 'docs/ui.md']) {
    assert.ok(memory.includes(path), `CLAUDE.md lacks a link to ${path}`);
  }
});

test('CLAUDE.md Layout has one line saying the openings module follows docs/architecture.md, with its two paths', () => {
  const lines = section(projectMemoryDoc(), 'Layout').split(/\r?\n/);
  const line = lines.find((l) => l.includes('openings') && l.includes('docs/architecture.md'));
  assert.ok(line, 'CLAUDE.md Layout has no line saying the openings module follows docs/architecture.md');
  for (const text of ['`src/lib/server/openings/`', '`src/lib/chess/openings.ts`', 'server-only']) {
    assert.ok(line.includes(text), `the openings line in CLAUDE.md lacks "${text}"`);
  }
});
