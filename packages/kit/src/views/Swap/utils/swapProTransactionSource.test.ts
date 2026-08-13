import type { IRecentTrade } from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  getSwapProMarketDataSource,
  isSwapProHyperliquidBtcToken,
  mapHyperliquidTradeToSwapProTransaction,
} from './swapProTransactionSource';

describe('swapProTransactionSource', () => {
  const btcToken = {
    networkId: 'btc--0',
    contractAddress: '',
    symbol: 'BTC',
    isNative: true,
  };

  it('selects Hyperliquid only for native BTC mainnet', () => {
    expect(isSwapProHyperliquidBtcToken(btcToken)).toBe(true);
    expect(
      getSwapProMarketDataSource({
        token: btcToken,
        supportSpeedSwap: true,
      }),
    ).toBe('hyperliquid');
  });

  it('selects Market for supported non-BTC tokens without provider fallback', () => {
    expect(
      getSwapProMarketDataSource({
        token: {
          networkId: 'evm--1',
          contractAddress: '0x1234',
          symbol: 'ETH',
          isNative: false,
        },
        supportSpeedSwap: true,
      }),
    ).toBe('market');
    expect(
      getSwapProMarketDataSource({
        token: {
          networkId: 'evm--1',
          contractAddress: '0x1234',
          symbol: 'ETH',
          isNative: false,
        },
        supportSpeedSwap: false,
      }),
    ).toBeUndefined();
  });

  it('maps a Hyperliquid trade to the shared Swap Pro transaction shape', () => {
    const transaction = mapHyperliquidTradeToSwapProTransaction({
      coin: 'BTC',
      side: 'B',
      px: '64000',
      sz: '0.25',
      time: 1_700_000_000_123,
      hash: '0xhash',
      tid: 7,
      users: ['0xseller', '0xbuyer'],
    } as IRecentTrade);

    expect(transaction).toMatchObject({
      hash: '0xhash:7',
      owner: '0xbuyer',
      type: 'buy',
      timestamp: 1_700_000_000,
      from: {
        symbol: 'USD',
        amount: '16000',
        price: '1',
      },
      to: {
        symbol: 'BTC',
        amount: '0.25',
        price: '64000',
      },
    });
  });
});
