import { getStockMarketClosedDescription } from '@onekeyhq/kit/src/views/Market/components/StockMarketStatusAlert/getStockMarketClosedDescription';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import {
  EStockTradeAlertType,
  ESwapAlertLevel,
} from '@onekeyhq/shared/types/swap/types';

import {
  getStockErrorAlertLevel,
  getStockTradeAlertType,
  isCurrentStockQuoteEventError,
} from './SwapStockTradeAlertUtils';

const usdcToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xusdc',
  symbol: 'USDC',
  decimals: 6,
  isNative: false,
};

const appleStockToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xaapl',
  symbol: 'AAPL',
  decimals: 18,
  isNative: false,
  isStock: true,
};

describe('SwapStockTradeAlert utils', () => {
  it('keeps only the reopen time from a closed-market description', () => {
    expect(
      getStockMarketClosedDescription(
        '交易将在 1天 13 小时 16 分钟后开放\n\nOndo 的代币化证券支持 24/5 交易。',
      ),
    ).toBe('交易将在 1天 13 小时 16 分钟后开放');
  });

  it('trims empty lines before the reopen time', () => {
    expect(
      getStockMarketClosedDescription(
        '\n\r\n  Market reopens in 1D 13H 16M\r\n\r\nOndo supports 24/5 trading.',
      ),
    ).toBe('Market reopens in 1D 13H 16M');
  });

  it('does not show the stock mechanism explanation as a fallback', () => {
    expect(
      getStockMarketClosedDescription(
        "Ondo's tokenized securities support 24/5 trading.",
      ),
    ).toBeUndefined();
  });

  it('ignores stale Stock quote event errors for a previous amount', () => {
    expect(
      isCurrentStockQuoteEventError({
        fromToken: usdcToken,
        fromTokenAmount: '21',
        quoteEventError: {
          message: 'Min amount/request 10 USDC',
          fromToken: usdcToken,
          toToken: appleStockToken,
          fromTokenAmount: '2',
          isStock: true,
        },
        toToken: appleStockToken,
      }),
    ).toBe(false);
  });

  it('ignores stale Stock quote event errors after amount is cleared', () => {
    expect(
      isCurrentStockQuoteEventError({
        fromToken: usdcToken,
        fromTokenAmount: '0.0',
        quoteEventError: {
          message: 'Min amount/request 10 USDC',
          fromToken: usdcToken,
          toToken: appleStockToken,
          fromTokenAmount: '1',
          isStock: true,
        },
        toToken: appleStockToken,
      }),
    ).toBe(false);
  });

  it('matches current Stock quote event errors by numeric amount', () => {
    expect(
      isCurrentStockQuoteEventError({
        fromToken: usdcToken,
        fromTokenAmount: '2.0',
        quoteEventError: {
          message: 'Min amount/request 10 USDC',
          fromToken: usdcToken,
          toToken: appleStockToken,
          fromTokenAmount: '2',
          isStock: true,
        },
        toToken: appleStockToken,
      }),
    ).toBe(true);
  });

  it('keeps Stock min amount errors as warning alerts', () => {
    expect(
      getStockErrorAlertLevel({
        message: 'Min amount/request 10 USDC',
        notAvailableInRegionMessage: 'Not available in region',
      }),
    ).toBe(ESwapAlertLevel.WARNING);
  });

  it('keeps region errors as error alerts', () => {
    expect(
      getStockErrorAlertLevel({
        message: 'Not available in region',
        notAvailableInRegionMessage: 'Not available in region',
      }),
    ).toBe(ESwapAlertLevel.ERROR);
  });

  it('maps Stock alert messages to analytics alertType values', () => {
    expect(getStockTradeAlertType({ isMarketClosed: true })).toBe(
      EStockTradeAlertType.MARKET_CLOSED,
    );
    expect(
      getStockTradeAlertType({
        message: 'Min amount/request 10 USDC',
        notAvailableInRegionMessage: 'Not available in region',
      }),
    ).toBe(EStockTradeAlertType.MIN_AMOUNT);
    expect(
      getStockTradeAlertType({
        message: 'Price impact is too large. Please lower the amount.',
        notAvailableInRegionMessage: 'Not available in region',
      }),
    ).toBe(EStockTradeAlertType.MAX_AMOUNT);
    expect(
      getStockTradeAlertType({
        message: 'Not available in region',
        notAvailableInRegionMessage: 'Not available in region',
      }),
    ).toBe(EStockTradeAlertType.REGION_RESTRICTED);
    expect(
      getStockTradeAlertType({
        message: 'Unknown stock quote error',
        notAvailableInRegionMessage: 'Not available in region',
      }),
    ).toBe(EStockTradeAlertType.UNKNOWN);
    expect(
      getStockTradeAlertType({
        message: 'Provider temporarily unavailable',
        notAvailableInRegionMessage: 'Not available in region',
      }),
    ).toBe(EStockTradeAlertType.OTHER);
  });
});
