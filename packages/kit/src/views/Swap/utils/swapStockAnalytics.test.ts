import { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';

import {
  SWAP_STOCK_ANALYTICS_ORDER_TYPE,
  SWAP_STOCK_ANALYTICS_TRADE_SIDE_BUY,
  SWAP_STOCK_ANALYTICS_TRADE_SIDE_SELL,
  getStockTradeAlertAnalyticsPayload,
  getStockTradeAnalyticsPayload,
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
        alertType: 'marketClosed',
        tradeSide: 'buy',
        stockToken,
      }),
    ).toEqual({
      alertType: 'marketClosed',
      alertLevel: undefined,
      tradeDisabled: undefined,
      tradeSide: SWAP_STOCK_ANALYTICS_TRADE_SIDE_BUY,
      stockTokenSymbol: stockToken.symbol,
      stockTokenAddress: stockToken.contractAddress,
      network: stockToken.networkId,
    });
  });
});
