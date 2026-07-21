import type {
  IMarketStockInfo,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import {
  getCurrentSwapPairStockMarketStatus,
  getSwapPairMarketStatusScope,
  isSwapPairStockMarketClosed,
  resolveSwapPairStockMarketStatus,
  shouldBlockSwapTradeSubmissionForMarketClosed,
} from './usMarketStatusUtils';

const fromToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xUSDC',
  symbol: 'USDC',
  decimals: 6,
};
const stockToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xAAPL',
  symbol: 'AAPL',
  decimals: 18,
  isStock: true,
};

function buildMarketTokenDetail({
  token,
  stock,
}: {
  token: ISwapToken;
  stock?: IMarketStockInfo;
}): IMarketTokenDetail {
  return {
    networkId: token.networkId,
    address: token.contractAddress,
    logoUrl: '',
    name: token.symbol,
    symbol: token.symbol,
    decimals: token.decimals,
    stock,
  };
}

const closedStock: IMarketStockInfo = {
  subtitle: 'Apple Inc.',
  sourceLogoUri: '',
  isOpen: false,
  description: 'Reopens in 2h\nTrading hours',
};

describe('usMarketStatusUtils', () => {
  it('scopes both same-chain swaps and actual bridge pairs', () => {
    const swapScope = getSwapPairMarketStatusScope({
      swapTypeSwitch: ESwapTabSwitchType.SWAP,
      fromToken,
      toToken: { ...stockToken, networkId: fromToken.networkId },
    });
    const bridgeScope = getSwapPairMarketStatusScope({
      swapTypeSwitch: ESwapTabSwitchType.BRIDGE,
      fromToken,
      toToken: stockToken,
    });
    const normalizedBridgeScope = getSwapPairMarketStatusScope({
      swapTypeSwitch: ESwapTabSwitchType.SWAP,
      fromToken,
      toToken: stockToken,
    });

    expect(swapScope).toContain('swap-bridge:');
    expect(bridgeScope).toContain('swap-bridge:');
    expect(bridgeScope).toContain('evm--1:0xusdc');
    expect(bridgeScope).toContain('evm--56:0xaapl');
    expect(normalizedBridgeScope).toBe(bridgeScope);
  });

  it('does not request market status outside Swap and Bridge', () => {
    expect(
      getSwapPairMarketStatusScope({
        swapTypeSwitch: ESwapTabSwitchType.LIMIT,
        fromToken,
        toToken: stockToken,
      }),
    ).toBe('');
  });

  it('resolves a closed stock on either side with its Perps handoff', () => {
    const toStockResult = resolveSwapPairStockMarketStatus({
      scope: 'bridge-pair',
      fromTokenDetail: {
        unavailable: false,
        token: buildMarketTokenDetail({ token: fromToken }),
      },
      toTokenDetail: {
        unavailable: false,
        token: buildMarketTokenDetail({
          token: stockToken,
          stock: closedStock,
        }),
        perpsInfo: { hlTicker: 'AAPL' },
      },
    });

    const fromStockResult = resolveSwapPairStockMarketStatus({
      scope: 'swap-pair',
      fromTokenDetail: {
        unavailable: false,
        token: buildMarketTokenDetail({
          token: stockToken,
          stock: closedStock,
        }),
        perpsInfo: { hlTicker: 'AAPL' },
      },
      toTokenDetail: {
        unavailable: false,
        token: buildMarketTokenDetail({ token: fromToken }),
      },
    });

    expect(toStockResult.hasStockToken).toBe(true);
    expect(toStockResult.closedStock?.stock).toBe(closedStock);
    expect(toStockResult.closedStock?.perpsInfo?.hlTicker).toBe('AAPL');
    expect(fromStockResult.closedStock?.stock).toBe(closedStock);
  });

  it('keeps an available non-stock pair open and eligible to stop polling', () => {
    const result = resolveSwapPairStockMarketStatus({
      scope: 'non-stock-pair',
      fromTokenDetail: {
        unavailable: false,
        token: buildMarketTokenDetail({ token: fromToken }),
      },
      toTokenDetail: {
        unavailable: false,
        token: buildMarketTokenDetail({
          token: { ...stockToken, isStock: false },
        }),
      },
    });

    expect(result.hasStockToken).toBe(false);
    expect(result.unavailable).toBe(false);
    expect(result.closedStock).toBeUndefined();
  });

  it('does not treat an unavailable or unknown market state as closed', () => {
    const unknownStock = { ...closedStock, isOpen: undefined };
    const result = resolveSwapPairStockMarketStatus({
      scope: 'stock-pair',
      fromTokenDetail: { unavailable: true },
      toTokenDetail: {
        unavailable: false,
        token: buildMarketTokenDetail({
          token: stockToken,
          stock: unknownStock,
        }),
      },
    });

    expect(result.unavailable).toBe(true);
    expect(result.hasStockToken).toBe(true);
    expect(result.closedStock).toBeUndefined();
  });

  it('ignores an async result from a superseded token pair', () => {
    const result = resolveSwapPairStockMarketStatus({
      scope: 'old-pair',
      fromTokenDetail: { unavailable: false },
      toTokenDetail: {
        unavailable: false,
        token: buildMarketTokenDetail({
          token: stockToken,
          stock: closedStock,
        }),
      },
    });

    expect(
      getCurrentSwapPairStockMarketStatus({
        scope: 'new-pair',
        result,
      }),
    ).toBeUndefined();
  });

  it('matches a visible cross-chain pair to the actual Bridge confirmation', () => {
    const visibleScope = getSwapPairMarketStatusScope({
      swapTypeSwitch: ESwapTabSwitchType.SWAP,
      fromToken,
      toToken: stockToken,
    });
    const status = resolveSwapPairStockMarketStatus({
      scope: visibleScope,
      fromTokenDetail: { unavailable: false },
      toTokenDetail: {
        unavailable: false,
        token: buildMarketTokenDetail({
          token: stockToken,
          stock: closedStock,
        }),
      },
    });

    expect(
      isSwapPairStockMarketClosed({
        status,
        swapTypeSwitch: ESwapTabSwitchType.BRIDGE,
        fromToken,
        toToken: stockToken,
      }),
    ).toBe(true);
    expect(
      isSwapPairStockMarketClosed({
        status,
        swapTypeSwitch: ESwapTabSwitchType.BRIDGE,
        fromToken: { ...fromToken, contractAddress: '0xDAI' },
        toToken: stockToken,
      }),
    ).toBe(false);
  });

  it('blocks only actual trade submission while the market is closed', () => {
    expect(
      shouldBlockSwapTradeSubmissionForMarketClosed({
        isMarketClosed: true,
        noConnectWallet: false,
        isRefreshQuote: false,
      }),
    ).toBe(true);
    expect(
      shouldBlockSwapTradeSubmissionForMarketClosed({
        isMarketClosed: true,
        noConnectWallet: true,
        isRefreshQuote: false,
      }),
    ).toBe(false);
    expect(
      shouldBlockSwapTradeSubmissionForMarketClosed({
        isMarketClosed: true,
        noConnectWallet: false,
        isRefreshQuote: true,
      }),
    ).toBe(false);
  });
});
