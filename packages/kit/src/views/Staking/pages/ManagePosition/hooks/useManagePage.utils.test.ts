import { EManagePositionType } from '@onekeyhq/shared/types/staking';

import {
  buildManagePageApproveInfo,
  buildManagePageRequestKey,
  shouldBlockManagePageAction,
} from './useManagePage.utils';

describe('useManagePage utils', () => {
  it('preserves an unknown allowance when only the approve target is provided', () => {
    expect(
      buildManagePageApproveInfo({
        approve: undefined,
        approveAsset: undefined,
        approveTarget: '0xspender',
      })?.allowance,
    ).toBeUndefined();
  });

  it('includes indexed account identity in the request key', () => {
    const baseParams = {
      accountId: '',
      networkId: 'evm--1',
      symbol: 'ETH',
      provider: 'lido',
      type: EManagePositionType.Staking,
    };

    expect(
      buildManagePageRequestKey({
        ...baseParams,
        indexedAccountId: 'indexed-account-1',
      }),
    ).not.toBe(
      buildManagePageRequestKey({
        ...baseParams,
        indexedAccountId: 'indexed-account-2',
      }),
    );
  });

  it('blocks stale data even without a protocol switcher', () => {
    expect(
      shouldBlockManagePageAction({
        hasManagePageData: true,
        isStaleData: true,
        isLoading: false,
        hasProtocolSwitch: false,
      }),
    ).toBe(true);
  });

  it('does not block an ordinary same-scope refresh', () => {
    expect(
      shouldBlockManagePageAction({
        hasManagePageData: true,
        isStaleData: false,
        isLoading: true,
        hasProtocolSwitch: false,
      }),
    ).toBe(false);
  });
});
