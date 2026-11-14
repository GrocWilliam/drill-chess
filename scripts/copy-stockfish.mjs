// Copies the Stockfish 17 lite single-threaded engine (worker .js and its .wasm) from node_modules/stockfish to
// static/stockfish/stockfish.{js,wasm} (git-ignored). Run by `prebuild` and `predev`; exits 1 when the pair is missing.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = join(root, 'node_modules', 'stockfish');
const out = join(root, 'static', 'stockfish');
const ENGINE = /^stockfish-17(\.\d+)*-lite-single(-[0-9a-f]+)?\.js$/;

function fail(message) {
  console.error(`copy-stockfish: ${message}`);
  process.exit(1);
}

if (!existsSync(pkg)) fail(`${pkg} not found: run npm ci first.`);

let pair = null;
for (const dir of ['src', 'bin', '.']) {
  const abs = join(pkg, dir);
  if (!existsSync(abs)) continue;
  for (const name of readdirSync(abs).sort()) {
    if (!ENGINE.test(name)) continue;
    const wasm = join(abs, name.replace(/\.js$/, '.wasm'));
    if (existsSync(wasm)) pair = { js: join(abs, name), wasm };
  }
  if (pair) break;
}
if (!pair) fail(`no Stockfish 17 lite single-threaded .js/.wasm pair in ${pkg}.`);

mkdirSync(out, { recursive: true });
copyFileSync(pair.js, join(out, 'stockfish.js'));
copyFileSync(pair.wasm, join(out, 'stockfish.wasm'));
console.log(`copy-stockfish: ${pair.js} → static/stockfish/`);
