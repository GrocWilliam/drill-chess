import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import ResultBar from './ResultBar.svelte';

describe('ResultBar', () => {
  it('shows each non-zero count as text with an aria-label', () => {
    const { body } = render(ResultBar, { props: { wins: 3, draws: 0, losses: 1, messages: { 'stats.bar.win': '{count} wins', 'stats.bar.loss': '{count} losses' } } });
    expect(body).toContain('aria-label="3 wins"');
    expect(body).toContain('aria-label="1 losses"');
    expect(body).not.toContain('draws');
  });
});
