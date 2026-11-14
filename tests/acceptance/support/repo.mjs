// Reads and commands on the repository itself. No assertions of a criterion.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { repoRoot } from './server.mjs';

/** The text of a file at the repository root, or '' when it does not exist. */
export const repoFile = (path) => (existsSync(join(repoRoot, path)) ? readFileSync(join(repoRoot, path), 'utf8') : '');

export const packageJson = () => JSON.parse(repoFile('package.json') || '{}');

const GENERATED = /^(node_modules|build|\.svelte-kit|data|test-results)(\/|$)/;

/**
 * Copies what a checkout holds (tracked and untracked, non-ignored files, without generated folders) to a fresh
 * temporary directory and runs `make <target>` there. → { code, output }
 */
function copyCheckout(dir) {
  const ls = spawnSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: repoRoot, encoding: 'utf8' });
  if (ls.status !== 0) throw new Error(`git ls-files failed: ${ls.stderr}`);
  for (const f of ls.stdout.split('\0').filter(Boolean)) {
    if (GENERATED.test(f) || !existsSync(join(repoRoot, f))) continue;
    mkdirSync(dirname(join(dir, f)), { recursive: true });
    cpSync(join(repoRoot, f), join(dir, f));
  }
}

/**
 * A fresh checkout in a temporary git repository (same files as `makeInFreshCheckout`, then `git init`).
 * → { dir, run(cmd, args, timeoutMs) → { code, output }, exists(path), move(from, to), remove() }
 */
export function freshCheckout() {
  const dir = mkdtempSync(join(tmpdir(), 'drill-chess-checkout-'));
  copyCheckout(dir);
  const env = { ...process.env };
  delete env.DATABASE_URL;
  const run = (cmd, args, timeoutMs = 600000) => {
    const r = spawnSync(cmd, args, { cwd: dir, env, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 64 << 20 });
    return { code: r.status, output: `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? String(r.error) : ''}` };
  };
  const init = run('git', ['init', '-q']);
  if (init.code !== 0) throw new Error(`git init failed: ${init.output}`);
  return {
    dir,
    run,
    exists: (path) => existsSync(join(dir, path)),
    move: (from, to) => renameSync(join(dir, from), join(dir, to)),
    remove: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/** In a fresh checkout: `npm ci` → { code, output }. */
export const installDependencies = (checkout) => checkout.run('npm', ['ci'], 840000);

/** In a checkout: `node scripts/copy-stockfish.mjs` → { code, output }. */
export const copyStockfish = (checkout) => checkout.run(process.execPath, ['scripts/copy-stockfish.mjs'], 120000);

/** In a checkout: the exit code of `git check-ignore <path>` (0 = ignored). */
export const gitIgnores = (checkout, path) => checkout.run('git', ['check-ignore', '-q', path]).code;

export function makeInFreshCheckout(target, timeoutMs = 600000) {
  const dir = mkdtempSync(join(tmpdir(), 'drill-chess-checkout-'));
  try {
    copyCheckout(dir);
    const env = { ...process.env };
    delete env.DATABASE_URL;
    const r = spawnSync('make', [target], { cwd: dir, env, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 64 << 20 });
    return { code: r.status, output: `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? String(r.error) : ''}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
