import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GatewayError } from '../gateway/http';

vi.stubEnv('PGLITE_DATA_DIR', 'memory://');
const probe = vi.fn();
vi.mock('../gateway/tablebase', () => ({ probe: (fen: string) => probe(fen) }));

const AFTER_QD4 = '8/8/8/4k3/3Q4/8/8/4K3 b - - 1 1';
const answer = {
  category: 'loss',
  moves: [
    { uci: 'e5e6', san: 'Ke6', category: 'win' },
    { uci: 'e5d4', san: 'Kxd4', category: 'draw' },
  ],
};

describe('endgames.reply', () => {
  let m: typeof import('./index');
  beforeAll(async () => {
    const { migrate } = await import('../db');
    await migrate();
    m = await import('./index');
  }, 120_000);
  beforeEach(() => probe.mockReset());

  it('answers moves[0] and caches by the full FEN', async () => {
    probe.mockResolvedValue(answer);
    const expected = { category: 'loss', reply: { uci: 'e5e6', san: 'Ke6' }, replyCategory: 'win' };
    expect(await m.reply('kq-k', AFTER_QD4)).toEqual(expected);
    expect(await m.reply('kq-k', AFTER_QD4)).toEqual(expected);
    expect(probe).toHaveBeenCalledTimes(1);
    await m.reply('kq-k', '8/8/8/4k3/3Q4/8/8/4K3 b - - 3 2');
    expect(probe).toHaveBeenCalledTimes(2);
  });

  it('null reply without moves', async () => {
    probe.mockResolvedValue({ category: 'draw', moves: [] });
    expect(await m.reply('kq-k', 'k7/8/1Q6/8/8/8/8/4K3 b - - 0 1')).toEqual({
      category: 'draw',
      reply: null,
      replyCategory: null,
    });
  });

  it('rejects unknown ids and invalid FENs without probing', async () => {
    expect(await m.reply('nope', AFTER_QD4)).toEqual({ error: 'unknown_position' });
    for (const fen of [
      '',
      'garbage',
      '8/8/8/4k3/8/8/8/3QK3 w - - 0 1', // the player to move
      '8/ppppp3/8/4k3/8/8/8/3QK3 b - - 0 1', // 8 pieces
    ])
      expect(await m.reply('kq-k', fen)).toEqual({ error: 'invalid_fen' });
    expect(await m.reply('philidor', '4k3/8/7r/3KP3/8/8/8/R7 b - - 0 1')).toEqual({ error: 'invalid_fen' });
    expect(probe).not.toHaveBeenCalled();
  });

  it('does not cache a failure', async () => {
    const fen = '8/8/8/8/3k4/8/8/3QK3 b - - 0 1';
    probe.mockRejectedValueOnce(new GatewayError('unavailable'));
    expect(await m.reply('kq-k', fen)).toEqual({ error: 'tablebase_unavailable' });
    probe.mockResolvedValueOnce({ category: 'draw', moves: [{ uci: 'd4e4', san: 'Ke4', category: 'draw' }] });
    expect(await m.reply('kq-k', fen)).toMatchObject({ category: 'draw', replyCategory: 'draw' });
    expect(probe).toHaveBeenCalledTimes(2);
  });
});
