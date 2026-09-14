import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import type { IToken } from '@onekeyhq/shared/types/token';

import {
  calculateTotalApproveDisplayAmount,
  getApproveDisplayAmount,
} from './approveDisplayUtils';

function buildApproveInfo({
  amount,
  balanceMultiplier,
  isMax,
}: {
  amount: string;
  balanceMultiplier?: string;
  isMax?: boolean;
}): IApproveInfo {
  return {
    owner: '0xowner',
    spender: '0xspender',
    amount,
    isMax,
    tokenInfo: {
      decimals: 18,
      name: 'Mock',
      symbol: 'MOCK',
      address: '0xtoken',
      isNative: false,
      balanceMultiplier,
    } as IToken,
  };
}

describe('getApproveDisplayAmount', () => {
  it('returns the raw amount unchanged when no multiplier is set', () => {
    expect(getApproveDisplayAmount(buildApproveInfo({ amount: '50' }))).toBe(
      '50',
    );
  });

  it('returns the raw amount unchanged for a unit multiplier', () => {
    expect(
      getApproveDisplayAmount(
        buildApproveInfo({ amount: '50', balanceMultiplier: '1' }),
      ),
    ).toBe('50');
  });

  it('converts the raw amount to display basis for a scaling multiplier', () => {
    expect(
      getApproveDisplayAmount(
        buildApproveInfo({ amount: '50', balanceMultiplier: '2' }),
      ),
    ).toBe('100');
  });

  it('handles fractional multipliers', () => {
    expect(
      getApproveDisplayAmount(
        buildApproveInfo({ amount: '100', balanceMultiplier: '0.5' }),
      ),
    ).toBe('50');
  });

  it('passes the raw amount through for an invalid multiplier', () => {
    expect(
      getApproveDisplayAmount(
        buildApproveInfo({ amount: '50', balanceMultiplier: 'abc' }),
      ),
    ).toBe('50');
  });

  it('passes an approve info without tokenInfo through unchanged', () => {
    expect(
      getApproveDisplayAmount({
        owner: '0xowner',
        spender: '0xspender',
        amount: '50',
      }),
    ).toBe('50');
  });
});

describe('calculateTotalApproveDisplayAmount', () => {
  it('sums raw amounts for non-scaled tokens', () => {
    expect(
      calculateTotalApproveDisplayAmount([
        buildApproveInfo({ amount: '10' }),
        buildApproveInfo({ amount: '20.5' }),
      ]),
    ).toBe('30.5');
  });

  it('sums display-basis amounts for scaled tokens', () => {
    expect(
      calculateTotalApproveDisplayAmount([
        buildApproveInfo({ amount: '50', balanceMultiplier: '2' }),
        buildApproveInfo({ amount: '25', balanceMultiplier: '2' }),
      ]),
    ).toBe('150');
  });

  it('excludes reset (zero-amount) approvals from the total', () => {
    expect(
      calculateTotalApproveDisplayAmount([
        buildApproveInfo({ amount: '0', balanceMultiplier: '2' }),
        buildApproveInfo({ amount: '50', balanceMultiplier: '2' }),
      ]),
    ).toBe('100');
  });

  it('treats an empty amount as zero', () => {
    expect(
      calculateTotalApproveDisplayAmount([
        buildApproveInfo({ amount: '' }),
        buildApproveInfo({ amount: '10' }),
      ]),
    ).toBe('10');
  });
});
