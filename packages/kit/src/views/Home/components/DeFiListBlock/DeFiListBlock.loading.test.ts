import {
  deFiListLoadingReducer,
  isDeFiAllNetworkRequestsGranted,
  resolveDeFiCacheProbeAction,
  resolveDeFiFanOutFinishedState,
  shouldApplyDeFiAllNetworksResult,
  shouldResetDeFiReadinessOnRunStart,
  shouldShowDeFiEmptyState,
} from './deFiListLoadingReducer';

describe('deFiListLoadingReducer', () => {
  it('enters the loading state on a "start" event', () => {
    expect(deFiListLoadingReducer({ type: 'start' })).toEqual({
      isRefreshing: true,
      initialized: false,
      loadedOwnerKey: undefined,
      confirmedEmptyOwnerKey: undefined,
      hasError: false,
    });
  });

  it('clears the flag and keeps the loaded owner on "settled"', () => {
    expect(
      deFiListLoadingReducer({
        type: 'settled',
        loadedOwnerKey: 'account-1:network-1',
      }),
    ).toEqual({
      isRefreshing: false,
      initialized: true,
      loadedOwnerKey: 'account-1:network-1',
      hasError: false,
    });
  });

  it('does not mark the owner loaded on "error"', () => {
    expect(
      deFiListLoadingReducer({
        type: 'error',
        error: new Error('boom'),
        loadedOwnerKey: 'account-1:network-1',
      }),
    ).toEqual({
      isRefreshing: false,
      initialized: true,
      loadedOwnerKey: undefined,
      hasError: true,
    });
  });
});

describe('isDeFiAllNetworkRequestsGranted', () => {
  it('gates the list instance in the render that switches owners', () => {
    expect(
      isDeFiAllNetworkRequestsGranted({
        refreshCacheOnly: false,
        grantedOwnerKey: 'account-1:all',
        ownerKey: 'account-2:all',
      }),
    ).toBe(false);
    expect(
      isDeFiAllNetworkRequestsGranted({
        refreshCacheOnly: false,
        grantedOwnerKey: 'account-2:all',
        ownerKey: 'account-2:all',
      }),
    ).toBe(true);
  });

  it('lets the cache-only instance keep a grant across the switch render', () => {
    expect(
      isDeFiAllNetworkRequestsGranted({
        refreshCacheOnly: true,
        grantedOwnerKey: 'account-1:all',
        ownerKey: 'account-2:all',
      }),
    ).toBe(true);
    expect(
      isDeFiAllNetworkRequestsGranted({
        refreshCacheOnly: true,
        grantedOwnerKey: undefined,
        ownerKey: 'account-2:all',
      }),
    ).toBe(false);
  });

  it('never grants the list instance without an owner', () => {
    expect(
      isDeFiAllNetworkRequestsGranted({
        refreshCacheOnly: false,
        grantedOwnerKey: undefined,
        ownerKey: undefined,
      }),
    ).toBe(false);
  });
});

describe('shouldApplyDeFiAllNetworksResult', () => {
  const previousResult = [{ protocols: ['a'] }];

  it('skips the retained result when only the owner changed', () => {
    expect(
      shouldApplyDeFiAllNetworksResult({
        applied: { result: previousResult, ownerKey: 'account-1:all' },
        result: previousResult,
        ownerKey: 'account-2:all',
      }),
    ).toBe(false);
  });

  it('applies a newly published result and re-applies under its own owner', () => {
    expect(
      shouldApplyDeFiAllNetworksResult({
        applied: { result: previousResult, ownerKey: 'account-1:all' },
        result: [{ protocols: ['b'] }],
        ownerKey: 'account-2:all',
      }),
    ).toBe(true);
    expect(
      shouldApplyDeFiAllNetworksResult({
        applied: { result: previousResult, ownerKey: 'account-1:all' },
        result: previousResult,
        ownerKey: 'account-1:all',
      }),
    ).toBe(true);
    expect(
      shouldApplyDeFiAllNetworksResult({
        applied: undefined,
        result: previousResult,
        ownerKey: 'account-1:all',
      }),
    ).toBe(true);
  });
});

describe('resolveDeFiFanOutFinishedState', () => {
  it('leaves the loaded stamp to the result effect when positions are pending', () => {
    const state = resolveDeFiFanOutFinishedState({
      positionsOwnerKey: 'account-2:all',
      finishedOwnerKey: 'account-2:all',
      runSucceeded: true,
      previousConfirmedEmptyOwnerKey: 'account-2:all',
    });
    expect(state).toEqual({
      initialized: true,
      isRefreshing: false,
      confirmedEmptyOwnerKey: undefined,
      hasError: false,
    });
    expect(
      shouldShowDeFiEmptyState({
        protocolsLength: 0,
        ownerKey: 'account-2:all',
        confirmedEmptyOwnerKey: state.confirmedEmptyOwnerKey,
      }),
    ).toBe(false);
  });

  it('settles the finished owner when the run returned no positions', () => {
    expect(
      resolveDeFiFanOutFinishedState({
        positionsOwnerKey: undefined,
        finishedOwnerKey: 'account-2:all',
        runSucceeded: true,
      }),
    ).toEqual({
      initialized: true,
      isRefreshing: false,
      loadedOwnerKey: 'account-2:all',
      confirmedEmptyOwnerKey: 'account-2:all',
      hasError: false,
    });
  });

  it('settles when the positions belong to another run', () => {
    expect(
      resolveDeFiFanOutFinishedState({
        positionsOwnerKey: 'account-1:all',
        finishedOwnerKey: 'account-2:all',
        runSucceeded: true,
      }).loadedOwnerKey,
    ).toBe('account-2:all');
  });

  it('does not invent a confirmed empty result for a failed or partial run', () => {
    const state = resolveDeFiFanOutFinishedState({
      finishedOwnerKey: 'account-2:all',
      runSucceeded: false,
    });
    expect(state).toEqual({
      initialized: true,
      isRefreshing: false,
      loadedOwnerKey: undefined,
      confirmedEmptyOwnerKey: undefined,
      hasError: true,
    });
    expect(
      shouldShowDeFiEmptyState({
        protocolsLength: 0,
        ownerKey: 'account-2:all',
        confirmedEmptyOwnerKey: state.confirmedEmptyOwnerKey,
      }),
    ).toBe(false);
  });

  it('keeps a previously confirmed empty result only for the same owner on failure', () => {
    const failed = resolveDeFiFanOutFinishedState({
      finishedOwnerKey: 'account-2:all',
      previousConfirmedEmptyOwnerKey: 'account-2:all',
      runSucceeded: false,
    });
    expect(failed.hasError).toBe(true);
    expect(
      shouldShowDeFiEmptyState({
        protocolsLength: 0,
        ownerKey: 'account-2:all',
        confirmedEmptyOwnerKey: failed.confirmedEmptyOwnerKey,
      }),
    ).toBe(true);
    const switched = resolveDeFiFanOutFinishedState({
      finishedOwnerKey: 'account-3:all',
      previousConfirmedEmptyOwnerKey: 'account-2:all',
      runSucceeded: false,
    });
    expect(switched.confirmedEmptyOwnerKey).toBeUndefined();
  });

  it('does not keep an empty result once a partial run has found positions', () => {
    const state = resolveDeFiFanOutFinishedState({
      positionsOwnerKey: 'account-2:all',
      finishedOwnerKey: 'account-2:all',
      previousConfirmedEmptyOwnerKey: 'account-2:all',
      runSucceeded: false,
    });
    expect(state.confirmedEmptyOwnerKey).toBeUndefined();
    expect(state.hasError).toBe(true);
  });
});

describe('shouldShowDeFiEmptyState', () => {
  it('shows only a verified empty result belonging to the active owner', () => {
    expect(
      shouldShowDeFiEmptyState({
        protocolsLength: 0,
        ownerKey: 'a',
        confirmedEmptyOwnerKey: 'a',
      }),
    ).toBe(true);
    expect(
      shouldShowDeFiEmptyState({
        protocolsLength: 0,
        ownerKey: 'b',
        confirmedEmptyOwnerKey: 'a',
      }),
    ).toBe(false);
    expect(
      shouldShowDeFiEmptyState({
        protocolsLength: 1,
        ownerKey: 'a',
        confirmedEmptyOwnerKey: 'a',
      }),
    ).toBe(false);
    expect(
      shouldShowDeFiEmptyState({
        protocolsLength: 0,
        ownerKey: undefined,
        confirmedEmptyOwnerKey: undefined,
      }),
    ).toBe(false);
  });
});

describe('shouldResetDeFiReadinessOnRunStart', () => {
  it('keeps a readiness the same owner already reached', () => {
    expect(
      shouldResetDeFiReadinessOnRunStart({
        readiness: { ownerKey: 'account-1__all', isReady: true },
        ownerKey: 'account-1__all',
      }),
    ).toBe(false);
  });

  it('resets another owner, an unknown or a cache-less readiness', () => {
    expect(
      shouldResetDeFiReadinessOnRunStart({
        readiness: { ownerKey: 'account-1__all', isReady: true },
        ownerKey: 'account-2__all',
      }),
    ).toBe(true);
    expect(
      shouldResetDeFiReadinessOnRunStart({
        readiness: { ownerKey: 'account-1__all', isReady: undefined },
        ownerKey: 'account-1__all',
      }),
    ).toBe(true);
    expect(
      shouldResetDeFiReadinessOnRunStart({
        readiness: { ownerKey: 'account-1__all', isReady: false },
        ownerKey: 'account-1__all',
      }),
    ).toBe(true);
  });
});

describe('resolveDeFiCacheProbeAction', () => {
  const live = { runOwnerKey: 'account-1:all', liveOwnerKey: 'account-1:all' };

  it('marks the owner ready on a hit', () => {
    expect(
      resolveDeFiCacheProbeAction({
        ...live,
        hasCache: true,
        overviewPredatesEnabledSet: false,
      }),
    ).toBe('mark-ready');
    expect(
      resolveDeFiCacheProbeAction({
        ...live,
        hasCache: true,
        overviewPredatesEnabledSet: true,
      }),
    ).toBe('mark-ready');
  });

  it('zeroes the kept overview on a miss after an enabled-set change', () => {
    expect(
      resolveDeFiCacheProbeAction({
        ...live,
        hasCache: false,
        overviewPredatesEnabledSet: true,
      }),
    ).toBe('zero-overview');
  });

  it('reports the miss and keeps the last-known overview on any other miss', () => {
    // A miss is a terminal report for the header's cache-only instance:
    // nothing else writes readiness on the spot tab, so leaving it unknown
    // pins the header to its persisted total until the token commit + grace.
    expect(
      resolveDeFiCacheProbeAction({
        ...live,
        hasCache: false,
        overviewPredatesEnabledSet: false,
      }),
    ).toBe('mark-not-cached');
  });

  it('writes nothing for a run whose owner is no longer live', () => {
    expect(
      resolveDeFiCacheProbeAction({
        runOwnerKey: 'account-1:all',
        liveOwnerKey: 'account-2:all',
        hasCache: false,
        overviewPredatesEnabledSet: true,
      }),
    ).toBe('skip');
    expect(
      resolveDeFiCacheProbeAction({
        runOwnerKey: 'account-1:all',
        liveOwnerKey: 'account-2:all',
        hasCache: true,
        overviewPredatesEnabledSet: false,
      }),
    ).toBe('skip');
  });

  it('writes nothing without an owner', () => {
    expect(
      resolveDeFiCacheProbeAction({
        runOwnerKey: undefined,
        liveOwnerKey: undefined,
        hasCache: false,
        overviewPredatesEnabledSet: true,
      }),
    ).toBe('skip');
  });
});
