import { getRecommendTokenNetworkId } from './getRecommendTokenNetworkId';

describe('getRecommendTokenNetworkId', () => {
  test('hides the badge for an asset listing', () => {
    expect(
      getRecommendTokenNetworkId({
        chainId: 'btc--0',
        assetId: 'bitcoin',
      }),
    ).toBeUndefined();
  });

  test('hides the badge for a stock listing', () => {
    expect(
      getRecommendTokenNetworkId({
        chainId: 'evm--1',
        stockId: 'AAPL',
      }),
    ).toBeUndefined();
  });

  test('keeps the badge for a chain coin without assetId', () => {
    expect(
      getRecommendTokenNetworkId({
        chainId: 'btc--0',
        contractAddress: '',
      }),
    ).toBe('btc--0');
  });

  test('hides the badge for a top coin that also has a contract', () => {
    expect(
      getRecommendTokenNetworkId({
        chainId: 'evm--1',
        contractAddress: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
        assetId: 'aave',
      }),
    ).toBeUndefined();
  });

  test('keeps the chain for a token that is not a top-coin listing', () => {
    expect(
      getRecommendTokenNetworkId({
        chainId: 'evm--1',
        contractAddress: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
      }),
    ).toBe('evm--1');
  });

  test('treats a blank listing id as absent', () => {
    expect(
      getRecommendTokenNetworkId({
        chainId: 'evm--1',
        assetId: '  ',
        contractAddress: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
      }),
    ).toBe('evm--1');
  });
});
