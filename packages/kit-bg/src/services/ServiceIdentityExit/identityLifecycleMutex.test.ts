import {
  beginIdentityLifecycleReservation,
  endIdentityLifecycleReservation,
  getActiveIdentityLifecycleOperationId,
  identityLifecycleMutex,
  markIdentityRecoveryFailed,
  markIdentityRecoveryPending,
  markIdentityRecoveryReady,
  resetIdentityRecoveryStateForTest,
} from './identityLifecycleMutex';

describe('identityLifecycleMutex recovery gate', () => {
  afterEach(() => {
    resetIdentityRecoveryStateForTest('ready');
  });

  test('waits for startup recovery before running an identity mutation', async () => {
    resetIdentityRecoveryStateForTest('pending');
    const callback = jest.fn().mockResolvedValue('done');

    const resultPromise = identityLifecycleMutex.runExclusive(callback);
    await Promise.resolve();
    expect(callback).not.toHaveBeenCalled();

    markIdentityRecoveryReady();
    await expect(resultPromise).resolves.toBe('done');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('rejects identity mutations while recovery is quarantined', async () => {
    resetIdentityRecoveryStateForTest('pending');
    const resultPromise = identityLifecycleMutex.runExclusive(async () => true);

    markIdentityRecoveryFailed();

    await expect(resultPromise).rejects.toThrow(
      'Identity recovery did not complete',
    );
  });

  test('rechecks recovery state after acquiring the lifecycle semaphore', async () => {
    let releaseFirst: (() => void) | undefined;
    let notifyFirstStarted: (() => void) | undefined;
    const firstStarted = new Promise<void>((resolve) => {
      notifyFirstStarted = resolve;
    });
    const first = identityLifecycleMutex.runExclusive(
      () =>
        new Promise<void>((resolve) => {
          releaseFirst = resolve;
          notifyFirstStarted?.();
        }),
    );
    await firstStarted;

    const secondCallback = jest.fn().mockResolvedValue('second');
    const second = identityLifecycleMutex.runExclusive(secondCallback);
    markIdentityRecoveryPending('test:second-operation');
    releaseFirst?.();
    await first;
    await Promise.resolve();
    expect(secondCallback).not.toHaveBeenCalled();

    markIdentityRecoveryReady('test:second-operation');
    await expect(second).resolves.toBe('second');
  });

  test('does not reopen while another recovery operation is still pending', async () => {
    markIdentityRecoveryPending('test:operation-a');
    markIdentityRecoveryPending('test:operation-b');
    const callback = jest.fn().mockResolvedValue('done');
    const result = identityLifecycleMutex.runExclusive(callback);

    markIdentityRecoveryReady('test:operation-a');
    await Promise.resolve();
    expect(callback).not.toHaveBeenCalled();

    markIdentityRecoveryReady('test:operation-b');
    await expect(result).resolves.toBe('done');
  });

  test('does not replace an active lifecycle reservation', () => {
    beginIdentityLifecycleReservation('operation-a');
    expect(() => beginIdentityLifecycleReservation('operation-b')).toThrow(
      'operation-a is already reserved',
    );
    expect(getActiveIdentityLifecycleOperationId()).toBe('operation-a');
    endIdentityLifecycleReservation('operation-a');
    expect(getActiveIdentityLifecycleOperationId()).toBeUndefined();
  });
});
