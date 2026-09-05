import { getMarketTokenListApiNetworkId } from './marketTokenListQueryUtils';

describe('getMarketTokenListApiNetworkId', () => {
  it('keeps the selected network for ordinary Market categories', () => {
    expect(
      getMarketTokenListApiNetworkId({
        networkId: 'evm--8453',
        isAllNetworks: false,
      }),
    ).toBe('evm--8453');
  });

  it('removes the network filter for All Networks', () => {
    expect(
      getMarketTokenListApiNetworkId({
        networkId: 'onekeyall--0',
        isAllNetworks: true,
      }),
    ).toBe('');
  });

  it('removes the network filter for Stocks on a selected network', () => {
    expect(
      getMarketTokenListApiNetworkId({
        networkId: 'sol--101',
        isAllNetworks: false,
        type: 'stocks',
      }),
    ).toBe('');
  });

  it('removes the network filter for Robinhood Meme', () => {
    expect(
      getMarketTokenListApiNetworkId({
        networkId: 'evm--1',
        isAllNetworks: false,
        type: 'robinhood_meme',
      }),
    ).toBe('');
  });
});
