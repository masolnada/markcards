import * as esbuild from 'esbuild';
import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync } from 'fs';

const version = process.env.APP_VERSION
  ?? execSync('git log -1 --format=%cd-%h --date=format:%Y%m%d').toString().trim();

const watch = process.argv.includes('--watch');

if (!existsSync('dist')) mkdirSync('dist');

const clientOptions = {
  entryPoints: ['src/index.ts'],
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
  const clientCtx = await esbuild.context(clientOptions);
  await clientCtx.watch();

  const tw = spawn(
    './node_modules/.bin/tailwindcss',
    ['-i', 'src/style.css', '-o', 'dist/client.css', '--watch'],
    { stdio: 'inherit', shell: true }
  );

  console.log('Watching for changes...');

  process.on('SIGINT', () => {
    tw.kill();
    process.exit(0);
  });
} else {
  execSync('./node_modules/.bin/tailwindcss -i src/style.css -o dist/client.css --minify', {
    stdio: 'inherit',
    shell: true,
  });
  await esbuild.build(clientOptions);
  console.log('Build complete.');
}
