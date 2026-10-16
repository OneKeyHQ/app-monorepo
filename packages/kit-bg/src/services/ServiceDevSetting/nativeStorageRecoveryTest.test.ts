import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { INativeStorageRecoveryTestScenario } from '@onekeyhq/shared/src/storage/nativeStorageRecoveryTestTypes';

import type { IDevSettingsPersistAtom } from '../../states/jotai/atoms/devSettings';

type IScalar = string | boolean | number;
class TestMMKV {
  constructor(readonly values: Map<string, IScalar>) {}
  getString(key: string) {
    const value = this.values.get(key);
    return typeof value === 'string' ? value : undefined;
  }
  getNumber(key: string) {
    const value = this.values.get(key);
    return typeof value === 'number' ? value : undefined;
  }
  getBoolean(key: string) {
    const value = this.values.get(key);
    return typeof value === 'boolean' ? value : undefined;
  }
  set(key: string, value: IScalar) {
    this.values.set(key, value);
  }
  remove(key: string) {
    this.values.delete(key);
  }
  clearAll() {
    this.values.clear();
  }
  getAllKeys() {
    return [...this.values.keys()];
  }
  trim() {}
}

const mockStores = new Map<string, Map<string, IScalar>>();
const mockLegacy = new Map<string, string>();
const mockLegacyCalls: string[][] = [];
let mockDevSettings: IDevSettingsPersistAtom;
jest.mock('../../states/jotai/atoms/devSettings', () => ({
  devSettingsPersistAtom: {
    get: async () => mockDevSettings,
    set: async (
      update: (previous: IDevSettingsPersistAtom) => IDevSettingsPersistAtom,
    ) => {
      mockDevSettings = update(mockDevSettings);
    },
  },
}));
const mockProductionNativeAccess = jest.fn((..._args: unknown[]) => {
  throw new OneKeyLocalError(
    'Production native storage must not be used by fixtures',
  );
});
const PREFIX = '$$test_native_storage_recovery/';
const TARGET = 'onekey-dev-storage-recovery-target-v1';
const CONTROL = 'onekey-dev-storage-recovery-control-v1';
const MARKER = '__onekey_internal_app_storage_migration_v1__';
const keys = ['test:01-current', 'test:02-failure', 'test:03-after-failure'];
function assertTestKeys(input: string[]) {
  if (input.some((key) => !key.startsWith(PREFIX)))
    throw new OneKeyLocalError('Fixture touched a real legacy key');
  mockLegacyCalls.push(input);
}

jest.mock('react-native-mmkv', () => ({
  createMMKV: ({ id }: { id: string }) => {
    if (![TARGET, CONTROL].includes(id))
      throw new OneKeyLocalError('Fixture opened a production MMKV');
    let values = mockStores.get(id);
    if (!values) {
      values = new Map<string, IScalar>();
      mockStores.set(id, values);
    }
    return new TestMMKV(values);
  },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeBackgroundThread: true },
}));
jest.mock('@onekeyhq/shared/src/travelMode', () => ({ travelModeManager: {} }));
jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: { wait: async () => undefined },
}));
jest.mock(
  '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger',
  () => ({ LogLevel: { Info: 'info' }, NativeLogger: { write: jest.fn() } }),
);
jest.mock('@onekeyhq/shared/src/storage/nativeStorageMigrationModule', () => ({
  NATIVE_STORAGE_MIGRATION_LEDGER_COMPLETE: 'complete-v1',
  getNativeStorageMigrationLedger: (...args: unknown[]) =>
    mockProductionNativeAccess(...args),
  setNativeStorageMigrationLedgerComplete: (...args: unknown[]) =>
    mockProductionNativeAccess(...args),
  syncNativeStorageMMKV: (...args: unknown[]) =>
    mockProductionNativeAccess(...args),
}));
jest.mock('@onekeyhq/shared/src/storage/legacyAsyncStorageMigration', () => ({
  getLegacyAsyncStorageForMigration: () => ({
    multiGet: async (input: string[]) => {
      assertTestKeys(input);
      return input.map((key) => [key, mockLegacy.get(key) ?? null]);
    },
    multiSet: async (entries: Array<[string, string]>) => {
      assertTestKeys(entries.map(([key]) => key));
      entries.forEach(([key, value]) => mockLegacy.set(key, value));
    },
    multiRemove: async (input: string[]) => {
      assertTestKeys(input);
      input.forEach((key) => mockLegacy.delete(key));
    },
  }),
}));

function load() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./nativeStorageRecoveryTest') as typeof import('./nativeStorageRecoveryTest');
}

describe('isolated native storage recovery scenarios', () => {
  beforeEach(() => {
    jest.resetModules();
    mockStores.clear();
    mockLegacy.clear();
    mockLegacy.set('unrelated-business-key', 'untouched');
    mockLegacyCalls.length = 0;
    mockProductionNativeAccess.mockClear();
    mockDevSettings = {
      enabled: true,
      settings: { enableTestEndpoint: false },
    };
  });

  it.each<INativeStorageRecoveryTestScenario>([
    'success',
    'partialFailure',
    'allFailed',
    'incompleteScan',
    'syncFailure',
    'expiredAttempt',
  ])(
    '%s survives restart, faults on Home, and clears only after repaired Home verification',
    async (scenario) => {
      let run = load().runNativeStorageRecoveryTest;
      const created = await run({ action: 'reproduce', scenario });
      const sessionId = created.snapshot.sessionId ?? '';
      expect(mockDevSettings.settings?.nativeStorageRecoveryTestOnHome).toBe(
        true,
      );
      expect(created.snapshot.homeFlowActive).toBe(true);
      jest.resetModules();
      run = load().runNativeStorageRecoveryTest;
      await expect(run({ action: 'homeRead' })).rejects.toMatchObject({
        autoToast: false,
        data: { nativeStorageRecoveryTestSessionId: sessionId },
        message: expect.stringContaining('migration marker is missing'),
      });
      let prepared = await run({ action: 'prepare', sessionId });
      const force =
        scenario === 'partialFailure' ||
        scenario === 'allFailed' ||
        scenario === 'incompleteScan';
      if (scenario === 'syncFailure' || scenario === 'expiredAttempt') {
        await expect(
          run({
            action: 'complete',
            sessionId,
            repairId: prepared.summary?.repairId ?? '',
            force,
          }),
        ).rejects.toThrow();
        if (scenario === 'syncFailure')
          await run({ action: 'releaseFault', sessionId });
        prepared = await run({ action: 'prepare', sessionId });
      }
      await run({
        action: 'complete',
        sessionId,
        repairId: prepared.summary?.repairId ?? '',
        force,
      });
      expect(mockDevSettings.settings?.nativeStorageRecoveryTestOnHome).toBe(
        true,
      );
      jest.resetModules();
      run = load().runNativeStorageRecoveryTest;
      const healthy = await run({ action: 'homeRead' });
      expect(healthy.snapshot).toMatchObject({
        markerComplete: true,
        homeFlowActive: false,
        homeReadPassed: true,
        legacyRetained: true,
        verification: { passed: true, newDataWritable: true },
      });
      expect(mockDevSettings.settings?.nativeStorageRecoveryTestOnHome).toBe(
        false,
      );
      expect(mockDevSettings.settings?.enableTestEndpoint).toBe(false);
      await expect(run({ action: 'homeRead' })).resolves.toBeDefined();
      expect(mockLegacy.get('unrelated-business-key')).toBe('untouched');
      expect(mockProductionNativeAccess).not.toHaveBeenCalled();
    },
  );

  it('clears the pending Home flow when test data is explicitly reset', async () => {
    const run = load().runNativeStorageRecoveryTest;
    await run({ action: 'reproduce', scenario: 'success' });
    await run({ action: 'clear' });
    expect(mockDevSettings.settings?.nativeStorageRecoveryTestOnHome).toBe(
      false,
    );
    await expect(run({ action: 'homeRead' })).resolves.toMatchObject({
      snapshot: { homeFlowActive: false },
    });
    expect(mockLegacy.get('unrelated-business-key')).toBe('untouched');
  });

  it.each<[INativeStorageRecoveryTestScenario, number, number, boolean]>([
    ['success', 3, 0, true],
    ['partialFailure', 2, 1, true],
    ['allFailed', 0, 3, true],
    ['incompleteScan', 1, 0, false],
    ['syncFailure', 3, 0, true],
    ['expiredAttempt', 3, 0, true],
  ])(
    '%s uses the production repair controller and preserves the legacy copy',
    async (scenario, successful, failed, scanComplete) => {
      const run = load().runNativeStorageRecoveryTest;
      const created = await run({ action: 'create', scenario });
      const sessionId = created.snapshot.sessionId ?? '';
      expect(created.snapshot.markerComplete).toBe(false);
      expect(created.snapshot.legacyRetained).toBe(true);
      await expect(run({ action: 'read', sessionId })).rejects.toThrow(
        'migration marker is missing',
      );
      let prepared = await run({ action: 'prepare', sessionId });
      expect(prepared.summary).toMatchObject({
        successfulCount: successful,
        failedCount: failed,
        scanComplete,
      });
      const force = failed > 0 || !scanComplete;
      if (force) {
        await expect(
          run({
            action: 'complete',
            sessionId,
            repairId: prepared.summary?.repairId ?? '',
            force: false,
          }),
        ).rejects.toThrow('explicit confirmation');
        expect((await run({ action: 'inspect' })).snapshot.markerComplete).toBe(
          false,
        );
      }
      if (scenario === 'syncFailure' || scenario === 'expiredAttempt') {
        await expect(
          run({
            action: 'complete',
            sessionId,
            repairId: prepared.summary?.repairId ?? '',
            force: false,
          }),
        ).rejects.toThrow(
          scenario === 'syncFailure'
            ? 'injected sync failure'
            : 'results expired',
        );
        expect(
          (await run({ action: 'verify', sessionId })).snapshot.verification
            ?.passed,
        ).toBe(false);
        await run({ action: 'releaseFault', sessionId });
        prepared = await run({ action: 'prepare', sessionId });
      }
      await run({
        action: 'complete',
        sessionId,
        repairId: prepared.summary?.repairId ?? '',
        force,
      });
      const verified = (await run({ action: 'verify', sessionId })).snapshot;
      expect(verified.verification).toMatchObject({
        passed: true,
        successfulKeysReadable: true,
        failedKeysAbsent: true,
        newDataWritable: true,
      });
      expect(verified.legacyRetained).toBe(true);
      expect(verified.rows[0].mmkv).toBe(
        scenario === 'allFailed' ? null : 'current-latest',
      );
      if (scenario === 'partialFailure')
        expect(verified.rows[2].mmkv).toBe('legacy-three');
      expect(mockLegacy.get('unrelated-business-key')).toBe('untouched');
      expect(mockProductionNativeAccess).not.toHaveBeenCalled();
      expect([...mockStores.keys()].toSorted()).toEqual(
        [CONTROL, TARGET].toSorted(),
      );
      expect(
        mockLegacyCalls.every((input) =>
          input.every((key) => key.startsWith(PREFIX)),
        ),
      ).toBe(true);

      jest.resetModules();
      const fresh = (
        await load().runNativeStorageRecoveryTest({ action: 'inspect' })
      ).snapshot;
      expect(fresh.markerComplete).toBe(true);
      expect(fresh.newDataPersisted).toBe(true);
      expect(fresh.legacyRetained).toBe(true);
    },
  );

  it('rejects stale sessions and clears only synthetic data', async () => {
    const run = load().runNativeStorageRecoveryTest;
    const first = await run({ action: 'create', scenario: 'partialFailure' });
    const second = await run({ action: 'create', scenario: 'success' });
    await expect(
      run({ action: 'prepare', sessionId: first.snapshot.sessionId ?? '' }),
    ).rejects.toThrow('session expired');
    expect((await run({ action: 'inspect' })).snapshot.sessionId).toBe(
      second.snapshot.sessionId,
    );
    await run({ action: 'clear' });
    expect(mockLegacy.size).toBe(1);
    expect(mockLegacy.get('unrelated-business-key')).toBe('untouched');
    expect(mockStores.get(TARGET)?.size).toBe(0);
    expect(mockStores.get(CONTROL)?.size).toBe(0);
  });

  it('does not report PASS for wrong copied values or an unexpected failed key', async () => {
    const run = load().runNativeStorageRecoveryTest;
    const created = await run({ action: 'create', scenario: 'partialFailure' });
    const sessionId = created.snapshot.sessionId ?? '';
    const prepared = await run({ action: 'prepare', sessionId });
    await run({
      action: 'complete',
      sessionId,
      repairId: prepared.summary?.repairId ?? '',
      force: true,
    });
    const values = mockStores.get(TARGET);
    values?.set(`app:${keys[2]}`, 'wrong-value');
    values?.set(`app:${keys[1]}`, 'unexpected-value');
    expect(
      (await run({ action: 'verify', sessionId })).snapshot.verification,
    ).toMatchObject({
      passed: false,
      successfulKeysReadable: false,
      failedKeysAbsent: false,
    });
    expect(values?.get(MARKER)).toBe('1');
  });
});
