import { OneKeyLocalError, SystemDiskFullError } from '../errors';
import { EAppEventBusNames, appEventBus } from '../eventBus/appEventBus';
import storageChecker from '../storageChecker/storageChecker';
import resetUtils from '../utils/resetUtils';

import WebStorage from './WebStorage';

describe('WebStorage.checkDiskFull', () => {
  const callCheckDiskFull = (payload?: {
    method: string;
    key?: string;
    itemCount?: number;
  }) => WebStorage.prototype.checkDiskFull.call({} as WebStorage, payload);

  beforeEach(() => {
    globalThis.$onekeySystemDiskIsFull = undefined;
    resetUtils.endResetting();
  });

  afterEach(() => {
    globalThis.$onekeySystemDiskIsFull = undefined;
    resetUtils.endResetting();
    jest.restoreAllMocks();
  });

  it('skips disk-full precheck while resetting', () => {
    resetUtils.startResetting();
    globalThis.$onekeySystemDiskIsFull = true;
    const emitSpy = jest.spyOn(appEventBus, 'emit');

    expect(() =>
      callCheckDiskFull({
        method: 'setItem',
      }),
    ).not.toThrow();
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('keeps original warning + throw behavior when not resetting', () => {
    globalThis.$onekeySystemDiskIsFull = true;
    const emitSpy = jest.spyOn(appEventBus, 'emit');

    expect(() =>
      callCheckDiskFull({
        method: 'setItem',
      }),
    ).toThrow(SystemDiskFullError);
    expect(emitSpy).toHaveBeenCalledWith(
      EAppEventBusNames.ShowSystemDiskFullWarning,
      undefined,
    );
  });

  it('retries initialization after a failed open instead of hanging forever', async () => {
    // A full backing store fails `open()` at startup. The old
    // `new Promise(async (resolve) => ...)` had no rejection path, so the
    // promise never settled and every later read and write waited forever —
    // freeing space could not reach the reopening logic.
    const initIndexed = jest
      .fn()
      .mockRejectedValueOnce(new OneKeyLocalError('open failed'))
      .mockResolvedValue('indexed-instance');
    const storage = { initIndexed } as unknown as WebStorage;
    const getIndexed = () =>
      (
        WebStorage.prototype as unknown as {
          getIndexed: (this: WebStorage) => Promise<unknown>;
        }
      ).getIndexed.call(storage);

    await expect(getIndexed()).rejects.toThrow('open failed');
    // The cached rejected promise must have been dropped, so the next call
    // actually retries rather than replaying the failure.
    await expect(getIndexed()).resolves.toBe('indexed-instance');
    expect(initIndexed).toHaveBeenCalledTimes(2);
  });

  it('delegates to storageChecker so a blocked write schedules a re-measurement', () => {
    // The shared guard is what schedules the debounced quota re-measurement.
    // Re-implementing the throw here would leave the main app-storage write
    // path unable to ever observe the user freeing space.
    globalThis.$onekeySystemDiskIsFull = true;
    const guardSpy = jest.spyOn(storageChecker, 'checkIfDiskIsFullSync');

    expect(() => callCheckDiskFull({ method: 'setItem' })).toThrow(
      SystemDiskFullError,
    );
    expect(guardSpy).toHaveBeenCalled();
  });
});
