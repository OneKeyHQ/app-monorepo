import type {
  ISwapToken,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import { isSwapMarketHistoryItem } from './swapMarketHistory';

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
});
