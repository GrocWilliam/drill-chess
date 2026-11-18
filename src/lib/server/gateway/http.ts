// The one HTTP client of the gateway: User-Agent, 15 s timeout, one retry on 429/5xx (unless `retry: false`).
import { config } from '../config';

export class GatewayError extends Error {
  constructor(
    readonly kind: 'not_found' | 'unavailable',
    message: string = kind,
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

export const TIMEOUT_MS = 15_000;
export const DEFAULT_RETRY_MS = 1_000;
export const MAX_RETRY_MS = 10_000;

export interface HttpOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** Retry once on 429/5xx (default true). */
  retry?: boolean;
  /** Test seams. */
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

/** Milliseconds to wait before the retry: `Retry-After` (seconds or a date), default 1 s, at most 10 s. */
export function retryDelay(header: string | null, now = Date.now()): number {
  let ms = DEFAULT_RETRY_MS;
  if (header && header.trim() !== '') {
    const secs = Number(header);
    if (Number.isFinite(secs)) ms = secs * 1000;
    else {
      const at = Date.parse(header);
      if (!Number.isNaN(at)) ms = at - now;
    }
  }
  return Math.min(Math.max(ms, 0), MAX_RETRY_MS);
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** One attempt. The timer covers the headers and each gap between body chunks; on expiry the body errors. */
async function attempt(url: string, opts: HttpOptions): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? TIMEOUT_MS;
  const controller = new AbortController();
  let timer = setTimeout(() => controller.abort(), timeoutMs);
  const rearm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), timeoutMs);
  };
  const headers = { 'User-Agent': `drill-chess (contact: ${config().CONTACT_EMAIL})`, ...opts.headers };
  let res: Response;
  try {
    res = await (opts.fetch ?? fetch)(url, { headers, signal: controller.signal });
  } catch {
    clearTimeout(timer);
    throw new GatewayError('unavailable');
  }
  if (!res.body) {
    clearTimeout(timer);
    return res;
  }
  const reader = res.body.getReader();
  const body = new ReadableStream<Uint8Array>({
    async pull(c) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          clearTimeout(timer);
          c.close();
        } else {
          rearm();
          c.enqueue(value);
        }
      } catch {
        clearTimeout(timer);
        c.error(new GatewayError('unavailable'));
      }
    },
    cancel(reason) {
      clearTimeout(timer);
      return reader.cancel(reason);
    },
  });
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

/** GET `url` → the 2xx response. Throws GatewayError: 404 `not_found`; timeouts, network errors, other statuses `unavailable`. */
export async function httpGet(url: string, opts: HttpOptions = {}): Promise<Response> {
  let res = await attempt(url, opts);
  if (opts.retry !== false && (res.status === 429 || res.status >= 500)) {
    const delay = retryDelay(res.headers.get('retry-after'));
    await res.body?.cancel().catch(() => {});
    await (opts.sleep ?? defaultSleep)(delay);
    res = await attempt(url, opts);
  }
  if (res.ok) return res;
  await res.body?.cancel().catch(() => {});
  throw new GatewayError(res.status === 404 ? 'not_found' : 'unavailable');
}
