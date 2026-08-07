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
  // Needed by appEventBus, which the isolated-module test pulls in through
  // storageChecker's own imports.
  ERuntimeRole: {
    Main: 'main',
    Background: 'background',
    Standalone: 'standalone',
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

    it('matches a standard DOMException by name, not only by message', () => {
      // The spec-shaped quota failure: the type lives in `name`, while the
      // message is a generic sentence that never mentions the error type.
      storageChecker.handleDiskFullError(
        new DOMException('The quota has been exceeded.', 'QuotaExceededError'),
      );

      expect(globalThis.$onekeySystemDiskIsFull).toBe(true);
      expect(storageChecker.getLastDiagnostics()?.errorMessage).toBe(
        'QuotaExceededError: The quota has been exceeded.',
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
        storageChecker.isConnectionClosingError(
          new Error('QuotaExceededError'),
        ),
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

    it('holds a raised guard inside the hysteresis band instead of flapping', async () => {
      // 1.2 GB free: above the 0.936 GB raise threshold, below the ~1.87 GB
      // clear threshold. A raised guard must stay raised — the measurement
      // reruns every second under write load, and flipping here would emit a
      // dialog and a log line per flip.
      globalThis.$onekeySystemDiskIsFull = true;
      mockEstimate(40 * GB, 40 * GB - 1.2 * GB);

      await storageChecker.checkIfDiskIsFull();

      expect(globalThis.$onekeySystemDiskIsFull).toBe(true);
    });

    it('keeps a healthy guard clear inside the hysteresis band', async () => {
      mockEstimate(40 * GB, 40 * GB - 1.2 * GB);

      await storageChecker.checkIfDiskIsFull();

      expect(globalThis.$onekeySystemDiskIsFull).toBeUndefined();
    });

    it('can still clear on a quota smaller than the large-quota band', async () => {
      // Quota 1.5 GB: the fixed 2×-warning threshold (~1.87 GB) would exceed
      // the quota itself and latch the guard forever. The quota-aware band
      // clears at the midpoint (~1.22 GB), which freed-up space can reach.
      globalThis.$onekeySystemDiskIsFull = true;
      mockEstimate(1.5 * GB, 0.1 * GB);

      await storageChecker.checkIfDiskIsFull();

      expect(globalThis.$onekeySystemDiskIsFull).toBeUndefined();
    });

    it('schedules a re-measurement from a blocked write so the guard can self-clear', async () => {
      // Production path: a blocked write never reaches the IndexedDB shim that
      // normally schedules the measurement. Without the scheduler in the
      // raised branch, freeing space outside OneKey would never be observed.
      jest.useFakeTimers();
      try {
        // Fresh module instance: earlier tests already armed the module-level
        // debounce under real timers, and lodash keeps that (now replaced)
        // timer id, so a shared instance would never re-arm here.
        await jest.isolateModulesAsync(async () => {
          const freshChecker = (await import('./storageChecker')).default;
          globalThis.$onekeySystemDiskIsFull = true;
          mockEstimate(40 * GB, 10 * GB);

          // Matched by message, not constructor: the isolated module registry
          // has its own SystemDiskFullError class identity.
          expect(() => freshChecker.checkIfDiskIsFullSync()).toThrow(
            'System Disk is full',
          );

          // Async variant: flushes the microtasks of the debounced async
          // measurement between timer ticks.
          await jest.advanceTimersByTimeAsync(1100);

          expect(globalThis.$onekeySystemDiskIsFull).toBeUndefined();
        });
      } finally {
        jest.useRealTimers();
      }
    });

    it('never throws, so it can still run while the guard is raised', async () => {
      globalThis.$onekeySystemDiskIsFull = true;
      mockEstimate(40 * GB, 40 * GB);

      await expect(storageChecker.checkIfDiskIsFull()).resolves.toBeUndefined();
      expect(globalThis.$onekeySystemDiskIsFull).toBe(true);
    });
  });
});
