import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    workspace: [
      {
        test: {
          name: 'unit',
          include: [
            'packages/*/src/**/*.test.ts',
            'packages/*/tests/**/*.test.ts',
            'server/src/**/*.test.ts',
            'tests/sync/**/*.test.ts',
            'tests/local-tree/**/*.test.ts',
          ],
        },
      },
      {
        test: {
          name: 'integration',
          include: [
            'tests/integration/**/*.test.ts',
            'server/tests/**/*.test.ts',
          ],
        },
      },
      {
        test: {
          name: 'agent-contract',
          include: [
            'tests/agent-contract/**/*.test.ts',
          ],
        },
      },
    ],
  },
});
