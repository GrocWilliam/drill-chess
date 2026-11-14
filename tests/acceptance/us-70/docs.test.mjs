// US-70: docs/ui.md lists the stats page's components and test ids.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasCode, uiDoc } from '../support/docs.mjs';

test('given docs/ui.md, then it lists the stats test ids and the ResultBar and RatingChart components', () => {
  const doc = uiDoc();
  for (const t of ['nav-stats', 'stats-filters', 'stats-empty', 'stats-colour', 'stats-openings-colour', 'stats-time',
    'stats-rating-series', 'stats-rating-summary', 'stats-mistakes', 'stats-mistakes-empty', 'ResultBar', 'RatingChart']) {
    assert.ok(hasCode(doc, t), `docs/ui.md does not list \`${t}\``);
  }
});
