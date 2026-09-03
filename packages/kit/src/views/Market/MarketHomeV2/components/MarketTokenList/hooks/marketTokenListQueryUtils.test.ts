import { getMarketTokenListApiNetworkId } from './marketTokenListQueryUtils';

describe('getMarketTokenListApiNetworkId', () => {
  test('keeps the selected network for filterable categories', () => {
    expect(
      getMarketTokenListApiNetworkId({
        networkId: 'evm--1',
        isAllNetworks: false,
        type: 'trending',
      }),
    ).toBe('evm--1');
  });

  test('does not filter Robinhood Meme by the global network selection', () => {
    expect(
      getMarketTokenListApiNetworkId({
        networkId: 'evm--1',
        isAllNetworks: false,
        type: 'robinhood_meme',
      }),
    ).toBe('');
  });

  test('does not filter stocks or all networks', () => {
    expect(
      getMarketTokenListApiNetworkId({
        networkId: 'sol--101',
        isAllNetworks: false,
        type: 'stocks',
      }),
    ).toBe('');
    expect(
      getMarketTokenListApiNetworkId({
        networkId: 'onekeyall--0',
        isAllNetworks: true,
        type: 'trending',
      }),
    ).toBe('');
  });
});
