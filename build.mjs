import * as esbuild from 'esbuild';
import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync, readFileSync } from 'fs';

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'));

const watch = process.argv.includes('--watch');

if (!existsSync('dist')) mkdirSync('dist');

const serverOptions = {
  entryPoints: ['src/server/index.ts'],
  outfile: 'dist/server.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  target: 'node20',
};

const clientOptions = {
  entryPoints: ['src/client/index.ts'],
  outfile: 'dist/client.js',
  bundle: true,
  platform: 'browser',
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
    'npx',
    ['tailwindcss', '-i', 'src/client/style.css', '-o', 'dist/client.css', '--watch'],
    { stdio: 'inherit', shell: true }
  );

  // Run server with --watch
  const srv = spawn(
    'node',
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
  execSync('npx tailwindcss -i src/client/style.css -o dist/client.css --minify', {
    stdio: 'inherit',
    shell: true,
  });
  await esbuild.build(serverOptions);
  await esbuild.build(clientOptions);
  console.log('Build complete.');
}
