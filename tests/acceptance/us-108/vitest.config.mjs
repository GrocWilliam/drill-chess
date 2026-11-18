export default {
  test: { include: ['tests/acceptance/us-108/*.test.ts'], environment: 'node', testTimeout: 120000, hookTimeout: 120000, fileParallelism: false },
};
