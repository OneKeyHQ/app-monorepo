import {
  deFiListLoadingReducer,
  isDeFiAllNetworkRequestsGranted,
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
    });
  });

  it('clears the flag and keeps the loaded owner on "error"', () => {
    expect(
      deFiListLoadingReducer({
        type: 'error',
        error: new Error('boom'),
        loadedOwnerKey: 'account-1:network-1',
      }),
    ).toEqual({
      isRefreshing: false,
      initialized: true,
      loadedOwnerKey: 'account-1:network-1',
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
    });
    expect(state).toEqual({ initialized: true, isRefreshing: false });
    expect(
      shouldShowDeFiEmptyState({
        protocolsLength: 0,
        initialized: true,
        isRefreshing: false,
        ownerKey: 'account-2:all',
        loadedOwnerKey: state.loadedOwnerKey,
      }),
    ).toBe(false);
  });

  it('settles the finished owner when the run returned no positions', () => {
    expect(
      resolveDeFiFanOutFinishedState({
        positionsOwnerKey: undefined,
        finishedOwnerKey: 'account-2:all',
      }),
    ).toEqual({
      initialized: true,
      isRefreshing: false,
      loadedOwnerKey: 'account-2:all',
    });
  });

  it('settles when the positions belong to another run', () => {
    expect(
      resolveDeFiFanOutFinishedState({
        positionsOwnerKey: 'account-1:all',
        finishedOwnerKey: 'account-2:all',
      }).loadedOwnerKey,
    ).toBe('account-2:all');
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
