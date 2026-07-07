import {
  EProtocolOfExchange,
  EStockTradeAlertType,
  ESwapAnalyticsCategory,
  ESwapAnalyticsEnterFrom,
  ESwapSource,
  ESwapTabSwitchType,
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
