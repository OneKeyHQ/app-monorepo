import type { INativeAppStorageRepairSummary } from './nativeStorageTypes';

export const NATIVE_STORAGE_RECOVERY_TEST_SCENARIOS = [
  'success',
  'partialFailure',
  'allFailed',
  'incompleteScan',
  'syncFailure',
  'expiredAttempt',
] as const;

export type INativeStorageRecoveryTestScenario =
  (typeof NATIVE_STORAGE_RECOVERY_TEST_SCENARIOS)[number];

export type INativeStorageRecoveryTestRequest =
  | { action: 'create'; scenario: INativeStorageRecoveryTestScenario }
  | { action: 'inspect' }
  | { action: 'clear' }
  | { action: 'prepare'; sessionId: string }
  | { action: 'verify'; sessionId: string }
  | { action: 'releaseFault'; sessionId: string }
  | { action: 'read'; sessionId: string }
  | {
      action: 'complete';
      sessionId: string;
      repairId: string;
      force: boolean;
    };

export type INativeStorageRecoveryTestSnapshot = {
  sessionId?: string;
  scenario?: INativeStorageRecoveryTestScenario;
  faultActive: boolean;
  markerComplete: boolean;
  newDataPersisted: boolean;
  legacyRetained: boolean;
  summary?: INativeAppStorageRepairSummary;
  rows: Array<{ key: string; legacy: string | null; mmkv: string | null }>;
  verification?: {
    passed: boolean;
    successfulKeysReadable: boolean;
    failedKeysAbsent: boolean;
    newDataWritable: boolean;
    expectedSuccessfulCount: number;
    expectedFailedCount: number;
  };
};

export type INativeStorageRecoveryTestResult = {
  snapshot: INativeStorageRecoveryTestSnapshot;
  summary?: INativeAppStorageRepairSummary;
};
