import type { IRebateUserInviteSummary } from '@onekeyhq/shared/src/referralCode/type';

import { getSwapRewardSummary } from './utils';

const token = {
  networkId: 'evm--42161',
  address: '0xreward',
  logoURI: 'https://example.com/token.png',
  name: 'USD Coin',
  symbol: 'USDC',
};

function createReward(amount: string): IRebateUserInviteSummary {
  return {
    amount,
    fiatValue: amount,
    token,
  };
}

describe('getSwapRewardSummary', () => {
  it('adds reward amounts without losing precision and keeps token metadata', () => {
    expect(
      getSwapRewardSummary([
        createReward('9007199254740993.00000001'),
        createReward('0.00000009'),
      ]),
    ).toEqual({
      amount: '9007199254740993.0000001',
      hasReward: true,
      isSingleToken: true,
      token,
    });
  });

  it('ignores malformed amounts and handles an empty reward list', () => {
    expect(
      getSwapRewardSummary([createReward('invalid'), createReward('1')]),
    ).toEqual({
      amount: '1',
      hasReward: true,
      isSingleToken: true,
      token,
    });
    expect(getSwapRewardSummary([])).toEqual({
      amount: '0',
      hasReward: false,
      isSingleToken: true,
      token: undefined,
    });
  });

  it.each([
    ['address', { address: '0xother' }],
    ['network', { networkId: 'evm--1' }],
  ])('uses fiat value when the token %s differs', (_name, tokenOverride) => {
    const otherToken = {
      ...token,
      ...tokenOverride,
    };

    expect(
      getSwapRewardSummary([
        createReward('10'),
        {
          ...createReward('20'),
          fiatValue: '4.25',
          token: otherToken,
        },
      ]),
    ).toEqual({
      amount: '14.25',
      hasReward: true,
      isSingleToken: false,
      token: undefined,
    });
  });
});
