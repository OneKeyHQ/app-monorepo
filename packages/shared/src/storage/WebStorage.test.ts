import { SystemDiskFullError } from '../errors';
import { EAppEventBusNames, appEventBus } from '../eventBus/appEventBus';
import storageChecker from '../storageChecker/storageChecker';
import resetUtils from '../utils/resetUtils';

import WebStorage from './WebStorage';

describe('WebStorage.checkDiskFull', () => {
  const callCheckDiskFull = (payload?: unknown) =>
    WebStorage.prototype.checkDiskFull.call({} as WebStorage, payload);

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
