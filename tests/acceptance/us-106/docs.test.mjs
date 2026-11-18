// US-106: the endgame draw rule is documented in docs/prd.md, the endgame test ids and component are in docs/ui.md,
// and CLAUDE.md points at the endgames module. Reads the documents only; the expected texts are the story's, the
// helpers are in ../support/docs.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  between,
  flat,
  hasCode,
  productDoc,
  projectMemoryDoc,
  section,
  uiDoc,
} from '../support/docs.mjs';

const endgameTrainer = () => between(productDoc(), 'Endgame trainer:', 'Accounts:');

test('given docs/prd.md, then its Endgame trainer section contains "20 moves" and names the four earlier draws', () => {
  const trainer = endgameTrainer();
  assert.ok(trainer, 'docs/prd.md has no "Endgame trainer:" section');
  assert.ok(trainer.includes('20 moves'), 'the Endgame trainer section lacks "20 moves"');
  for (const draw of ['stalemate', 'threefold repetition', 'insufficient material', '50-move rule']) {
    assert.ok(trainer.includes(draw), `the Endgame trainer section does not name "${draw}" as an earlier draw`);
  }
});

test('given docs/prd.md, then it no longer contains "≤ 4 pieces left and 30 moves played"', () => {
  assert.ok(
    !flat(productDoc()).includes('≤ 4 pieces left and 30 moves played'),
    'docs/prd.md still holds the old draw clause "≤ 4 pieces left and 30 moves played"',
  );
});

test('given docs/ui.md, then its Test ids section lists every endgame id in backticks', () => {
  const ids = section(uiDoc(), 'Test ids');
  assert.ok(ids, 'docs/ui.md has no "## Test ids" section');
  for (const id of [
    'nav-endgames',
    'endgames-level-<n>',
    'endgames-level-count',
    'endgame-card',
    'endgame-mastered',
    'endgame-streak',
    'endgame-attempts',
    'endgame-name',
    'endgame-goal',
    'endgame-lesson',
    'endgame-moves',
    'endgame-move',
    'endgame-status',
    'endgame-retry',
    'endgame-retry-move',
    'endgame-back',
  ]) {
    assert.ok(hasCode(ids, id), `the Test ids section does not list \`${id}\` in backticks`);
  }
});

test('given docs/ui.md, then its Components section contains EndgamePlay', () => {
  const components = section(uiDoc(), 'Components');
  assert.ok(components, 'docs/ui.md has no "## Components" section');
  assert.ok(components.includes('EndgamePlay'), 'the Components section does not name EndgamePlay');
});

test('given CLAUDE.md, then it still links the three docs and has a Layout pointer to the endgames module', () => {
  const memory = projectMemoryDoc();
  for (const doc of ['docs/prd.md', 'docs/architecture.md', 'docs/ui.md']) {
    assert.ok(memory.includes(doc), `CLAUDE.md no longer contains "${doc}"`);
  }
  const layout = section(memory, 'Layout');
  assert.ok(layout, 'CLAUDE.md has no "## Layout" section');
  assert.ok(/`[^`\n]*endgames[^`\n]*`/.test(layout), 'the Layout section of CLAUDE.md does not point at the endgames module');
});
