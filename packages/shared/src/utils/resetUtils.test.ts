import { OneKeyLocalError } from '../errors';

import resetUtils from './resetUtils';

describe('resetUtils.runWithResettingGuard', () => {
  afterEach(() => {
    while (resetUtils.getIsResetting()) {
      resetUtils.endResetting();
    }
  });

  it('keeps a runtime guarded until all reset and restart work settles', async () => {
    let finishRestart: (() => void) | undefined;
    const restartPending = new Promise<void>((resolve) => {
      finishRestart = resolve;
    });

    const resetTask = resetUtils.runWithResettingGuard(async () => {
      expect(resetUtils.getIsResetting()).toBe(true);
      await restartPending;
      expect(resetUtils.getIsResetting()).toBe(true);
    });

    expect(resetUtils.getIsResetting()).toBe(true);
    finishRestart?.();
    await resetTask;
    expect(resetUtils.getIsResetting()).toBe(false);
  });

  it('does not release an outer guard owned by the caller runtime', async () => {
    resetUtils.startResetting();
    const generation = resetUtils.getResetGeneration();

    await resetUtils.runWithResettingGuard(async () => {
      expect(resetUtils.getIsResetting()).toBe(true);
    });

    expect(resetUtils.getIsResetting()).toBe(true);
    expect(resetUtils.getResetGeneration()).toBe(generation);
  });

  it('keeps the guard active across overlapping reset tasks', async () => {
    let finishFirst: (() => void) | undefined;
    let finishSecond: (() => void) | undefined;
    const firstPending = new Promise<void>((resolve) => {
      finishFirst = resolve;
    });
    const secondPending = new Promise<void>((resolve) => {
      finishSecond = resolve;
    });

    const firstTask = resetUtils.runWithResettingGuard(() => firstPending);
    const secondTask = resetUtils.runWithResettingGuard(() => secondPending);

    finishFirst?.();
    await firstTask;
    expect(resetUtils.getIsResetting()).toBe(true);

    finishSecond?.();
    await secondTask;
    expect(resetUtils.getIsResetting()).toBe(false);
  });

  it('releases a locally owned guard when restart preparation throws', async () => {
    await expect(
      resetUtils.runWithResettingGuard(async () => {
        throw new OneKeyLocalError('restart failed');
      }),
    ).rejects.toThrow('restart failed');

    expect(resetUtils.getIsResetting()).toBe(false);
  });
});
