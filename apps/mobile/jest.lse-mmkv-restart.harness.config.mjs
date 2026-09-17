import baseConfig, {
  LSE_MMKV_RESTART_TEST_PATH_PATTERN,
} from './jest.harness.config.mjs';

/** @type {import('jest').Config} */
export default {
  ...baseConfig,
  testMatch: [
    '**/e2e/local-secret-envelope-mmkv-restart.write.harness.ts',
    '**/e2e/local-secret-envelope-mmkv-restart.read.harness.ts',
  ],
  testPathIgnorePatterns: baseConfig.testPathIgnorePatterns.filter(
    (pattern) => pattern !== LSE_MMKV_RESTART_TEST_PATH_PATTERN,
  ),
  testSequencer: '<rootDir>/harness/lseMmkvRestartTestSequencer.cjs',
};
