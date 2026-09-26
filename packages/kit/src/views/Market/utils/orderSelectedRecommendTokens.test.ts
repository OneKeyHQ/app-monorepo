import { orderSelectedRecommendTokens } from './orderSelectedRecommendTokens';

describe('orderSelectedRecommendTokens', () => {
  const tokens = [{ symbol: 'BTC' }, { symbol: 'ETH' }, { symbol: 'BNB' }];
  const getKey = (token: { symbol: string }) => token.symbol;

  test('puts a rechecked token back in grid order', () => {
    expect(
      orderSelectedRecommendTokens(
        tokens,
        [{ symbol: 'ETH' }, { symbol: 'BNB' }, { symbol: 'BTC' }],
        getKey,
      ).map((token) => token.symbol),
    ).toEqual(['BTC', 'ETH', 'BNB']);
  });

  test('drops tokens that are no longer selected', () => {
    expect(
      orderSelectedRecommendTokens(
        tokens,
        [{ symbol: 'BNB' }, { symbol: 'BTC' }],
        getKey,
      ).map((token) => token.symbol),
    ).toEqual(['BTC', 'BNB']);
  });
});
