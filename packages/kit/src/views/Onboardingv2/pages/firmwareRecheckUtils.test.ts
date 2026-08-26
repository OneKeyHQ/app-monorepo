import { createFirmwareRecheckTimer } from './firmwareRecheckUtils';

describe('createFirmwareRecheckTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('fires after the remaining post-update delay', () => {
    const onFire = jest.fn();
    createFirmwareRecheckTimer({
      finishTime: 10_000,
      delayMs: 10_000,
      now: () => 15_000,
      onFire,
    });

    jest.advanceTimersByTime(4999);
    expect(onFire).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending recheck so Skip cannot be overwritten', () => {
    const onFire = jest.fn();
    const cancel = createFirmwareRecheckTimer({
      finishTime: 0,
      delayMs: 10_000,
      now: () => 0,
      onFire,
    });

    cancel();
    jest.advanceTimersByTime(10_000);
    expect(onFire).not.toHaveBeenCalled();
  });

  it('reschedules a canceled recheck from the original finish time', () => {
    const onFire = jest.fn();
    let now = 12_000;
    const cancel = createFirmwareRecheckTimer({
      finishTime: 10_000,
      delayMs: 10_000,
      now: () => now,
      onFire,
    });

    cancel();
    now = 15_000;
    createFirmwareRecheckTimer({
      finishTime: 10_000,
      delayMs: 10_000,
      now: () => now,
      onFire,
    });

    jest.advanceTimersByTime(4999);
    expect(onFire).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('caps the delay when the system clock moves backwards', () => {
    const onFire = jest.fn();
    createFirmwareRecheckTimer({
      finishTime: 20_000,
      delayMs: 10_000,
      now: () => 5000,
      onFire,
    });

    jest.advanceTimersByTime(9999);
    expect(onFire).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('does not fire more than once', () => {
    const onFire = jest.fn();
    createFirmwareRecheckTimer({
      finishTime: 0,
      delayMs: 0,
      now: () => 0,
      onFire,
    });

    jest.runOnlyPendingTimers();
    jest.runOnlyPendingTimers();
    expect(onFire).toHaveBeenCalledTimes(1);
  });
});
