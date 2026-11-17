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
  it('adds reward amounts without losing precision', () => {
    expect(
      getRewardSummary([
        createReward('9007199254740993.00000001'),
        createReward('0.00000009'),
      ]),
    ).toEqual({
      fiatValue: '9007199254740993.0000001',
      hasReward: true,
    });
  });

  it('ignores malformed amounts and handles an empty reward list', () => {
    expect(
      getRewardSummary([createReward('invalid'), createReward('1')]),
    ).toEqual({
      fiatValue: '1',
      hasReward: true,
    });
    expect(getRewardSummary([])).toEqual({
      fiatValue: '0',
      usdValue: '0',
      hasReward: false,
    });
  });

  it('uses a USD total only when every item has one', () => {
    expect(
      getRewardSummary([
        { ...createReward('10'), usdValue: '10' },
        { ...createReward('20'), usdValue: '2.5' },
      ]).usdValue,
    ).toBe('12.5');
    expect(
      getRewardSummary([
        { ...createReward('10'), usdValue: '10' },
        createReward('20'),
      ]).usdValue,
    ).toBeUndefined();
  });
});
