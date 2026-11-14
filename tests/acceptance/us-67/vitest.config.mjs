export default {
  test: { include: ['tests/acceptance/us-67/*.test.ts'], environment: 'node', testTimeout: 30000, hookTimeout: 120000 },
};
