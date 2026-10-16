import { createMMKV } from 'react-native-mmkv';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { getLegacyAsyncStorageForMigration } from '@onekeyhq/shared/src/storage/legacyAsyncStorageMigration';
import type { ILegacyAsyncStorageNativeModule } from '@onekeyhq/shared/src/storage/legacyAsyncStorageMigration';
import {
  type IMMKVInstance,
  createNativeAppStorageRepairController,
} from '@onekeyhq/shared/src/storage/nativeStorageExecutor';
import {
  type INativeStorageRecoveryTestRequest,
  type INativeStorageRecoveryTestResult,
  type INativeStorageRecoveryTestScenario,
  type INativeStorageRecoveryTestSnapshot,
  NATIVE_STORAGE_RECOVERY_TEST_SCENARIOS,
} from '@onekeyhq/shared/src/storage/nativeStorageRecoveryTestTypes';
import {
  type INativeAppStorageRepairSummary,
  createNativeStorageMigrationInconsistentErrorMessage,
} from '@onekeyhq/shared/src/storage/nativeStorageTypes';

const LEGACY_PREFIX = '$$test_native_storage_recovery/';
const KEYS = ['test:01-current', 'test:02-failure', 'test:03-after-failure'];
const LEGACY_VALUES = ['legacy-old', 'legacy-two', 'legacy-three'];
const CURRENT_VALUE = 'current-latest';
const MARKER = '__onekey_internal_app_storage_migration_v1__';
const PROBE = 'test:post-repair';
const PROBE_VALUE = 'new-sandbox-data';
const target = createMMKV({ id: 'onekey-dev-storage-recovery-target-v1' });
const control = createMMKV({ id: 'onekey-dev-storage-recovery-control-v1' });
let controller:
  | ReturnType<typeof createNativeAppStorageRepairController>
  | undefined;
let queue: Promise<unknown> = Promise.resolve();

function readScenario(): INativeStorageRecoveryTestScenario | undefined {
  const value = control.getString('scenario');
  return NATIVE_STORAGE_RECOVERY_TEST_SCENARIOS.find(
    (scenario) => scenario === value,
  );
}

function fail(message: string): never {
  throw new OneKeyLocalError(`Storage recovery test: ${message}`);
}

function assertSession(sessionId: string) {
  if (!sessionId || sessionId !== control.getString('sessionId')) {
    fail('session expired. Create a new scenario.');
  }
}

function assertLogicalKeys(keys: string[]) {
  for (const key of keys) {
    if (
      !KEYS.includes(key) &&
      key !== 'simple_db_v5:addressBookItems' &&
      key !== 'simple_db_v5:localHistory'
    ) {
      fail('unknown synthetic key');
    }
  }
}

function log(message: string) {
  const { NativeLogger, LogLevel } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger') as typeof import('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger');
  NativeLogger.write(LogLevel.Info, `[NativeStorageRecoveryTest] ${message}`);
}

function getController() {
  if (controller) return controller;
  const legacy: ILegacyAsyncStorageNativeModule = {
    async getAllKeys() {
      if (
        readScenario() === 'incompleteScan' &&
        control.getBoolean('faultActive')
      )
        fail('injected enumeration failure');
      return [...KEYS];
    },
    async multiGet(keys) {
      assertLogicalKeys(keys);
      if (control.getBoolean('faultActive')) {
        const scenario = readScenario();
        if (
          keys.some(
            (key) =>
              KEYS.includes(key) &&
              (scenario === 'allFailed' ||
                (scenario === 'partialFailure' && key === KEYS[1])),
          )
        ) {
          fail('injected legacy record read failure');
        }
      }
      const stored = await getLegacyAsyncStorageForMigration().multiGet(
        keys.map((key) => LEGACY_PREFIX + key),
      );
      return stored.map(([key, value]) => [
        key.slice(LEGACY_PREFIX.length),
        value,
      ]);
    },
    async multiSet() {
      fail('repair must never write legacy data');
    },
    async multiRemove() {
      fail('repair must never delete legacy data');
    },
    async reloadManifest() {},
  };
  controller = createNativeAppStorageRepairController({
    getMMKV: () => target as IMMKVInstance,
    getLedger: async () => control.getString('ledger') ?? null,
    getLegacy: () => legacy,
    reload: async () => target.trim(),
    sync: async () => {
      if (readScenario() === 'syncFailure' && control.getBoolean('faultActive'))
        fail('injected sync failure');
      // Exercise sandbox MMKV without invoking production native instance APIs.
      target.trim();
    },
    recoverJournal: async () => {},
    completeLedger: async () => {
      control.set('ledger', 'complete-v1');
    },
    log,
    logFiles: async () => {},
    onPrepare: () => {},
    onComplete: () => {},
    clearPendingRecovery: () => {},
  });
  return controller;
}

function readSummary(): INativeAppStorageRepairSummary | undefined {
  const value = control.getString('summary');
  return value
    ? (JSON.parse(value) as INativeAppStorageRepairSummary)
    : undefined;
}

function readTestValue(key: string) {
  if (target.getString(MARKER) !== '1') {
    throw new OneKeyLocalError(
      createNativeStorageMigrationInconsistentErrorMessage('appStorage'),
    );
  }
  return target.getString(`app:${key}`);
}

async function snapshot(): Promise<INativeStorageRecoveryTestSnapshot> {
  target.trim();
  const stored = await getLegacyAsyncStorageForMigration().multiGet(
    KEYS.map((key) => LEGACY_PREFIX + key),
  );
  const active = Boolean(control.getString('sessionId'));
  return {
    sessionId: control.getString('sessionId'),
    scenario: readScenario(),
    faultActive: control.getBoolean('faultActive') ?? false,
    markerComplete: target.getString(MARKER) === '1',
    newDataPersisted: target.getString(`app:${PROBE}`) === PROBE_VALUE,
    legacyRetained:
      active &&
      stored.every(([, value], index) => value === LEGACY_VALUES[index]),
    summary: readSummary(),
    rows: KEYS.map((key, index) => ({
      key,
      legacy: stored[index]?.[1] ?? null,
      mmkv: target.getString(`app:${key}`) ?? null,
    })),
  };
}

async function verify(): Promise<INativeStorageRecoveryTestSnapshot> {
  const result = await snapshot();
  const summary = result.summary;
  const expected = KEYS.filter((key, index) => {
    if (!result.faultActive) return true;
    if (result.scenario === 'allFailed') return false;
    if (result.scenario === 'partialFailure') return key !== KEYS[1];
    if (result.scenario === 'incompleteScan') return index === 0;
    return true;
  });
  const successfulKeysReadable =
    summary?.successfulCount === expected.length &&
    result.rows.every(
      (row, index) =>
        !expected.includes(row.key) ||
        row.mmkv ===
          (index === 0 && result.scenario !== 'allFailed'
            ? CURRENT_VALUE
            : LEGACY_VALUES[index]),
    );
  const failedKeysAbsent = result.rows
    .filter((row) => !expected.includes(row.key))
    .every((row) => row.mmkv === null);
  let newDataWritable = false;
  if (result.markerComplete && control.getString('ledger') === 'complete-v1') {
    target.set(`app:${PROBE}`, PROBE_VALUE);
    target.trim();
    newDataWritable = readTestValue(PROBE) === PROBE_VALUE;
    target.remove(`app:${PROBE}`);
    target.trim();
    newDataWritable = newDataWritable && readTestValue(PROBE) === undefined;
    target.set(`app:${PROBE}`, PROBE_VALUE);
  }
  result.verification = {
    passed:
      result.markerComplete &&
      result.legacyRetained &&
      successfulKeysReadable &&
      failedKeysAbsent &&
      newDataWritable,
    successfulKeysReadable,
    failedKeysAbsent,
    newDataWritable,
    expectedSuccessfulCount: expected.length,
    expectedFailedCount: KEYS.length - expected.length,
  };
  return result;
}

async function execute(
  request: INativeStorageRecoveryTestRequest,
): Promise<INativeStorageRecoveryTestResult> {
  if (request.action === 'inspect') return { snapshot: await snapshot() };
  if (request.action === 'clear' || request.action === 'create') {
    if (
      request.action === 'create' &&
      !NATIVE_STORAGE_RECOVERY_TEST_SCENARIOS.includes(request.scenario)
    )
      fail('unknown scenario');
    controller = undefined;
    target.clearAll();
    control.clearAll();
    const legacy = getLegacyAsyncStorageForMigration();
    // This explicit reset is limited to our three synthetic legacy keys.
    await legacy.multiRemove(KEYS.map((key) => LEGACY_PREFIX + key));
    if (request.action === 'create') {
      await legacy.multiSet(
        KEYS.map((key, index) => [LEGACY_PREFIX + key, LEGACY_VALUES[index]]),
      );
      control.set('scenario', request.scenario);
      control.set(
        'sessionId',
        `storage-repair-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      );
      control.set('faultActive', true);
      control.set('ledger', 'complete-v1');
      if (request.scenario !== 'allFailed')
        target.set(`app:${KEYS[0]}`, CURRENT_VALUE);
      log(
        `phase=created scenario=${request.scenario} marker=missing syntheticKeyCount=3`,
      );
    }
    return { snapshot: await snapshot() };
  }
  assertSession(request.sessionId);
  switch (request.action) {
    case 'prepare': {
      if (target.getString(MARKER) === '1')
        fail('repair already complete. Create a new scenario.');
      const summary = await getController().prepare();
      control.set('summary', JSON.stringify(summary));
      if (
        readScenario() === 'expiredAttempt' &&
        control.getBoolean('faultActive')
      ) {
        controller = undefined;
        control.set('faultActive', false);
      }
      return { summary, snapshot: await snapshot() };
    }
    case 'complete':
      await getController().complete(request.repairId, request.force);
      return { snapshot: await snapshot() };
    case 'releaseFault':
      control.set('faultActive', false);
      return { snapshot: await snapshot() };
    case 'read':
      readTestValue(KEYS[0]);
      return { snapshot: await snapshot() };
    case 'verify':
      return { snapshot: await verify() };
    default: {
      const exhaustive: never = request;
      throw new OneKeyLocalError(
        `Unknown storage recovery test request: ${String(exhaustive)}`,
      );
    }
  }
}

export function runNativeStorageRecoveryTest(
  request: INativeStorageRecoveryTestRequest,
) {
  const result = queue.then(() => execute(request));
  queue = result.catch(() => undefined);
  return result;
}
