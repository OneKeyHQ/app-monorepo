import type {
  ISwapToken,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import {
  buildSwapRecentTokenPairsFromHistory,
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

function createToken(symbol: string, contractAddress = `0x${symbol}`) {
  return {
    ...token,
    contractAddress,
    symbol,
  };
}

function createHistoryItem({
  protocol,
  fromToken = token,
  toToken = token,
  created = Date.now(),
}: {
  protocol: EProtocolOfExchange;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
  created?: number;
}): ISwapTxHistory {
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
      fromToken,
      toToken,
      fromAmount: '1',
      toAmount: '1',
    },
    txInfo: {
      sender: '0xsender',
      receiver: '0xreceiver',
      txId: `${protocol}-${created}-tx`,
    },
    date: {
      created,
      updated: created,
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
      isSwapMarketHistoryItem(
        createHistoryItem({ protocol: EProtocolOfExchange.STOCK }),
      ),
    ).toBe(true);
  });

  it('excludes limit orders from the market history bucket', () => {
    expect(
      isSwapMarketHistoryItem(
        createHistoryItem({ protocol: EProtocolOfExchange.LIMIT }),
      ),
    ).toBe(false);
  });

  it('keeps stock history in the swap market history bucket', () => {
    const stockHistory = createHistoryItem({
      protocol: EProtocolOfExchange.STOCK,
    });
    const swapHistory = createHistoryItem({
      protocol: EProtocolOfExchange.SWAP,
    });
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
    const stockHistory = createHistoryItem({
      protocol: EProtocolOfExchange.STOCK,
    });
    const swapHistory = createHistoryItem({
      protocol: EProtocolOfExchange.SWAP,
    });
    const histories = [stockHistory, swapHistory];

    expect(
      getSwapMarketPendingHistoryCount(histories, EProtocolOfExchange.SWAP),
    ).toBe(2);
    expect(
      getSwapMarketPendingHistoryKey(histories, EProtocolOfExchange.SWAP),
    ).toBe(
      `${stockHistory.txInfo.txId}:pending|${swapHistory.txInfo.txId}:pending`,
    );
  });

  it('builds recent token pairs from stock histories only', () => {
    const usdc = createToken('USDC');
    const apple = createToken('AAPLon');
    const nvidia = createToken('NVDAon');
    const histories = [
      createHistoryItem({
        protocol: EProtocolOfExchange.SWAP,
        fromToken: usdc,
        toToken: createToken('ETH'),
        created: 4,
      }),
      createHistoryItem({
        protocol: EProtocolOfExchange.STOCK,
        fromToken: usdc,
        toToken: apple,
        created: 3,
      }),
      createHistoryItem({
        protocol: EProtocolOfExchange.STOCK,
        fromToken: apple,
        toToken: usdc,
        created: 2,
      }),
      createHistoryItem({
        protocol: EProtocolOfExchange.STOCK,
        fromToken: usdc,
        toToken: nvidia,
        created: 1,
      }),
    ];

    expect(
      buildSwapRecentTokenPairsFromHistory({
        items: histories,
        protocol: EProtocolOfExchange.STOCK,
      }),
    ).toEqual([
      { fromToken: usdc, toToken: apple },
      { fromToken: apple, toToken: usdc },
      { fromToken: usdc, toToken: nvidia },
    ]);
  });
});
