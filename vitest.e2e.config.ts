import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'e2e',
    include: ['test/e2e/**/*.spec.ts', 'test/e2e/**/*.test.ts'],
    testTimeout: 180_000,
    hookTimeout: 300_000,
    fileParallelism: false,
    sequence: {
      groupOrder: 1,
    },
  },
})
