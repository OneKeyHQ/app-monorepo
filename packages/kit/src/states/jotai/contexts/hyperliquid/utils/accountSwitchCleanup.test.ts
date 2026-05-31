import { getPerpsAccountSwitchCleanupPlan } from './accountSwitchCleanup';

describe('getPerpsAccountSwitchCleanupPlan', () => {
  it('preserves cached rows but clears account-local transient data when switching to a cached account', () => {
    expect(
      getPerpsAccountSwitchCleanupPlan({
        previousAccountAddress: '0xaaa',
        nextAccountAddress: '0xbbb',
        cachedPositionAccountAddress: '0xbbb',
        cachedOpenOrdersAccountAddress: undefined,
        cachedSpotOpenOrdersAccountAddress: '0xaaa',
      }),
    ).toEqual({
      shouldClearActiveAccountData: false,
      shouldClearPositionData: false,
      shouldClearOpenOrdersData: false,
      shouldClearSpotOpenOrdersData: true,
      shouldClearTransientData: true,
    });
  });

  it('preserves matching positions and clears mismatched open orders on partial cache hits', () => {
    expect(
      getPerpsAccountSwitchCleanupPlan({
        previousAccountAddress: '0xaaa',
        nextAccountAddress: '0xbbb',
        cachedPositionAccountAddress: '0xbbb',
        cachedOpenOrdersAccountAddress: '0xaaa',
        cachedSpotOpenOrdersAccountAddress: '0xaaa',
      }),
    ).toEqual({
      shouldClearActiveAccountData: false,
      shouldClearPositionData: false,
      shouldClearOpenOrdersData: true,
      shouldClearSpotOpenOrdersData: true,
      shouldClearTransientData: true,
    });
  });

  it('preserves matching open orders and clears mismatched positions on partial cache hits', () => {
    expect(
      getPerpsAccountSwitchCleanupPlan({
        previousAccountAddress: '0xaaa',
        nextAccountAddress: '0xbbb',
        cachedPositionAccountAddress: '0xaaa',
        cachedOpenOrdersAccountAddress: '0xbbb',
        cachedSpotOpenOrdersAccountAddress: '0xaaa',
      }),
    ).toEqual({
      shouldClearActiveAccountData: false,
      shouldClearPositionData: true,
      shouldClearOpenOrdersData: false,
      shouldClearSpotOpenOrdersData: true,
      shouldClearTransientData: true,
    });
  });

  it('preserves matching spot open orders on partial cache hits', () => {
    expect(
      getPerpsAccountSwitchCleanupPlan({
        previousAccountAddress: '0xaaa',
        nextAccountAddress: '0xbbb',
        cachedPositionAccountAddress: '0xbbb',
        cachedOpenOrdersAccountAddress: '0xaaa',
        cachedSpotOpenOrdersAccountAddress: '0xbbb',
      }),
    ).toEqual({
      shouldClearActiveAccountData: false,
      shouldClearPositionData: false,
      shouldClearOpenOrdersData: true,
      shouldClearSpotOpenOrdersData: false,
      shouldClearTransientData: true,
    });
  });

  it('does not preserve account data from spot-only live rows', () => {
    expect(
      getPerpsAccountSwitchCleanupPlan({
        previousAccountAddress: '0xaaa',
        nextAccountAddress: '0xbbb',
        cachedPositionAccountAddress: '0xaaa',
        cachedOpenOrdersAccountAddress: '0xaaa',
        cachedSpotOpenOrdersAccountAddress: '0xbbb',
      }),
    ).toEqual({
      shouldClearActiveAccountData: true,
      shouldClearPositionData: false,
      shouldClearOpenOrdersData: false,
      shouldClearSpotOpenOrdersData: false,
      shouldClearTransientData: false,
    });
  });

  it('clears account-scoped rows when the resolved account has no address', () => {
    expect(
      getPerpsAccountSwitchCleanupPlan({
        previousAccountAddress: null,
        nextAccountAddress: null,
        cachedPositionAccountAddress: '0xaaa',
        cachedOpenOrdersAccountAddress: undefined,
      }),
    ).toEqual({
      shouldClearActiveAccountData: true,
      shouldClearPositionData: false,
      shouldClearOpenOrdersData: false,
      shouldClearSpotOpenOrdersData: false,
      shouldClearTransientData: false,
    });
  });

  it('clears account-scoped rows when switching to an account with no cache', () => {
    expect(
      getPerpsAccountSwitchCleanupPlan({
        previousAccountAddress: '0xaaa',
        nextAccountAddress: '0xbbb',
        cachedPositionAccountAddress: '0xaaa',
        cachedOpenOrdersAccountAddress: '0xaaa',
      }),
    ).toEqual({
      shouldClearActiveAccountData: true,
      shouldClearPositionData: false,
      shouldClearOpenOrdersData: false,
      shouldClearSpotOpenOrdersData: false,
      shouldClearTransientData: false,
    });
  });

  it('does not clear anything for same-account refreshes', () => {
    expect(
      getPerpsAccountSwitchCleanupPlan({
        previousAccountAddress: '0xaaa',
        nextAccountAddress: '0xAAA',
        cachedPositionAccountAddress: '0xaaa',
        cachedOpenOrdersAccountAddress: undefined,
      }),
    ).toEqual({
      shouldClearActiveAccountData: false,
      shouldClearPositionData: false,
      shouldClearOpenOrdersData: false,
      shouldClearSpotOpenOrdersData: false,
      shouldClearTransientData: false,
    });
  });
});
