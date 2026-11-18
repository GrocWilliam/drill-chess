export default {
  test: { include: ['tests/acceptance/us-86/*.test.ts'], environment: 'node', testTimeout: 60000, hookTimeout: 120000, fileParallelism: false },
};
