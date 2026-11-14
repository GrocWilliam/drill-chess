// US-43: the board and game-review design is written down in docs/architecture.md and docs/ui.md.
// Reads the documents only; the expected texts are the story's, the helpers are in ../support/docs.mjs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { architectureDoc, bullet, flat, hasCode, projectMemoryDoc, section, uiDoc } from '../support/docs.mjs';

// The four sections of docs/architecture.md that this story must not touch, as they were on main.
const unchangedSections = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'architecture-unchanged-sections.md');

const testIds = [
  'board',
  'board-move-input',
  'board-move-invalid',
  'board-promotion',
  'board-promotion-q',
  'board-promotion-r',
  'board-promotion-b',
  'board-promotion-n',
  'eval-bar',
  'move-list',
  'move',
  'eval-curve',
  'eval-curve-ply',
  'review-progress',
  'review-best',
  'review-accuracy',
  'review-accuracy-white',
  'review-accuracy-black',
  'review-start',
  'review-prev',
  'review-next',
  'review-end',
  'review-flip',
  'review-reanalyse',
  'review-back-to-game',
  'review-error',
  'review-retry',
  'review-noscript',
  'landing-demo',
  'games-analysed',
  'data-fen',
  'data-orientation',
];

test('architecture.md data model line for game-review has the cascade, the phases jsonb and the browser-marks rule', () => {
  const line = bullet(architectureDoc(), 'game-review');
  assert.ok(line, 'architecture.md has no data model line starting with "- `game-review`:"');
  for (const text of ['user_id → `users` ON DELETE CASCADE', 'phases jsonb', 'it never stores marks sent by the browser']) {
    assert.ok(line.includes(text), `the game-review data model line lacks "${text}"`);
  }
});

test('architecture.md names scripts/, copy-stockfish.mjs, GameReview.svelte, computeReview, engineDepth, ?ply=N and the demo rule', () => {
  const doc = flat(architectureDoc());
  for (const text of [
    'scripts/',
    'copy-stockfish.mjs',
    'GameReview.svelte',
    'computeReview',
    'engineDepth',
    '?ply=N',
    '`/games/demo` never sends anything to the analysis endpoint',
  ]) {
    assert.ok(doc.includes(text), `architecture.md lacks "${text}"`);
  }
});

test('architecture.md states that games never imports review and lists the invalid_analysis fields', () => {
  const doc = flat(architectureDoc());
  assert.ok(doc.includes('`games` never imports `review`'), 'architecture.md lacks "`games` never imports `review`"');
  assert.ok(doc.includes('`depth|evals|best|body`'), 'architecture.md lacks the field values "`depth|evals|best|body`"');
});

test('architecture.md Stack, Configuration, Deployment and Testing sections are unchanged from main', () => {
  const current = architectureDoc();
  const snapshot = readFileSync(unchangedSections, 'utf8');
  for (const title of ['Stack', 'Configuration', 'Deployment', 'Testing']) {
    assert.equal(section(current, title), section(snapshot, title), `the "${title}" section of architecture.md changed`);
  }
});

test('ui.md Test ids section lists each board and review test id, plus data-fen and data-orientation', () => {
  const ids = section(uiDoc(), 'Test ids');
  assert.ok(ids, 'ui.md has no "## Test ids" section');
  const missing = testIds.filter((id) => !hasCode(ids, id));
  assert.deepEqual(missing, [], 'ui.md "Test ids" section lacks these ids (each in backticks)');
});

test('ui.md no longer says the demo link comes with the game-review module', () => {
  assert.ok(
    !flat(uiDoc()).includes('the demo link comes with the game-review module'),
    'ui.md still contains "the demo link comes with the game-review module"',
  );
});

test('CLAUDE.md still links docs/prd.md, docs/architecture.md and docs/ui.md', () => {
  const memory = projectMemoryDoc();
  for (const path of ['docs/prd.md', 'docs/architecture.md', 'docs/ui.md']) {
    assert.ok(memory.includes(path), `CLAUDE.md lacks a link to ${path}`);
  }
});
