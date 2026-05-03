/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/dist/__tests__/**/*.test.js'],
  collectCoverageFrom: ['dist/src/**/*.js', '!dist/src/server.js'],
  clearMocks: true,
  restoreMocks: true,
  testTimeout: 10_000,
};
