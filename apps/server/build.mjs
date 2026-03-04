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
  entryPoints: ['src/http/app.ts'],
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

if (watch) {
  const serverCtx = await esbuild.context(serverOptions);
  await serverCtx.watch();

  // Run server with --watch
  const srv = spawn(
    'bun',
    ['--watch', 'dist/server.mjs'],
    { stdio: 'inherit' }
  );

  console.log('Watching for changes...');

  process.on('SIGINT', () => {
    srv.kill();
    process.exit(0);
  });
} else {
  await esbuild.build(serverOptions);
  console.log('Build complete.');
}
