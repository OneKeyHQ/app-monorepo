import {
  getRecommendTokenNetworkId,
  getVisibleRecommendTokenNetworkId,
} from './getRecommendTokenNetworkId';

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

  test('hides the badge until the top-coin match finishes', () => {
    expect(
      getVisibleRecommendTokenNetworkId({
        token: {
          chainId: 'evm--1',
          contractAddress: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
        },
        listingResolved: false,
      }),
    ).toBeUndefined();
  });

  test('hides the badge when the resolved listing is a top coin', () => {
    expect(
      getVisibleRecommendTokenNetworkId({
        token: {
          chainId: 'evm--56',
          contractAddress: '0x000Ae314E2A2172a039B26378814C252734f556A',
        },
        listing: { assetId: 'aster' },
        listingResolved: true,
      }),
    ).toBeUndefined();
  });

  test('shows the chain after a contract token fails to match a top coin', () => {
    expect(
      getVisibleRecommendTokenNetworkId({
        token: {
          chainId: 'evm--1',
          contractAddress: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
        },
        listing: {},
        listingResolved: true,
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
