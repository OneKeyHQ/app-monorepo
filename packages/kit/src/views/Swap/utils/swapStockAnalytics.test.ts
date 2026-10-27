import {
  EProtocolOfExchange,
  EStockTradeAlertType,
  ESwapAnalyticsCategory,
  ESwapAnalyticsEnterFrom,
  ESwapSource,
  ESwapTabSwitchType,
  ESwapTradeSource,
} from '@onekeyhq/shared/types/swap/types';

import {
  SWAP_STOCK_ANALYTICS_ORDER_TYPE,
  SWAP_STOCK_ANALYTICS_TRADE_SIDE_BUY,
  SWAP_STOCK_ANALYTICS_TRADE_SIDE_SELL,
  getStockTradeAlertAnalyticsPayload,
  getStockTradeAnalyticsPayload,
  getSwapAnalyticsCategory,
  getSwapAnalyticsCategoryFromSwapType,
  getSwapAnalyticsEnterFrom,
  getSwapTradeSource,
  isRecentTokenPairOrder,
} from './swapStockAnalytics';

const payToken = {
  networkId: 'evm--56',
  contractAddress: '0xusdc',
  symbol: 'USDC',
};

const stockToken = {
  networkId: 'evm--56',
  contractAddress: '0xstock',
  symbol: 'AAPLon',
};

describe('swapStockAnalytics', () => {
  it('uses the Stock order type contract value', () => {
    expect(SWAP_STOCK_ANALYTICS_ORDER_TYPE).toBe(EProtocolOfExchange.STOCK);
  });

  it('maps quote and order categories to analytics contract values', () => {
    expect(
      getSwapAnalyticsCategory({
        protocol: EProtocolOfExchange.STOCK,
        fromNetworkId: 'evm--1',
        toNetworkId: 'evm--56',
      }),
    ).toBe(ESwapAnalyticsCategory.STOCK);
    expect(
      getSwapAnalyticsCategory({
        fromNetworkId: 'evm--1',
        toNetworkId: 'evm--56',
      }),
    ).toBe(ESwapAnalyticsCategory.BRIDGE);
    expect(getSwapAnalyticsCategoryFromSwapType(ESwapTabSwitchType.LIMIT)).toBe(
      ESwapAnalyticsCategory.LIMIT,
    );
    expect(
      getSwapAnalyticsCategoryFromSwapType(ESwapTabSwitchType.LIMIT, true),
    ).toBe(ESwapAnalyticsCategory.PRO);
  });

  it('maps build transaction owners to tradeSource values', () => {
    expect(
      getSwapTradeSource({
        protocol: EProtocolOfExchange.SWAP,
        isSwapPro: false,
      }),
    ).toBe(ESwapTradeSource.SWAP_BRIDGE);
    expect(
      getSwapTradeSource({
        protocol: EProtocolOfExchange.LIMIT,
        isSwapPro: true,
      }),
    ).toBe(ESwapTradeSource.SWAP_PRO);
    expect(
      getSwapTradeSource({
        protocol: EProtocolOfExchange.LIMIT,
        isSwapPro: false,
      }),
    ).toBe(ESwapTradeSource.LIMIT);
    expect(
      getSwapTradeSource({
        protocol: EProtocolOfExchange.STOCK,
        isSwapPro: false,
      }),
    ).toBe(ESwapTradeSource.STOCK);
    expect(
      getSwapTradeSource({
        protocol: EProtocolOfExchange.PRIVATE_SEND,
        isSwapPro: false,
      }),
    ).toBe(ESwapTradeSource.UNKNOWN);
    expect(ESwapTradeSource.PERPS).toBe('perps');
  });

  it('maps Swap source values to tradeCategorySwitch enterFrom values', () => {
    expect(getSwapAnalyticsEnterFrom(ESwapSource.WALLET_HOME)).toBe(
      ESwapAnalyticsEnterFrom.HOME_TAB,
    );
    expect(getSwapAnalyticsEnterFrom(ESwapSource.TOKEN_DETAIL)).toBe(
      ESwapAnalyticsEnterFrom.TOKEN_DETAIL,
    );
    expect(getSwapAnalyticsEnterFrom(ESwapSource.MARKET)).toBe(
      ESwapAnalyticsEnterFrom.MARKET,
    );
    expect(getSwapAnalyticsEnterFrom(ESwapSource.EARN)).toBe(
      ESwapAnalyticsEnterFrom.EARN,
    );
    expect(getSwapAnalyticsEnterFrom(ESwapSource.APPROVING_SUCCESS)).toBe(
      ESwapAnalyticsEnterFrom.OTHERS,
    );
  });

  it('infers Stock buy analytics payload from pay-to-stock tokens', () => {
    expect(
      getStockTradeAnalyticsPayload({
        protocol: EProtocolOfExchange.STOCK,
        fromToken: payToken,
        toToken: stockToken,
      }),
    ).toEqual({
      tradeSide: SWAP_STOCK_ANALYTICS_TRADE_SIDE_BUY,
      stockTokenSymbol: stockToken.symbol,
      stockTokenAddress: stockToken.contractAddress,
    });
  });

  it('normalizes Stock sell analytics payload', () => {
    expect(
      getStockTradeAnalyticsPayload({
        protocol: EProtocolOfExchange.STOCK,
        fromToken: stockToken,
        toToken: payToken,
        tradeSide: 'sell',
      }),
    ).toEqual({
      tradeSide: SWAP_STOCK_ANALYTICS_TRADE_SIDE_SELL,
      stockTokenSymbol: stockToken.symbol,
      stockTokenAddress: stockToken.contractAddress,
    });
  });

  it('normalizes Stock alert trade side', () => {
    expect(
      getStockTradeAlertAnalyticsPayload({
        alertType: EStockTradeAlertType.MARKET_CLOSED,
        tradeSide: 'buy',
        stockToken,
      }),
    ).toEqual({
      alertType: EStockTradeAlertType.MARKET_CLOSED,
      alertLevel: undefined,
      tradeDisabled: undefined,
      tradeSide: SWAP_STOCK_ANALYTICS_TRADE_SIDE_BUY,
      stockTokenSymbol: stockToken.symbol,
      stockTokenAddress: stockToken.contractAddress,
      network: stockToken.networkId,
    });
  });
});

describe('isRecentTokenPairOrder', () => {
  const eth = { networkId: 'evm--1', contractAddress: '' };
  const usdc = { networkId: 'evm--1', contractAddress: '0xA0b8' };
  const bnb = { networkId: 'evm--56', contractAddress: '' };

  it('flags an order that trades the picked recent pair', () => {
    expect(
      isRecentTokenPairOrder({
        recentSelection: { fromToken: eth, toToken: usdc },
        fromToken: eth,
        toToken: { ...usdc, contractAddress: '0xa0b8' },
      }),
    ).toBe(true);
  });

  it('does not flag orders without a recent pick', () => {
    expect(
      isRecentTokenPairOrder({
        recentSelection: undefined,
        fromToken: eth,
        toToken: usdc,
      }),
    ).toBe(false);
  });

  it('does not flag orders after the pair was reversed or changed', () => {
    const recentSelection = { fromToken: eth, toToken: usdc };
    expect(
      isRecentTokenPairOrder({
        recentSelection,
        fromToken: usdc,
        toToken: eth,
      }),
    ).toBe(false);
    expect(
      isRecentTokenPairOrder({ recentSelection, fromToken: eth, toToken: bnb }),
    ).toBe(false);
  });
});
