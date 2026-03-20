import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['cjs'],
  target: 'node22',
  clean: true,
  noExternal: [/.*/],
  banner: {
    js: '#!/usr/bin/env node',
  },
  splitting: false,
});
