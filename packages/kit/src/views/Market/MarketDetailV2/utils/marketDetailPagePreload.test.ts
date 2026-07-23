import { prefetchTradingViewV2FirstScreenData } from '@onekeyhq/kit/src/components/TradingView/TradingViewV2/components/tradingViewV2/hooks/useTradingViewV2';

import { prefetchMarketDetailV2FirstScreenKLineData } from './marketDetailPagePreload';
import {
  hydrateMarketTradingViewPreferences,
  startMarketTradingViewSessionPreference,
} from './marketTradingViewResolutionPreference';

jest.mock(
  '@onekeyhq/kit/src/components/TradingView/TradingViewV2/components/tradingViewV2/hooks/hyperLiquidKlineSource',
  () => ({
    prepareHyperLiquidKlineSource: jest.fn(() => ({
      isHyperLiquidSource: false,
      symbol: undefined,
    })),
  }),
);

jest.mock(
  '@onekeyhq/kit/src/components/TradingView/TradingViewV2/components/tradingViewV2/hooks/useTradingViewV2',
  () => ({
    prefetchTradingViewV2FirstScreenData: jest.fn(() => Promise.resolve()),
  }),
);

jest.mock(
  '../../hooks/useMarketBasicConfig/fetchMarketBasicConfigForPlatform',
  () => ({
    fetchMarketBasicConfigForPlatform: jest.fn(),
    getCachedMarketBasicConfigForPlatform: jest.fn(() => ({ data: {} })),
    getLastMarketBasicConfigForPlatform: jest.fn(),
  }),
);

jest.mock('./marketTradingViewResolutionPreference', () => ({
  hydrateMarketTradingViewPreferences: jest.fn(),
  startMarketTradingViewSessionPreference: jest.fn(() => ({
    resolution: '4H',
  })),
}));

jest.mock('./marketTransactionsFirstPageCache', () => ({
  prefetchMarketTransactionsFirstPageWithCache: jest.fn(),
}));

const mockHydrateMarketTradingViewPreferences =
  hydrateMarketTradingViewPreferences as jest.MockedFunction<
    typeof hydrateMarketTradingViewPreferences
  >;
const mockStartMarketTradingViewSessionPreference =
  startMarketTradingViewSessionPreference as jest.MockedFunction<
    typeof startMarketTradingViewSessionPreference
  >;
const mockPrefetchTradingViewV2FirstScreenData =
  prefetchTradingViewV2FirstScreenData as jest.MockedFunction<
    typeof prefetchTradingViewV2FirstScreenData
  >;

describe('prefetchMarketDetailV2FirstScreenKLineData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('waits for the already-started preference hydration before capturing a session', async () => {
    let resolveHydration: (() => void) | undefined;
    mockHydrateMarketTradingViewPreferences.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveHydration = resolve;
      }),
    );

    const request = prefetchMarketDetailV2FirstScreenKLineData({
      tokenAddress: '0xabc',
      networkId: 'evm--1',
    });
    await Promise.resolve();

    expect(mockStartMarketTradingViewSessionPreference).not.toHaveBeenCalled();
    expect(mockPrefetchTradingViewV2FirstScreenData).not.toHaveBeenCalled();

    resolveHydration?.();
    await request;

    expect(mockStartMarketTradingViewSessionPreference).toHaveBeenCalledWith({
      tokenAddress: '0xabc',
      networkId: 'evm--1',
      namespace: 'market',
    });
    expect(mockPrefetchTradingViewV2FirstScreenData).toHaveBeenCalledWith(
      expect.objectContaining({
        interval: '4H',
      }),
    );
  });
});
