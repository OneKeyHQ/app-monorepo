import { EApproveType } from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import {
  isBorrowTokenApprovalEnabled,
  isBorrowTokenApprovalRequired,
} from './borrowApproval.utils';

import type { IBorrowApproveTarget } from './types';

const usdcToken: IToken = {
  address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  decimals: 6,
  isNative: false,
  name: 'USD Coin',
  symbol: 'USDC',
  networkId: 'evm--1',
};

const ethToken: IToken = {
  address: '',
  decimals: 18,
  isNative: true,
  name: 'Ether',
  symbol: 'ETH',
  networkId: 'evm--1',
};

const approveTarget: IBorrowApproveTarget = {
  accountId: 'account-1',
  networkId: 'evm--1',
  spenderAddress: '0xpool',
  token: usdcToken,
};

describe('borrowApproval utils', () => {
  it('enables token approval only for supply and repay ERC20 legacy approvals', () => {
    expect(
      isBorrowTokenApprovalEnabled({
        action: 'supply',
        approveType: EApproveType.Legacy,
        approveTarget,
      }),
    ).toBe(true);

    expect(
      isBorrowTokenApprovalEnabled({
        action: 'repay',
        approveType: EApproveType.Legacy,
        approveTarget,
      }),
    ).toBe(true);

    expect(
      isBorrowTokenApprovalEnabled({
        action: 'borrow',
        approveType: EApproveType.Legacy,
        approveTarget,
      }),
    ).toBe(false);

    expect(
      isBorrowTokenApprovalEnabled({
        action: 'withdraw',
        approveType: EApproveType.Legacy,
        approveTarget,
      }),
    ).toBe(false);

    expect(
      isBorrowTokenApprovalEnabled({
        action: 'supply',
        approveType: EApproveType.Legacy,
        approveTarget: {
          ...approveTarget,
          token: ethToken,
        },
      }),
    ).toBe(false);
  });

  it('requires approval when allowance is lower than the requested amount', () => {
    expect(
      isBorrowTokenApprovalRequired({
        enabled: true,
        amount: '1',
        allowance: '0',
      }),
    ).toBe(true);

    expect(
      isBorrowTokenApprovalRequired({
        enabled: true,
        amount: '1',
        allowance: '1',
      }),
    ).toBe(false);

    expect(
      isBorrowTokenApprovalRequired({
        enabled: false,
        amount: '1',
        allowance: '0',
      }),
    ).toBe(false);
  });
});
