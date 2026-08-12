import { getRewardSummary } from './getRewardSummary';

const token = {
  networkId: 'evm--42161',
  address: '0xreward',
  logoURI: 'https://example.com/token.png',
  name: 'USD Coin',
  symbol: 'USDC',
};

function createReward(amount: string) {
  return {
    amount,
    fiatValue: amount,
    token,
  };
}

describe('getRewardSummary', () => {
  it('adds reward amounts without losing precision and keeps token metadata', () => {
    expect(
      getRewardSummary([
        createReward('9007199254740993.00000001'),
        createReward('0.00000009'),
      ]),
    ).toEqual({
      kind: 'token',
      amount: '9007199254740993.0000001',
      hasReward: true,
      token,
    });
  });

  it('ignores malformed amounts and handles an empty reward list', () => {
    expect(
      getRewardSummary([createReward('invalid'), createReward('1')]),
    ).toEqual({
      kind: 'token',
      amount: '1',
      hasReward: true,
      token,
    });
    expect(getRewardSummary([])).toEqual({
      kind: 'token',
      amount: '0',
      hasReward: false,
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
      getRewardSummary([
        createReward('10'),
        {
          ...createReward('20'),
          fiatValue: '4.25',
          token: otherToken,
        },
      ]),
    ).toEqual({
      kind: 'fiat',
      fiatValue: '14.25',
      hasReward: true,
    });
  });
});
