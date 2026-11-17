import { EApproveType } from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { resolveStakeInitialAllowanceTarget } from './StakeSection.utils';

const inputToken = {
  address: '0xinput-token',
  decimals: 18,
  isNative: false,
  networkId: 'evm--1',
  symbol: 'INPUT',
} as IToken;

describe('resolveStakeInitialAllowanceTarget', () => {
  it('uses the Borrow approve asset and spender for the initial allowance', () => {
    const approveAsset = {
      ...inputToken,
      address: '0xapprove-asset',
      symbol: 'APPROVE',
    };

    expect(
      resolveStakeInitialAllowanceTarget({
        borrowSupplyApproveTarget: {
          accountId: 'account-1',
          networkId: 'evm--1',
          spenderAddress: '0xborrow-spender',
          token: approveAsset,
        },
        approveType: EApproveType.Permit,
        spenderAddress: '0xstake-spender',
        token: inputToken,
      }),
    ).toEqual({
      approveType: EApproveType.Legacy,
      spenderAddress: '0xborrow-spender',
      token: approveAsset,
    });
  });

  it('preserves the staking allowance target outside Borrow supply', () => {
    expect(
      resolveStakeInitialAllowanceTarget({
        approveType: EApproveType.Permit,
        spenderAddress: '0xstake-spender',
        token: inputToken,
      }),
    ).toEqual({
      approveType: EApproveType.Permit,
      spenderAddress: '0xstake-spender',
      token: inputToken,
    });
  });
});
