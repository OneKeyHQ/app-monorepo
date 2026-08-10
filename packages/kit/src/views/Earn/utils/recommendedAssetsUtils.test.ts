import {
  EARN_MOBILE_RECOMMENDED_ASSET_COUNT,
  pickMobileRecommendedAssets,
} from './recommendedAssetsUtils';

const asset = (symbol: string, balance: string, apr: string) => ({
  symbol,
  available: { text: `Balance: ${balance}` },
  aprWithoutFee: apr,
});

describe('pickMobileRecommendedAssets', () => {
  it('prioritizes positive balances and fills the remaining slots by APR', () => {
    const picked = pickMobileRecommendedAssets([
      asset('ZERO_HIGH', '0', '20%'),
      asset('BALANCE_LOW', '1', '1%'),
      asset('ZERO_LOW', '0', '2%'),
      asset('BALANCE_HIGH', '1,200.5', '0.5%'),
      asset('ZERO_MID', '0', '10%'),
      asset('ZERO_LAST', '0', '0.1%'),
    ]);

    expect(picked.map((item) => item.symbol)).toEqual([
      'BALANCE_HIGH',
      'BALANCE_LOW',
      'ZERO_HIGH',
      'ZERO_MID',
      'ZERO_LOW',
    ]);
  });

  it('uses only the largest balances when more than five assets have funds', () => {
    const assets = Array.from(
      { length: EARN_MOBILE_RECOMMENDED_ASSET_COUNT + 2 },
      (_, index) => asset(`T${index}`, String(index + 1), '99%'),
    );

    expect(
      pickMobileRecommendedAssets(assets).map((item) => item.symbol),
    ).toEqual(['T6', 'T5', 'T4', 'T3', 'T2']);
  });

  it('sorts entirely by APR when no asset has a balance', () => {
    const assets = [
      asset('LOW', '0', '2%'),
      asset('RANGE', '0', '3% - 8% APY'),
      asset('HIGH', '0', '10%'),
    ];

    expect(
      pickMobileRecommendedAssets(assets).map((item) => item.symbol),
    ).toEqual(['HIGH', 'RANGE', 'LOW']);
    expect(assets.map((item) => item.symbol)).toEqual(['LOW', 'RANGE', 'HIGH']);
  });
});
