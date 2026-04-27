import { deFiListLoadingReducer } from './deFiListLoadingReducer';

describe('deFiListLoadingReducer', () => {
  it('enters the loading state on a "start" event', () => {
    expect(deFiListLoadingReducer({ type: 'start' })).toEqual({
      isRefreshing: true,
      initialized: false,
    });
  });

  it('clears the flag on "settled"', () => {
    expect(deFiListLoadingReducer({ type: 'settled' })).toEqual({
      isRefreshing: false,
      initialized: true,
    });
  });

  it('clears the flag on "error"', () => {
    expect(
      deFiListLoadingReducer({ type: 'error', error: new Error('boom') }),
    ).toEqual({
      isRefreshing: false,
      initialized: true,
    });
  });
});
