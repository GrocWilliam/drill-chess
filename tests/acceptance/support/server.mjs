// Starts the built app (`node build`) for acceptance tests. Setup helpers only: no assertions of a criterion.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/** A closed port: no test ever reaches a real chess.com, Lichess or tablebase. */
const CLOSED = 'http://127.0.0.1:9';

let build = null;
/** Runs `make build` once per process (a failure is reported to every caller), unless FORGE_PREBUILT is set. */
export function buildOnce() {
  if (process.env.FORGE_PREBUILT) return;
  if (build === null) {
    const r = spawnSync('make', ['build'], { cwd: repoRoot, stdio: 'inherit' });
    build = r.status === 0 ? { ok: true } : { ok: false, error: `make build failed with code ${r.status}` };
  }
  if (!build.ok) throw new Error(build.error);
}

/** A free TCP port in 10000-32767 (never 0, never the ephemeral range). */
export function freePort() {
  return new Promise((res) => {
    (function tryPort() {
      const p = 10000 + Math.floor(Math.random() * 22000);
      const s = net.createServer();
      s.once('error', tryPort);
      s.listen(p, () => s.close(() => res(p)));
    })();
  });
}

/** The environment of `node build`: the test defaults, then `env` (a key set to undefined is removed). */
function appEnv(port, outbox, opts = {}) {
  const env = { ...process.env };
  for (const k of ['DATABASE_URL', 'SMTP_URL', 'HOST', 'PROTOCOL_HEADER', 'HOST_HEADER', 'ADDRESS_HEADER']) delete env[k];
  Object.assign(env, {
    PORT: String(port),
    PGLITE_DATA_DIR: 'memory://',
    MAIL_OUTBOX: outbox,
    ORIGIN: `http://localhost:${port}`,
    CONTACT_EMAIL: 'forge@example.test',
    PUBLIC_ENGINE_DEPTH: '6',
    CHESSCOM_URL: opts.chesscomUrl ?? CLOSED,
    LICHESS_URL: opts.lichessUrl ?? CLOSED,
    TABLEBASE_URL: opts.tablebaseUrl ?? CLOSED,
  });
  for (const [k, v] of Object.entries(opts.env ?? {})) {
    if (v === undefined) delete env[k];
    else env[k] = String(v);
  }
  return env;
}

function launch(env) {
  const child = spawn(process.execPath, ['build'], { cwd: repoRoot, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const out = { stdout: '', stderr: '' };
  child.stdout.on('data', (d) => (out.stdout += d));
  child.stderr.on('data', (d) => (out.stderr += d));
  const exited = new Promise((res) => child.once('exit', (code, signal) => res({ code, signal })));
  return { child, out, exited };
}

/** GET /health: { status, contentType, body } (body is the raw text), or null when nothing answers. */
export async function health(url) {
  try {
    const r = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
    return { status: r.status, contentType: r.headers.get('content-type') ?? '', body: await r.text() };
  } catch {
    return null;
  }
}

/**
 * Builds once, starts `node build` on a free port and waits for /health = 200.
 * opts: { env, chesscomUrl, lichessUrl, tablebaseUrl, timeoutMs } → { url, outbox, port, log(), stop() }
 */
export async function startServer(opts = {}) {
  buildOnce();
  const port = await freePort();
  const outbox = mkdtempSync(join(tmpdir(), 'drill-chess-outbox-'));
  const { child, out, exited } = launch(appEnv(port, outbox, opts));
  const url = `http://localhost:${port}`;
  let exit = null;
  exited.then((e) => (exit = e));
  const log = () => `--- stdout\n${out.stdout}\n--- stderr\n${out.stderr}`;
  const stop = async () => {
    if (exit === null) {
      child.kill('SIGTERM');
      const t = setTimeout(() => child.kill('SIGKILL'), 10000);
      await exited;
      clearTimeout(t);
    }
    rmSync(outbox, { recursive: true, force: true });
  };
  const deadline = Date.now() + (opts.timeoutMs ?? 30000);
  for (;;) {
    const h = await health(url);
    if (h?.status === 200) break;
    if (exit !== null || Date.now() > deadline) {
      await stop();
      throw new Error(
        `server did not answer /health with 200 within ${opts.timeoutMs ?? 30000} ms ` +
          `(last: ${h ? h.status : 'no answer'}, exit: ${JSON.stringify(exit)})\n${log()}`,
      );
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return { url, outbox, port, log, stop };
}

/**
 * Starts `node build` with the test defaults overridden by `env` and waits for it to exit.
 * → { exited, code, stderr, stdout }; exited is false when it still ran after `timeoutMs` (then it is killed).
 */
export async function runUntilExit(env, timeoutMs = 10000) {
  buildOnce();
  const port = await freePort();
  const outbox = mkdtempSync(join(tmpdir(), 'drill-chess-outbox-'));
  const { child, out, exited } = launch(appEnv(port, outbox, { env }));
  let timer;
  const result = await Promise.race([exited, new Promise((r) => (timer = setTimeout(() => r(null), timeoutMs)))]);
  clearTimeout(timer);
  if (result === null) {
    child.kill('SIGKILL');
    await exited;
  }
  rmSync(outbox, { recursive: true, force: true });
  return { exited: result !== null, code: result?.code ?? null, stdout: out.stdout, stderr: out.stderr };
}
