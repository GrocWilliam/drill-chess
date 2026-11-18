import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GatewayError } from './http';
import { normaliseCategory, probe } from './tablebase';

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubEnv('TABLEBASE_URL', 'http://fake.test/');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

const reply = (body: unknown, status = 200) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
const FEN = '8/8/8/4k3/3Q4/8/8/4K3 b - - 1 1';

describe('probe', () => {
  it('requests /standard with the encoded FEN and normalises syzygy categories', async () => {
    fetchMock.mockResolvedValue(
      reply({
        category: 'syzygy-loss',
        dtz: -3,
        moves: [
          { uci: 'e5e6', san: 'Ke6', category: 'syzygy-win', dtz: 2 },
          { uci: 'e5d4', san: 'Kxd4', category: 'draw' },
        ],
      }),
    );
    expect(await probe(FEN)).toEqual({
      category: 'loss',
      moves: [
        { uci: 'e5e6', san: 'Ke6', category: 'win' },
        { uci: 'e5d4', san: 'Kxd4', category: 'draw' },
      ],
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(`http://fake.test/standard?fen=${encodeURIComponent(FEN)}`);
  });

  it('makes one attempt on a 500', async () => {
    fetchMock.mockResolvedValue(reply({ error: 'failing' }, 500));
    await expect(probe(FEN)).rejects.toBeInstanceOf(GatewayError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws GatewayError on an invalid body, an unknown category or a non-JSON body', async () => {
    for (const body of [{ category: 'draw' }, { category: 'nope', moves: [] }, 'not json']) {
      fetchMock.mockResolvedValueOnce(reply(body));
      await expect(probe(FEN)).rejects.toBeInstanceOf(GatewayError);
    }
  });

  it('throws GatewayError on a non-200 or a network failure', async () => {
    fetchMock.mockResolvedValue(reply({ error: 'x' }, 400));
    await expect(probe(FEN)).rejects.toBeInstanceOf(GatewayError);
    fetchMock.mockRejectedValue(new Error('down'));
    await expect(probe(FEN)).rejects.toBeInstanceOf(GatewayError);
  });
});

describe('normaliseCategory', () => {
  it('maps only the syzygy categories', () => {
    expect(normaliseCategory('syzygy-win')).toBe('win');
    expect(normaliseCategory('syzygy-loss')).toBe('loss');
    expect(normaliseCategory('cursed-win')).toBe('cursed-win');
  });
});
