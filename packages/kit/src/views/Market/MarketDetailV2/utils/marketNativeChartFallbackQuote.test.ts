import type { ITradingViewNativeSource } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';

import { resolveMarketNativeChartFallbackQuoteEnabled } from './marketNativeChartFallbackQuote';

const marketSource: ITradingViewNativeSource = {
  kind: 'market',
  networkId: 'evm--1',
  tokenAddress: '0xabc',
  symbol: 'TOKEN',
  realtime: 'disabled',
};

const base = {
  active: true,
  isTradingViewNative: true,
  isNative: false,
  networkId: 'evm--1',
  tokenAddress: '0xabc',
  source: marketSource,
};

describe('resolveMarketNativeChartFallbackQuoteEnabled', () => {
  it.each([
    ['an active native market chart without websocket quotes', base, true],
    [
      'a native coin without a contract address',
      { ...base, tokenAddress: '', isNative: true },
      true,
    ],
    [
      'a chart with websocket quotes',
      { ...base, source: { ...marketSource, realtime: 'websocket' as const } },
      false,
    ],
    ['a retained route that lost ownership', { ...base, active: false }, false],
    [
      'a V2 chart with its own quote feed',
      { ...base, isTradingViewNative: false },
      false,
    ],
    [
      'a stock share chart',
      { ...base, source: { kind: 'stock' as const, stockId: 'AAPL' } },
      false,
    ],
    [
      'a Simple chart that still owns the quote',
      { ...base, isNativeChartMounted: false },
      false,
    ],
    ['a token without a network', { ...base, networkId: '' }, false],
  ])('resolves %s', (_name, params, expected) => {
    expect(resolveMarketNativeChartFallbackQuoteEnabled(params)).toBe(expected);
  });
});
