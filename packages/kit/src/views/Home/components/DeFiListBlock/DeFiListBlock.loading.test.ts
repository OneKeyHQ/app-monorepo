import { deFiListLoadingReducer } from './deFiListLoadingReducer';

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
