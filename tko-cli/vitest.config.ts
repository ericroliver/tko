import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'lcov', 'html'],
      all: true,
      thresholds: { lines: 54, statements: 54, branches: 65, functions: 66 },
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/index.ts'],
    },
  },
  resolve: {
    alias: {
      '@modelcontextprotocol/sdk/client/index.js': '@modelcontextprotocol/sdk/client/index.js',
      '@modelcontextprotocol/sdk/client/streamable.js':
        '@modelcontextprotocol/sdk/client/streamable.js',
      '@modelcontextprotocol/sdk/types.js': '@modelcontextprotocol/sdk/types.js',
    },
  },
});
