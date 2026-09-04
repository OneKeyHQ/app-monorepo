import { TravelModeTransitionController } from './TravelModeTransitionController';

import type { ITravelModeTransitionControllerDependencies } from './TravelModeTransitionController';

function buildDependencies() {
  const calls: string[] = [];
  let runtimeState: Awaited<
    ReturnType<ITravelModeTransitionControllerDependencies['getRuntimeState']>
  > = 'inactive';
  const dependencies: ITravelModeTransitionControllerDependencies = {
    authenticateToggle: jest.fn(async () => {
      calls.push('authenticate');
      return { password: 'encoded-password' };
    }),
    clearSensitiveCaches: jest.fn(() => calls.push('clear-caches')),
    getPersistedEnabled: jest.fn(async () => false),
    getPortableVerifyString: jest.fn(async () => {
      calls.push('get-verifier');
      return '|VS|portable';
    }),
    getRuntimeState: jest.fn(async () => runtimeState),
    markRestartFailed: jest.fn(() => {
      runtimeState = 'transition-recovery';
      calls.push('mark-recovery');
    }),
    persistTransition: jest.fn(async ({ enabled }) => {
      runtimeState = 'transition-recovery';
      calls.push(`persist-${enabled ? 'enabled' : 'disabled'}`);
    }),
    prepareRestart: jest.fn(async (profile) => {
      calls.push(`prepare-restart-${profile}`);
      return 7;
    }),
    restart: jest.fn(async (reason) => {
      calls.push(`restart-${reason}`);
    }),
    restartTimeoutMs: 50,
    setPushSuppressed: jest.fn(async (suppressed) => {
      calls.push(`push-${suppressed ? 'suppressed' : 'enabled'}`);
    }),
    verifyPassword: jest.fn(async () => {
      calls.push('verify');
    }),
    waitBeforeRestart: jest.fn(async () => {
      calls.push('wait-before-restart');
    }),
  };
  return {
    calls,
    dependencies,
    setRuntimeState: (
      state: Awaited<
        ReturnType<
          ITravelModeTransitionControllerDependencies['getRuntimeState']
        >
      >,
    ) => {
      runtimeState = state;
    },
  };
}

describe('TravelModeTransitionController', () => {
  it('owns the complete activation sequence and fails closed if restart returns', async () => {
    const { calls, dependencies } = buildDependencies();
    const controller = new TravelModeTransitionController(dependencies);

    await expect(controller.setEnabled(true)).rejects.toThrow('Unknown error');

    expect(dependencies.persistTransition).toHaveBeenCalledWith({
      enabled: true,
      verifyString: '|VS|portable',
    });
    expect(calls).toEqual([
      'authenticate',
      'verify',
      'get-verifier',
      'clear-caches',
      'push-suppressed',
      'persist-enabled',
      'wait-before-restart',
      'prepare-restart-travel-mode',
      'restart-travel-mode-enabled-epoch-7',
      'mark-recovery',
    ]);
  });

  it('does not prepare or dispatch restart before the loading window ends', async () => {
    const { dependencies } = buildDependencies();
    let releaseLoadingWindow: (() => void) | undefined;
    let signalLoadingWindowStarted: (() => void) | undefined;
    const loadingWindowStarted = new Promise<void>((resolve) => {
      signalLoadingWindowStarted = resolve;
    });
    jest.mocked(dependencies.waitBeforeRestart).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          signalLoadingWindowStarted?.();
          releaseLoadingWindow = resolve;
        }),
    );
    const controller = new TravelModeTransitionController(dependencies);

    const transition = controller.setEnabled(true);
    await loadingWindowStarted;

    expect(dependencies.prepareRestart).not.toHaveBeenCalled();
    expect(dependencies.restart).not.toHaveBeenCalled();

    releaseLoadingWindow?.();
    await expect(transition).rejects.toThrow('Unknown error');
    expect(dependencies.prepareRestart).toHaveBeenCalledTimes(1);
    expect(dependencies.restart).toHaveBeenCalledTimes(1);
  });

  it('serializes authorization through restart completion', async () => {
    const { dependencies } = buildDependencies();
    let releaseRestart: (() => void) | undefined;
    let signalRestartStarted: (() => void) | undefined;
    const restartStarted = new Promise<void>((resolve) => {
      signalRestartStarted = resolve;
    });
    jest.mocked(dependencies.restart).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          signalRestartStarted?.();
          releaseRestart = resolve;
        }),
    );
    const controller = new TravelModeTransitionController(dependencies);

    const first = controller.setEnabled(true);
    await restartStarted;
    const second = controller.setEnabled(false);
    await Promise.resolve();

    expect(dependencies.authenticateToggle).toHaveBeenCalledTimes(1);
    jest
      .mocked(dependencies.restart)
      .mockRejectedValueOnce(new Error('second restart failed'));
    releaseRestart?.();
    await expect(first).rejects.toThrow('Unknown error');
    await expect(second).rejects.toThrow('second restart failed');
    expect(dependencies.authenticateToggle).toHaveBeenCalledTimes(2);
  });

  it('restores push delivery after an activation fails before commit', async () => {
    const { dependencies, setRuntimeState } = buildDependencies();
    jest
      .mocked(dependencies.persistTransition)
      .mockRejectedValueOnce(new Error('persist failed'));
    setRuntimeState('inactive');
    const controller = new TravelModeTransitionController(dependencies);

    await expect(controller.setEnabled(true)).rejects.toThrow('persist failed');

    expect(dependencies.setPushSuppressed).toHaveBeenNthCalledWith(1, true);
    expect(dependencies.setPushSuppressed).toHaveBeenNthCalledWith(2, false);
    expect(dependencies.restart).not.toHaveBeenCalled();
  });

  it('restores push delivery when the suppression request itself fails', async () => {
    const { dependencies, setRuntimeState } = buildDependencies();
    jest
      .mocked(dependencies.setPushSuppressed)
      .mockRejectedValueOnce(new Error('push suppression failed'));
    setRuntimeState('inactive');
    const controller = new TravelModeTransitionController(dependencies);

    await expect(controller.setEnabled(true)).rejects.toThrow(
      'push suppression failed',
    );

    expect(dependencies.setPushSuppressed).toHaveBeenNthCalledWith(1, true);
    expect(dependencies.setPushSuppressed).toHaveBeenNthCalledWith(2, false);
    expect(dependencies.persistTransition).not.toHaveBeenCalled();
  });

  it('marks recovery when restart rejects', async () => {
    const { dependencies } = buildDependencies();
    jest
      .mocked(dependencies.restart)
      .mockRejectedValueOnce(new Error('restart failed'));
    const controller = new TravelModeTransitionController(dependencies);

    await expect(controller.setEnabled(false)).rejects.toThrow(
      'restart failed',
    );

    expect(dependencies.markRestartFailed).toHaveBeenCalledTimes(1);
  });

  it('marks recovery without dispatching restart when native epoch preparation fails', async () => {
    const { dependencies } = buildDependencies();
    jest
      .mocked(dependencies.prepareRestart)
      .mockRejectedValueOnce(new Error('epoch persistence failed'));
    const controller = new TravelModeTransitionController(dependencies);

    await expect(controller.setEnabled(false)).rejects.toThrow(
      'epoch persistence failed',
    );

    expect(dependencies.persistTransition).toHaveBeenCalledWith({
      enabled: false,
      verifyString: undefined,
    });
    expect(dependencies.markRestartFailed).toHaveBeenCalledTimes(1);
    expect(dependencies.restart).not.toHaveBeenCalled();
  });

  it('keeps retry blocked when a restart request returns to the old runtime', async () => {
    const { dependencies, setRuntimeState } = buildDependencies();
    setRuntimeState('transition-recovery');
    const controller = new TravelModeTransitionController(dependencies);

    await expect(controller.retryRestart()).rejects.toThrow('Unknown error');

    expect(dependencies.restart).toHaveBeenCalledWith(
      'travel-mode-transition-recovery-epoch-7',
    );
    expect(dependencies.markRestartFailed).toHaveBeenCalledTimes(1);
  });

  it('does not interleave a retry with a concurrent transition', async () => {
    const { dependencies, setRuntimeState } = buildDependencies();
    setRuntimeState('transition-recovery');
    let releaseRetry: (() => void) | undefined;
    let signalRetryStarted: (() => void) | undefined;
    const retryStarted = new Promise<void>((resolve) => {
      signalRetryStarted = resolve;
    });
    jest.mocked(dependencies.restart).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseRetry = resolve;
          signalRetryStarted?.();
        }),
    );
    const controller = new TravelModeTransitionController(dependencies);

    const retry = controller.retryRestart();
    await retryStarted;
    const transition = controller.setEnabled(false);
    await Promise.resolve();

    expect(dependencies.authenticateToggle).not.toHaveBeenCalled();
    releaseRetry?.();
    await expect(retry).rejects.toThrow('Unknown error');
    await expect(transition).rejects.toThrow('Unknown error');
    expect(dependencies.authenticateToggle).toHaveBeenCalledTimes(1);
  });

  it('times out a pending restart, permits retry, and ignores a late resolve', async () => {
    jest.useFakeTimers();
    try {
      const { dependencies } = buildDependencies();
      jest.mocked(dependencies.getPersistedEnabled).mockResolvedValueOnce(true);
      jest
        .mocked(dependencies.prepareRestart)
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(8);
      let resolveFirstRestart: (() => void) | undefined;
      let signalFirstRestart: (() => void) | undefined;
      const firstRestartStarted = new Promise<void>((resolve) => {
        signalFirstRestart = resolve;
      });
      jest.mocked(dependencies.restart).mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirstRestart = resolve;
            signalFirstRestart?.();
          }),
      );
      const controller = new TravelModeTransitionController(dependencies);

      const transition = controller.setEnabled(true);
      await firstRestartStarted;
      const transitionResult = transition.catch((error: unknown) => error);
      await jest.advanceTimersByTimeAsync(50);
      await expect(transitionResult).resolves.toMatchObject({
        message: 'Unknown error',
      });
      expect(dependencies.markRestartFailed).toHaveBeenCalledTimes(1);

      jest
        .mocked(dependencies.restart)
        .mockRejectedValueOnce(new Error('retry failed'));
      await expect(controller.retryRestart()).rejects.toThrow('retry failed');
      expect(dependencies.restart).toHaveBeenCalledTimes(2);
      expect(jest.mocked(dependencies.prepareRestart).mock.calls).toEqual([
        ['travel-mode'],
        ['travel-mode'],
      ]);
      expect(dependencies.restart).toHaveBeenNthCalledWith(
        2,
        'travel-mode-transition-recovery-epoch-8',
      );
      expect(dependencies.markRestartFailed).toHaveBeenCalledTimes(2);

      resolveFirstRestart?.();
      await Promise.resolve();
      expect(dependencies.markRestartFailed).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });
});
