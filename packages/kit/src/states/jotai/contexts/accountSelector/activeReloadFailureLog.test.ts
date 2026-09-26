import {
  buildActiveReloadFailureKey,
  resetActiveReloadFailureLogForTest,
  takeActiveReloadFailureLogSlot,
  takeActiveReloadRecoveryLogSlot,
} from './activeReloadFailureLog';

const homeGateKey = buildActiveReloadFailureKey({
  num: 0,
  phase: 'transfer-gate',
  sceneName: 'home',
});

describe('active reload failure log', () => {
  beforeEach(() => {
    resetActiveReloadFailureLogForTest();
  });

  it('logs the first failure of a run and suppresses the repeats', () => {
    expect(
      takeActiveReloadFailureLogSlot({
        errorName: 'TimeoutError',
        key: homeGateKey,
      }),
    ).toEqual({ consecutiveFailures: 1, previousFailures: undefined });
    expect(
      takeActiveReloadFailureLogSlot({
        errorName: 'TimeoutError',
        key: homeGateKey,
      }),
    ).toBeUndefined();
    expect(
      takeActiveReloadFailureLogSlot({
        errorName: 'TimeoutError',
        key: homeGateKey,
      }),
    ).toBeUndefined();
  });

  it('logs again when the cause changes mid-run and carries the suppressed count', () => {
    takeActiveReloadFailureLogSlot({
      errorName: 'TimeoutError',
      key: homeGateKey,
    });
    takeActiveReloadFailureLogSlot({
      errorName: 'TimeoutError',
      key: homeGateKey,
    });

    expect(
      takeActiveReloadFailureLogSlot({
        errorName: 'OneKeyLocalError',
        key: homeGateKey,
      }),
    ).toEqual({ consecutiveFailures: 1, previousFailures: 2 });
  });

  it('treats a missing error name as a cause of its own', () => {
    expect(
      takeActiveReloadFailureLogSlot({
        errorName: undefined,
        key: homeGateKey,
      }),
    ).toEqual({ consecutiveFailures: 1, previousFailures: undefined });
    expect(
      takeActiveReloadFailureLogSlot({
        errorName: undefined,
        key: homeGateKey,
      }),
    ).toBeUndefined();
  });

  it('reports every suppressed retry on the recovery that ends the run', () => {
    takeActiveReloadFailureLogSlot({
      errorName: 'TimeoutError',
      key: homeGateKey,
    });
    takeActiveReloadFailureLogSlot({
      errorName: 'TimeoutError',
      key: homeGateKey,
    });
    takeActiveReloadFailureLogSlot({
      errorName: 'TimeoutError',
      key: homeGateKey,
    });

    expect(takeActiveReloadRecoveryLogSlot(homeGateKey)).toBe(3);
  });

  it('stays silent on the success path when nothing had failed', () => {
    expect(takeActiveReloadRecoveryLogSlot(homeGateKey)).toBeUndefined();
  });

  it('does not report the same recovery twice', () => {
    takeActiveReloadFailureLogSlot({
      errorName: 'TimeoutError',
      key: homeGateKey,
    });

    expect(takeActiveReloadRecoveryLogSlot(homeGateKey)).toBe(1);
    expect(takeActiveReloadRecoveryLogSlot(homeGateKey)).toBeUndefined();
  });

  it('opens a new run after a recovery', () => {
    takeActiveReloadFailureLogSlot({
      errorName: 'TimeoutError',
      key: homeGateKey,
    });
    takeActiveReloadRecoveryLogSlot(homeGateKey);

    expect(
      takeActiveReloadFailureLogSlot({
        errorName: 'TimeoutError',
        key: homeGateKey,
      }),
    ).toEqual({ consecutiveFailures: 1, previousFailures: undefined });
  });

  it('tracks scene, num and phase independently', () => {
    const keys = [
      homeGateKey,
      buildActiveReloadFailureKey({
        num: 0,
        phase: 'reload-action',
        sceneName: 'home',
      }),
      buildActiveReloadFailureKey({
        num: 1,
        phase: 'transfer-gate',
        sceneName: 'home',
      }),
      buildActiveReloadFailureKey({
        num: 0,
        phase: 'transfer-gate',
        sceneName: 'swap',
      }),
    ];

    for (const key of keys) {
      expect(
        takeActiveReloadFailureLogSlot({ errorName: 'TimeoutError', key }),
      ).toEqual({ consecutiveFailures: 1, previousFailures: undefined });
    }
    // A recovery on one key must not clear a run still open on another.
    expect(takeActiveReloadRecoveryLogSlot(homeGateKey)).toBe(1);
    for (const key of keys.slice(1)) {
      expect(
        takeActiveReloadFailureLogSlot({ errorName: 'TimeoutError', key }),
      ).toBeUndefined();
    }
  });

  it('keys an unknown scene without colliding with a named one', () => {
    const unknownSceneKey = buildActiveReloadFailureKey({
      num: 0,
      phase: 'transfer-gate',
      sceneName: undefined,
    });

    expect(unknownSceneKey).not.toBe(homeGateKey);
    takeActiveReloadFailureLogSlot({
      errorName: 'TimeoutError',
      key: unknownSceneKey,
    });
    expect(takeActiveReloadRecoveryLogSlot(homeGateKey)).toBeUndefined();
  });
});
