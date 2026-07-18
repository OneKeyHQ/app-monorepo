import resetUtils from '@onekeyhq/shared/src/utils/resetUtils';
import type { IInstanceMetaBackup } from '@onekeyhq/shared/types/desktop';

import dbBackupTools from './dbBackupTools';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktop: false,
    isExtension: true,
    isRuntimeBrowser: false,
  },
}));

const instanceMeta: IInstanceMetaBackup = {
  instanceId: 'instance-id',
  instanceIdBackup: {
    v4MigratedInstanceId: 'instance-id-backup',
    v5InitializedInstanceId: undefined,
  },
  sensitiveEncodeKey: 'sensitive-encode-key',
};

describe('dbBackupTools reset fence', () => {
  const originalChrome = globalThis.chrome;

  afterEach(() => {
    while (resetUtils.getIsResetting()) {
      resetUtils.endResetting();
    }
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: originalChrome,
      writable: true,
    });
  });

  it('keeps a pre-reset backup in the reset drain', async () => {
    let finishWrite: (() => void) | undefined;
    const storageWrite = new Promise<void>((resolve) => {
      finishWrite = resolve;
    });
    const set = jest.fn(() => storageWrite);
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: { storage: { local: { set } } },
      writable: true,
    });

    const backup = dbBackupTools.backupInstanceMeta(instanceMeta);
    resetUtils.startResetting();
    let drainSettled = false;
    const drain = resetUtils.waitForResetSensitiveTasksToSettle().then(() => {
      drainSettled = true;
    });
    await Promise.resolve();
    expect(drainSettled).toBe(false);

    finishWrite?.();
    await backup;
    await drain;
    expect(set).toHaveBeenCalledTimes(1);
  });

  it('rejects a new backup while reset owns the background runtime', async () => {
    const set = jest.fn();
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: { storage: { local: { set } } },
      writable: true,
    });
    resetUtils.startResetting();

    await expect(
      dbBackupTools.backupInstanceMeta(instanceMeta),
    ).rejects.toThrow('Cannot perform operation while resetting');
    expect(set).not.toHaveBeenCalled();
  });
});
