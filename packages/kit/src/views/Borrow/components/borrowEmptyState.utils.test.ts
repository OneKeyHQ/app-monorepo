import { getBorrowRecommendationAssets } from './borrowEmptyState.utils';

const asset = (symbol: string, fiatValue?: string, disabled?: boolean) => ({
  symbol,
  walletBalance:
    fiatValue === undefined ? undefined : { fiatValue: String(fiatValue) },
  supplyButton: disabled === undefined ? undefined : { disabled },
});

describe('getBorrowRecommendationAssets', () => {
  it('orders by fiat balance and excludes disabled assets', () => {
    const recommendations = getBorrowRecommendationAssets([
      asset('WETH', '0.04'),
      asset('BLOCKED', '99', true),
      asset('USDC', '1.34'),
      asset('DAI', '1.33'),
      asset('NO_BALANCE'),
    ]);
    expect(recommendations.map((item) => item.symbol)).toEqual([
      'USDC',
      'DAI',
      'WETH',
      'NO_BALANCE',
    ]);
  });

  it('does not cap the result or mutate the source', () => {
    const assets = Array.from({ length: 9 }, (_, i) =>
      asset(`T${i}`, String(i)),
    );
    const originalOrder = assets.map((item) => item.symbol);
    const recommendations = getBorrowRecommendationAssets(assets);

    expect(recommendations).toHaveLength(assets.length);
    expect(recommendations.map((item) => item.symbol)).toEqual([
      'T8',
      'T7',
      'T6',
      'T5',
      'T4',
      'T3',
      'T2',
      'T1',
      'T0',
    ]);
    expect(assets.map((item) => item.symbol)).toEqual(originalOrder);
  });

  it('returns an empty list when there is nothing to recommend', () => {
    expect(getBorrowRecommendationAssets(undefined)).toEqual([]);
    expect(getBorrowRecommendationAssets([])).toEqual([]);
  });
});
