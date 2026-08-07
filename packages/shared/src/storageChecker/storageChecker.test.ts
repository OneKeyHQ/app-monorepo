import { SystemDiskFullError } from '../errors';
import resetUtils from '../utils/resetUtils';

import storageChecker from './storageChecker';
import { EStorageFullReason } from './types';

jest.mock('../platformEnv', () => ({
  __esModule: true,
  default: {
    isWebDappMode: false,
    isExtension: true,
    isDesktop: false,
  },
}));

const GB = 1024 * 1024 * 1024;

function mockEstimate(quotaBytes: number, usageBytes: number) {
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      storage: {
        estimate: jest.fn().mockResolvedValue({
          quota: quotaBytes,
          usage: usageBytes,
        }),
      },
    },
    configurable: true,
    writable: true,
  });
}

describe('storageChecker', () => {
  beforeEach(() => {
    globalThis.$onekeySystemDiskIsFull = undefined;
    resetUtils.endResetting();
  });

  afterEach(() => {
    globalThis.$onekeySystemDiskIsFull = undefined;
    resetUtils.endResetting();
    jest.restoreAllMocks();
  });

  describe('handleDiskFullError', () => {
    it('does not treat a closing IndexedDB connection as a full disk', () => {
      storageChecker.handleDiskFullError(
        new Error(
          `Failed to execute 'transaction' on 'IDBDatabase': The database connection is closing`,
        ),
      );

      expect(globalThis.$onekeySystemDiskIsFull).toBeUndefined();
      expect(storageChecker.getLastDiagnostics()).toBeUndefined();
    });

    it('still raises the guard on a genuine quota failure', () => {
      storageChecker.handleDiskFullError(
        new Error('QuotaExceededError: Encountered full disk'),
      );

      expect(globalThis.$onekeySystemDiskIsFull).toBe(true);
      expect(storageChecker.getLastDiagnostics()?.reason).toBe(
        EStorageFullReason.WriteFailed,
      );
    });
  });

  describe('isConnectionClosingError', () => {
    it('recognizes a dead cached connection handle', () => {
      expect(
        storageChecker.isConnectionClosingError(
          new Error(
            `Failed to execute 'transaction' on 'IDBDatabase': The database connection is closing`,
          ),
        ),
      ).toBe(true);
      expect(
        storageChecker.isConnectionClosingError(new Error('QuotaExceededError')),
      ).toBe(false);
    });
  });

  describe('checkIfDiskIsFullSync', () => {
    it('throws while the guard is raised', () => {
      globalThis.$onekeySystemDiskIsFull = true;
      expect(() => storageChecker.checkIfDiskIsFullSync()).toThrow(
        SystemDiskFullError,
      );
    });

    it('stays out of the way during an app reset', () => {
      globalThis.$onekeySystemDiskIsFull = true;
      resetUtils.startResetting();
      expect(() => storageChecker.checkIfDiskIsFullSync()).not.toThrow();
    });
  });

  describe('checkIfDiskIsFull', () => {
    it('raises the guard when measured headroom is below the threshold', async () => {
      mockEstimate(40 * GB, 40 * GB - 0.5 * GB);

      await storageChecker.checkIfDiskIsFull();

      expect(globalThis.$onekeySystemDiskIsFull).toBe(true);
      const diagnostics = storageChecker.getLastDiagnostics();
      expect(diagnostics?.reason).toBe(EStorageFullReason.QuotaExhausted);
      expect(diagnostics?.quotaInfo?.availableBytes).toBe(0.5 * GB);
    });

    it('releases a previously raised guard once headroom recovers', async () => {
      globalThis.$onekeySystemDiskIsFull = true;
      mockEstimate(40 * GB, 10 * GB);

      await storageChecker.checkIfDiskIsFull();

      expect(globalThis.$onekeySystemDiskIsFull).toBeUndefined();
      expect(storageChecker.getLastDiagnostics()).toBeUndefined();
    });

    it('never throws, so it can still run while the guard is raised', async () => {
      globalThis.$onekeySystemDiskIsFull = true;
      mockEstimate(40 * GB, 40 * GB);

      await expect(storageChecker.checkIfDiskIsFull()).resolves.toBeUndefined();
      expect(globalThis.$onekeySystemDiskIsFull).toBe(true);
    });
  });
});
