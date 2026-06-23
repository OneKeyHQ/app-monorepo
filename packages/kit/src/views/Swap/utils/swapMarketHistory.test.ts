import type {
  ISwapToken,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import {
  filterSwapMarketHistoryItems,
  getSwapMarketPendingHistoryCount,
  getSwapMarketPendingHistoryKey,
  isSwapMarketHistoryItem,
} from './swapMarketHistory';

const token: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xtoken',
  decimals: 18,
  symbol: 'TOKEN',
};

function createHistoryItem(protocol: EProtocolOfExchange): ISwapTxHistory {
  return {
    protocol,
    status: ESwapTxHistoryStatus.PENDING,
    currency: '$',
    accountInfo: {
      sender: {
        networkId: token.networkId,
      },
      receiver: {
        networkId: token.networkId,
      },
    },
    baseInfo: {
      fromToken: token,
      toToken: token,
      fromAmount: '1',
      toAmount: '1',
    },
    txInfo: {
      sender: '0xsender',
      receiver: '0xreceiver',
      txId: `${protocol}-tx`,
    },
    date: {
      created: Date.now(),
      updated: Date.now(),
    },
    swapInfo: {
      instantRate: '',
      provider: {
        provider: 'onekey',
        providerName: 'OneKey',
      },
      orderId: 'order-1',
    },
  };
}

describe('swapMarketHistory', () => {
  it('keeps stock orders in the market history bucket', () => {
    expect(
      isSwapMarketHistoryItem(createHistoryItem(EProtocolOfExchange.STOCK)),
    ).toBe(true);
  });

  it('excludes limit orders from the market history bucket', () => {
    expect(
      isSwapMarketHistoryItem(createHistoryItem(EProtocolOfExchange.LIMIT)),
    ).toBe(false);
  });

  it('keeps stock history in the swap market history bucket', () => {
    const stockHistory = createHistoryItem(EProtocolOfExchange.STOCK);
    const swapHistory = createHistoryItem(EProtocolOfExchange.SWAP);
    const histories = [stockHistory, swapHistory];

    expect(
      filterSwapMarketHistoryItems({
        items: histories,
        protocol: EProtocolOfExchange.STOCK,
      }),
    ).toEqual([stockHistory]);
    expect(
      filterSwapMarketHistoryItems({
        items: histories,
        protocol: EProtocolOfExchange.SWAP,
      }),
    ).toEqual([stockHistory, swapHistory]);
    expect(
      filterSwapMarketHistoryItems({
        items: histories,
      }),
    ).toEqual([stockHistory, swapHistory]);
  });

  it('counts stock pending history in the swap market pending bucket', () => {
    const stockHistory = createHistoryItem(EProtocolOfExchange.STOCK);
    const swapHistory = createHistoryItem(EProtocolOfExchange.SWAP);
    const histories = [stockHistory, swapHistory];

    expect(
      getSwapMarketPendingHistoryCount(histories, EProtocolOfExchange.SWAP),
    ).toBe(2);
    expect(
      getSwapMarketPendingHistoryKey(histories, EProtocolOfExchange.SWAP),
    ).toBe('Stock-tx:pending|Swap-tx:pending');
  });
});
