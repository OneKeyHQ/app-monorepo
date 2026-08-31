import { prepareHyperLiquidKlineSource } from '@onekeyhq/kit/src/components/TradingView/TradingViewV2/components/tradingViewV2/hooks/hyperLiquidKlineSource';
import { prefetchTradingViewV2FirstScreenData } from '@onekeyhq/kit/src/components/TradingView/TradingViewV2/components/tradingViewV2/hooks/useTradingViewV2';

import {
  fetchMarketBasicConfigForPlatform,
  getCachedMarketBasicConfigForPlatform,
  getLastMarketBasicConfigForPlatform,
} from '../../hooks/useMarketBasicConfig/fetchMarketBasicConfigForPlatform';

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

const mockPrepareHyperLiquidKlineSource = jest.mocked(
  prepareHyperLiquidKlineSource,
);
const mockHydrateMarketTradingViewPreferences = jest.mocked(
  hydrateMarketTradingViewPreferences,
);
const mockStartMarketTradingViewSessionPreference = jest.mocked(
  startMarketTradingViewSessionPreference,
);
const mockPrefetchTradingViewV2FirstScreenData = jest.mocked(
  prefetchTradingViewV2FirstScreenData,
);
const mockFetchMarketBasicConfigForPlatform = jest.mocked(
  fetchMarketBasicConfigForPlatform,
);
const mockGetCachedMarketBasicConfigForPlatform = jest.mocked(
  getCachedMarketBasicConfigForPlatform,
);
const mockGetLastMarketBasicConfigForPlatform = jest.mocked(
  getLastMarketBasicConfigForPlatform,
);

describe('prefetchMarketDetailV2FirstScreenKLineData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCachedMarketBasicConfigForPlatform.mockReturnValue({
      data: {},
    } as ReturnType<typeof getCachedMarketBasicConfigForPlatform>);
    mockGetLastMarketBasicConfigForPlatform.mockReturnValue(undefined);
    mockPrepareHyperLiquidKlineSource.mockReturnValue({
      isHyperLiquidSource: false,
      symbol: undefined,
      isLoading: false,
    });
  });

  it('waits for preference hydration before capturing a session', async () => {
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
        kLineProvider: 'onekey',
      }),
    );
  });

  it('uses the Hyperliquid provider and symbol selected by market config', async () => {
    mockHydrateMarketTradingViewPreferences.mockResolvedValueOnce();
    mockPrepareHyperLiquidKlineSource.mockReturnValueOnce({
      isHyperLiquidSource: true,
      symbol: 'PURR',
      isLoading: false,
    });

    await prefetchMarketDetailV2FirstScreenKLineData({
      tokenAddress: '0xabc',
      networkId: 'evm--42161',
    });

    expect(mockStartMarketTradingViewSessionPreference).toHaveBeenCalledWith({
      tokenAddress: '0xabc',
      networkId: 'evm--42161',
      namespace: 'market-hyperliquid',
    });
    expect(mockPrefetchTradingViewV2FirstScreenData).toHaveBeenCalledWith(
      expect.objectContaining({
        kLineProvider: 'hyperliquid',
        kLineProviderSymbol: 'PURR',
      }),
    );
  });

  it('skips prefetch when the provider config is unavailable', async () => {
    mockGetCachedMarketBasicConfigForPlatform.mockReturnValue(undefined);
    mockGetLastMarketBasicConfigForPlatform.mockReturnValue(undefined);
    mockFetchMarketBasicConfigForPlatform.mockRejectedValueOnce(
      new Error('config unavailable'),
    );
    mockHydrateMarketTradingViewPreferences.mockResolvedValueOnce();

    await expect(
      prefetchMarketDetailV2FirstScreenKLineData({
        tokenAddress: '0xabc',
        networkId: 'evm--1',
      }),
    ).resolves.toBeUndefined();

    expect(mockStartMarketTradingViewSessionPreference).not.toHaveBeenCalled();
    expect(mockPrefetchTradingViewV2FirstScreenData).not.toHaveBeenCalled();
  });
});
