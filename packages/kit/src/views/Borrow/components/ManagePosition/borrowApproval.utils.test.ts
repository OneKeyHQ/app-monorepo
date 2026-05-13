import { EApproveType } from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import {
  isBorrowAllowanceEnough,
  isBorrowTokenApprovalEnabled,
  isBorrowTokenApprovalRequired,
  resolveBorrowApprovalActionStep,
} from './borrowApproval.utils';

import type { IBorrowApproveTarget } from './types';

const erc20Token: IToken = {
  address: '0xToken',
  decimals: 6,
  isNative: false,
  name: 'USD Coin',
  symbol: 'USDC',
  networkId: 'evm--1',
};

const nativeToken: IToken = {
  address: '',
  decimals: 18,
  isNative: true,
  name: 'Ether',
  symbol: 'ETH',
  networkId: 'evm--1',
};

const approveTarget: IBorrowApproveTarget = {
  accountId: 'account-id',
  networkId: 'evm--1',
  spenderAddress: '0xSpender',
  token: erc20Token,
};

describe('borrowApproval utils', () => {
  it('enables legacy ERC20 approvals only for supply and repay actions', () => {
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
        action: 'supply',
        approveType: EApproveType.Legacy,
        approveTarget: {
          ...approveTarget,
          token: nativeToken,
        },
      }),
    ).toBe(false);
  });

  it('requires approval when allowance is below the requested amount', () => {
    expect(
      isBorrowTokenApprovalRequired({
        enabled: true,
        amount: '10',
        allowance: '9.99',
      }),
    ).toBe(true);
    expect(
      isBorrowTokenApprovalRequired({
        enabled: true,
        amount: '10',
        allowance: '10',
      }),
    ).toBe(false);
    expect(
      isBorrowTokenApprovalRequired({
        enabled: true,
        amount: '0',
        allowance: '0',
      }),
    ).toBe(false);
    expect(
      isBorrowTokenApprovalRequired({
        enabled: false,
        amount: '10',
        allowance: '0',
      }),
    ).toBe(false);
  });

  it('requires threshold-sized allowance for repay all approvals', () => {
    expect(
      isBorrowTokenApprovalRequired({
        enabled: true,
        amount: '1',
        allowance: '340282366920938463463374607431768211455',
        requiresMaxApproval: true,
      }),
    ).toBe(true);
    expect(
      isBorrowTokenApprovalRequired({
        enabled: true,
        amount: '1',
        allowance: '340282366920938463463374607431768211456',
        requiresMaxApproval: true,
      }),
    ).toBe(false);
    expect(
      isBorrowAllowanceEnough({
        amount: '1',
        allowance: '340282366920938463463374607431768211456',
        requiresMaxApproval: true,
      }),
    ).toBe(true);
  });

  it('resolves the approval action step including USDT reset and invalid input', () => {
    expect(
      resolveBorrowApprovalActionStep({
        enabled: true,
        amount: '10',
        allowance: '10',
        shouldResetUSDT: true,
      }),
    ).toBe('submit');
    expect(
      resolveBorrowApprovalActionStep({
        enabled: true,
        amount: '10',
        allowance: '1',
        shouldResetUSDT: true,
      }),
    ).toBe('resetUSDT');
    expect(
      resolveBorrowApprovalActionStep({
        enabled: true,
        amount: '10',
        allowance: '0',
        shouldResetUSDT: true,
      }),
    ).toBe('approve');
    expect(
      resolveBorrowApprovalActionStep({
        enabled: true,
        amount: 'invalid',
        allowance: '0',
        shouldResetUSDT: true,
      }),
    ).toBe('idle');
  });
});
