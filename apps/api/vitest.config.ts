import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.test.ts',
        'src/index.ts',
      ],
    },
    testTimeout: 10000,
    // Automatically restore mocks after each test
    restoreMocks: true,
    // Clear mock call history after each test
    clearMocks: true,
  },
});
