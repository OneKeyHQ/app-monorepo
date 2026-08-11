import {
  acquireCustomInjectedProtocolSelectionLock,
  activateCustomInjectedProtocolRuntime,
  consumeCustomInjectedInitialProtocolUrl,
  getActiveCustomInjectedProtocolRuntime,
  isCustomInjectedE2ECleanSessionAllowed,
  isCustomInjectedProtocolRuntimeActive,
  isCustomInjectedProtocolSelectionAllowed,
  markCustomInjectedProtocolRuntimeReady,
  resetCustomInjectedProtocolRuntimeForTest,
  subscribeCustomInjectedProtocolSelectionLock,
  waitForCustomInjectedProtocolRuntimeReady,
} from './customInjectedProtocolRuntime';

const firstScope = {
  instanceKey: 'instance-1',
  protocolId: 'defillama:aave',
  sessionId: 'session-1',
  tabId: 'tab-1',
};

const secondScope = {
  instanceKey: 'instance-2',
  protocolId: 'defillama:compound',
  sessionId: 'session-1',
  tabId: 'tab-1',
};

describe('customInjectedProtocolRuntime', () => {
  afterEach(() => {
    resetCustomInjectedProtocolRuntimeForTest();
  });

  test('settles stale readiness waiters when a protocol is replaced', async () => {
    const activeFirstScope = activateCustomInjectedProtocolRuntime(firstScope);
    const firstReady =
      waitForCustomInjectedProtocolRuntimeReady(activeFirstScope);

    const activeSecondScope =
      activateCustomInjectedProtocolRuntime(secondScope);

    await expect(firstReady).resolves.toBe(false);
    expect(markCustomInjectedProtocolRuntimeReady(activeFirstScope)).toBe(
      false,
    );
    expect(markCustomInjectedProtocolRuntimeReady(activeSecondScope)).toBe(
      true,
    );
    await expect(
      waitForCustomInjectedProtocolRuntimeReady(activeSecondScope),
    ).resolves.toBe(true);
    expect(getActiveCustomInjectedProtocolRuntime()).toEqual(secondScope);
    expect(isCustomInjectedProtocolRuntimeActive(activeFirstScope)).toBe(false);
    expect(isCustomInjectedProtocolRuntimeActive(activeSecondScope)).toBe(true);
  });

  test('allows the automatic protocol URL redirect only once per app run', () => {
    expect(consumeCustomInjectedInitialProtocolUrl()).toBe(true);
    expect(consumeCustomInjectedInitialProtocolUrl()).toBe(false);

    activateCustomInjectedProtocolRuntime(firstScope);
    activateCustomInjectedProtocolRuntime(secondScope);

    expect(consumeCustomInjectedInitialProtocolUrl()).toBe(false);
  });

  test('allows only the lock owner to switch protocols', () => {
    const observedLocks: (string | undefined)[] = [];
    const unsubscribe = subscribeCustomInjectedProtocolSelectionLock((lock) =>
      observedLocks.push(lock?.token),
    );
    const lock = acquireCustomInjectedProtocolSelectionLock({
      reason: 'pending E2E validation',
      sessionId: 'session-1',
    });

    expect(
      isCustomInjectedProtocolSelectionAllowed({ sessionId: 'session-1' }),
    ).toBe(false);
    expect(
      isCustomInjectedProtocolSelectionAllowed({
        lockToken: lock.token,
        sessionId: 'session-1',
      }),
    ).toBe(true);
    expect(
      isCustomInjectedProtocolSelectionAllowed({
        lockToken: lock.token,
        sessionId: 'session-2',
      }),
    ).toBe(false);
    expect(() =>
      acquireCustomInjectedProtocolSelectionLock({
        reason: 'another operation',
        sessionId: 'session-1',
      }),
    ).toThrow('Protocol switching is locked by pending E2E validation');

    lock.release();
    expect(
      isCustomInjectedProtocolSelectionAllowed({ sessionId: 'session-1' }),
    ).toBe(true);
    expect(observedLocks).toEqual([lock.token, undefined]);
    unsubscribe();
  });

  test('allows clean-session resets owned by E2E without unlocking protocol switching', () => {
    const lock = acquireCustomInjectedProtocolSelectionLock({
      reason: 'E2E validation',
      sessionId: 'session-1',
    });

    expect(
      isCustomInjectedE2ECleanSessionAllowed({ sessionId: 'session-1' }),
    ).toBe(true);
    expect(
      isCustomInjectedE2ECleanSessionAllowed({ sessionId: 'session-2' }),
    ).toBe(false);
    expect(
      isCustomInjectedProtocolSelectionAllowed({ sessionId: 'session-1' }),
    ).toBe(false);

    lock.release();
  });
});
