import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      'bun:sqlite': resolve(__dirname, 'src/test-utils/bun-sqlite-shim.ts'),
    },
  },
  test: {
    environment: 'node',
  },
});
