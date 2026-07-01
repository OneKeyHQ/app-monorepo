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
  isStockSwapHistoryItem,
  isSwapMarketHistoryItem,
} from './swapMarketHistory';

const token: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xtoken',
  decimals: 18,
  symbol: 'TOKEN',
};

function createToken(
  symbol: string,
  contractAddress = `0x${symbol}`,
  extra?: Partial<ISwapToken>,
) {
  return {
    ...token,
    contractAddress,
    symbol,
    ...extra,
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

  it('detects stock trades via the token isStock flag', () => {
    const stockToken = createToken('AAPLon', '0xAAPLon', { isStock: true });
    const usdc = createToken('USDC', '0xUSDC');
    // Buy (pay stablecoin -> receive stock), protocol echoed as SWAP fallback
    expect(
      isStockSwapHistoryItem(
        createHistoryItem({
          protocol: EProtocolOfExchange.SWAP,
          fromToken: usdc,
          toToken: stockToken,
        }),
      ),
    ).toBe(true);
    // Sell (pay stock -> receive stablecoin)
    expect(
      isStockSwapHistoryItem(
        createHistoryItem({
          protocol: EProtocolOfExchange.SWAP,
          fromToken: stockToken,
          toToken: usdc,
        }),
      ),
    ).toBe(true);
    // Plain swap, no stock token
    expect(
      isStockSwapHistoryItem(
        createHistoryItem({
          protocol: EProtocolOfExchange.SWAP,
          fromToken: usdc,
          toToken: createToken('ETH'),
        }),
      ),
    ).toBe(false);
    // Item that does carry protocol === STOCK still counts
    expect(
      isStockSwapHistoryItem(
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
    const usdc = createToken('USDC', '0xUSDC', {
      balanceParsed: '100',
      fiatValue: '100',
      price: '1',
    });
    const apple = createToken('AAPLon', '0xAAPLon', {
      balanceParsed: '1',
      fiatValue: '200',
      isStock: true,
      price: '200',
    });
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

    const recentTokenPairs = buildSwapRecentTokenPairsFromHistory({
      items: histories,
      protocol: EProtocolOfExchange.STOCK,
    });

    expect(recentTokenPairs).toHaveLength(3);
    expect(recentTokenPairs[0].fromToken).toMatchObject({
      contractAddress: usdc.contractAddress,
      networkId: usdc.networkId,
      symbol: usdc.symbol,
    });
    expect(recentTokenPairs[0].toToken).toMatchObject({
      contractAddress: apple.contractAddress,
      isStock: true,
      networkId: apple.networkId,
      symbol: apple.symbol,
    });
    expect(recentTokenPairs[1].fromToken).toMatchObject({
      contractAddress: apple.contractAddress,
      isStock: true,
      networkId: apple.networkId,
      symbol: apple.symbol,
    });
    expect(recentTokenPairs[1].toToken).toMatchObject({
      contractAddress: usdc.contractAddress,
      networkId: usdc.networkId,
      symbol: usdc.symbol,
    });
    expect(recentTokenPairs[2].fromToken).toMatchObject({
      contractAddress: usdc.contractAddress,
      networkId: usdc.networkId,
      symbol: usdc.symbol,
    });
    expect(recentTokenPairs[2].toToken).toMatchObject({
      contractAddress: nvidia.contractAddress,
      networkId: nvidia.networkId,
      symbol: nvidia.symbol,
    });
    expect(recentTokenPairs[0].fromToken).not.toHaveProperty('balanceParsed');
    expect(recentTokenPairs[0].fromToken).not.toHaveProperty('fiatValue');
    expect(recentTokenPairs[0].fromToken).not.toHaveProperty('price');
    expect(recentTokenPairs[0].toToken).not.toHaveProperty('balanceParsed');
    expect(recentTokenPairs[0].toToken).not.toHaveProperty('fiatValue');
    expect(recentTokenPairs[0].toToken).not.toHaveProperty('price');
  });
});
