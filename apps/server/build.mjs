import * as esbuild from 'esbuild';
import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync } from 'fs';

// In Docker, APP_VERSION is injected as a build arg (YYYYMMDD-<shorthash>).
// Locally, fall back to reading it from git so `bun run build` always produces
// a tagged output without needing a manual env var.
const version = process.env.APP_VERSION
  ?? execSync('git log -1 --format=%cd-%h --date=format:%Y%m%d').toString().trim();

const watch = process.argv.includes('--watch');

if (!existsSync('dist')) mkdirSync('dist');

const serverOptions = {
  entryPoints: ['src/server/index.ts'],
  outfile: 'dist/server.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  // Leave all npm imports (express, katex, marked, bun:sqlite) as bare specifiers
  // so the runtime resolves them from node_modules. Bundling them would break
  // native modules and bun built-ins.
  packages: 'external',
  target: 'node20',
};

const clientOptions = {
  entryPoints: ['src/client/index.ts'],
  outfile: 'dist/client.js',
  bundle: true,
  platform: 'browser',
  // IIFE wraps everything in an immediately-invoked function so the bundle
  // doesn't pollute the global scope and works as a plain <script> tag.
  format: 'iife',
  minify: !watch,
  target: ['es2020'],
  sourcemap: watch,
  define: { __APP_VERSION__: JSON.stringify(version) },
};

if (watch) {
  // Watch mode: run all in parallel
  const serverCtx = await esbuild.context(serverOptions);
  const clientCtx = await esbuild.context(clientOptions);

  await Promise.all([
    serverCtx.watch(),
    clientCtx.watch(),
  ]);

  // Run tailwind in watch mode
  const tw = spawn(
    './node_modules/.bin/tailwindcss',
    ['-i', 'src/client/style.css', '-o', 'dist/client.css', '--watch'],
    { stdio: 'inherit', shell: true }
  );

  // Run server with --watch
  const srv = spawn(
    'bun',
    ['--watch', 'dist/server.mjs'],
    { stdio: 'inherit' }
  );

  console.log('Watching for changes...');

  process.on('SIGINT', () => {
    tw.kill();
    srv.kill();
    process.exit(0);
  });
} else {
  // Build mode
  execSync('./node_modules/.bin/tailwindcss -i src/client/style.css -o dist/client.css --minify', {
    stdio: 'inherit',
    shell: true,
  });
  await esbuild.build(serverOptions);
  await esbuild.build(clientOptions);
  console.log('Build complete.');
}
