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

  test('hides the badge for a mainstream coin that only has a chain', () => {
    expect(
      getRecommendTokenNetworkId({
        chainId: 'btc--0',
        contractAddress: '',
      }),
    ).toBeUndefined();
  });

  test('keeps the chain for a regular token', () => {
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
