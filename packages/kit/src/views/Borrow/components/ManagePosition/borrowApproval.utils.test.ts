import { EApproveType } from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import {
  isBorrowAllowanceEnough,
  isBorrowAllowanceZero,
  isBorrowMaxApprovalAllowanceEnough,
  isBorrowTokenApprovalEnabled,
  isBorrowTokenApprovalRequired,
  resolveBorrowApprovalActionStep,
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

    expect(
      isBorrowTokenApprovalRequired({
        enabled: true,
        amount: '1',
        allowance: '1',
        requiresMaxApproval: true,
      }),
    ).toBe(true);

    expect(
      isBorrowTokenApprovalRequired({
        enabled: true,
        amount: '1',
        allowance: '1e40',
        requiresMaxApproval: true,
      }),
    ).toBe(false);
  });

  it('resolves fresh allowance into an explicit approval action step', () => {
    expect(
      resolveBorrowApprovalActionStep({
        enabled: true,
        amount: '1',
        allowance: '2',
        shouldResetUSDT: false,
      }),
    ).toBe('submit');

    expect(
      resolveBorrowApprovalActionStep({
        enabled: true,
        amount: '2',
        allowance: '1',
        shouldResetUSDT: true,
      }),
    ).toBe('resetUSDT');

    expect(
      resolveBorrowApprovalActionStep({
        enabled: true,
        amount: '2',
        allowance: '0',
        shouldResetUSDT: true,
      }),
    ).toBe('approve');

    expect(
      resolveBorrowApprovalActionStep({
        enabled: false,
        amount: '2',
        allowance: '0',
        shouldResetUSDT: false,
      }),
    ).toBe('idle');

    expect(
      resolveBorrowApprovalActionStep({
        enabled: true,
        amount: '1',
        allowance: '1',
        requiresMaxApproval: true,
        shouldResetUSDT: false,
      }),
    ).toBe('approve');

    expect(
      resolveBorrowApprovalActionStep({
        enabled: true,
        amount: '1',
        allowance: '1',
        requiresMaxApproval: true,
        shouldResetUSDT: true,
      }),
    ).toBe('resetUSDT');

    expect(
      resolveBorrowApprovalActionStep({
        enabled: true,
        amount: '1',
        allowance: '1e40',
        requiresMaxApproval: true,
        shouldResetUSDT: false,
      }),
    ).toBe('submit');
  });

  it('checks fresh allowance readiness and USDT reset completion', () => {
    expect(isBorrowAllowanceEnough({ amount: '1', allowance: '1' })).toBe(true);
    expect(isBorrowAllowanceEnough({ amount: '1', allowance: '0.5' })).toBe(
      false,
    );
    expect(
      isBorrowAllowanceEnough({
        amount: '1',
        allowance: '1',
        requiresMaxApproval: true,
      }),
    ).toBe(false);
    expect(
      isBorrowMaxApprovalAllowanceEnough({
        allowance: '1e40',
      }),
    ).toBe(true);
    expect(isBorrowAllowanceZero('0')).toBe(true);
    expect(isBorrowAllowanceZero('0.1')).toBe(false);
  });
});
