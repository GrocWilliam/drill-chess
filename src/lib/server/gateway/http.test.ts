import { afterEach, describe, expect, it, vi } from 'vitest';
import { GatewayError, httpGet, retryDelay } from './http';

afterEach(() => vi.useRealTimers());

const never = (_u: any, init: any) =>
  new Promise<Response>((_, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted'))));

describe('retryDelay', () => {
  it('defaults to 1 s, honours seconds, caps at 10 s', () => {
    expect(retryDelay(null)).toBe(1000);
    expect(retryDelay('3')).toBe(3000);
    expect(retryDelay('120')).toBe(10_000);
    expect(retryDelay(new Date(Date.now() + 3_600_000).toUTCString())).toBe(10_000);
  });
});

describe('httpGet', () => {
  it('sends the User-Agent', async () => {
    const f = vi.fn(async () => new Response('ok'));
    await httpGet('http://x/', { fetch: f as any });
    expect((f.mock.calls[0] as any)[1].headers['User-Agent']).toMatch(/^drill-chess \(contact: .+\)$/);
  });

  it('times out after 15 s without headers', async () => {
    vi.useFakeTimers();
    const p = httpGet('http://x/', { fetch: never as any }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(14_999);
    let settled = false;
    p.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await p).toMatchObject({ kind: 'unavailable' });
  });

  it('times out in a gap between chunks', async () => {
    vi.useFakeTimers();
    const f = (_u: any, init: any) =>
      Promise.resolve(
        new Response(
          new ReadableStream({
            start(c) {
              c.enqueue(new Uint8Array([1]));
              init.signal.addEventListener('abort', () => c.error(new Error('aborted')));
            },
          }),
        ),
      );
    const res = await httpGet('http://x/', { fetch: f as any });
    const reader = res.body!.getReader();
    await reader.read();
    const next = reader.read().catch((e) => e);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await next).toBeInstanceOf(GatewayError);
  });

  it('retries once on 503 after Retry-After capped at 10 s', async () => {
    const sleep = vi.fn(async () => {});
    const f = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503, headers: { 'Retry-After': '99' } }))
      .mockResolvedValueOnce(new Response('ok'));
    const res = await httpGet('http://x/', { fetch: f, sleep });
    expect(res.status).toBe(200);
    expect(sleep).toHaveBeenCalledWith(10_000);
  });

  it('waits 10 s at most for a Retry-After of 30 on a 429', async () => {
    vi.useFakeTimers();
    const f = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '30' } }))
      .mockResolvedValueOnce(new Response('ok'));
    const p = httpGet('http://x/', { fetch: f });
    await vi.advanceTimersByTimeAsync(9_999);
    expect(f).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect((await p).status).toBe(200);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('fails as unavailable when the response stalls over 15 s on both attempts', async () => {
    vi.useFakeTimers();
    const f = vi.fn(never);
    const p = httpGet('http://x/', { fetch: f as any }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(f).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await p).toMatchObject({ name: 'GatewayError', kind: 'unavailable' });
  });

  it('waits 1 s without Retry-After and gives up after one retry', async () => {
    const sleep = vi.fn(async () => {});
    const f = vi.fn(async () => new Response('', { status: 429 }));
    await expect(httpGet('http://x/', { fetch: f, sleep })).rejects.toMatchObject({ kind: 'unavailable' });
    expect(f).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it('maps 404 to not_found without retry', async () => {
    const f = vi.fn(async () => new Response('', { status: 404 }));
    await expect(httpGet('http://x/', { fetch: f })).rejects.toMatchObject({ kind: 'not_found' });
    expect(f).toHaveBeenCalledTimes(1);
  });
});
