import { describe, expect, it, vi } from 'vitest';
import { saveAnalysis } from './save-analysis';

const body = { depth: 6, evals: [{ cp: 0 }, { cp: 20 }, { cp: 10 }], best: ['e2e4', null] };
const answer = { marks: [null, 'mistake'], accuracyWhite: 91.2, accuracyBlack: 70 };
const reply = (status: number, data: unknown) => vi.fn(async () => new Response(JSON.stringify(data), { status }));

describe('saveAnalysis', () => {
  it('POSTs the body as JSON and returns the server marks and accuracies', async () => {
    const f = reply(201, answer);
    expect(await saveAnalysis('abc', body, f as unknown as typeof fetch)).toEqual(answer);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/games/abc/analysis');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual(body);
  });

  it('fails on a non-201 answer', async () => {
    await expect(saveAnalysis('abc', body, reply(500, { error: {} }) as unknown as typeof fetch)).rejects.toThrow('save_failed');
    await expect(saveAnalysis('abc', body, reply(200, answer) as unknown as typeof fetch)).rejects.toThrow('save_failed');
  });

  it('fails on a network error', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('network');
    });
    await expect(saveAnalysis('abc', body, f as unknown as typeof fetch)).rejects.toThrow('save_failed');
  });

  it('fails on a malformed answer', async () => {
    for (const bad of [null, { ...answer, marks: [null] }, { ...answer, marks: [null, 'great'] }, { ...answer, accuracyWhite: '9' }]) {
      await expect(saveAnalysis('abc', body, reply(201, bad) as unknown as typeof fetch)).rejects.toThrow('save_failed');
    }
  });
});
