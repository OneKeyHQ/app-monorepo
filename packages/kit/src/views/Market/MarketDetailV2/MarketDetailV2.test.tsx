/** @jest-environment jsdom */

import type { ComponentProps, PropsWithChildren } from 'react';
import { createContext, useContext } from 'react';

import { act, fireEvent, render } from '@testing-library/react';
import { createStore } from 'jotai';

import {
  ProviderJotaiContextMarketV2,
  networkIdAtom,
  tokenDetailAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes';
import type { IMarketAssetDetailData } from '@onekeyhq/shared/types/market';

import { MarketDetailV2 } from './MarketDetailV2';

const mockRouteContext = createContext('a');
const mockRefreshes = new Map<string, () => Promise<unknown>>();
const mockFetchAsset = jest.fn<Promise<IMarketAssetDetailData>, unknown[]>();
const mockSetSplitFullscreen = jest.fn();
let mockFocusedKey = 'a';
let mockRootLength = 1;

function MockProvider({ children }: PropsWithChildren) {
  return <>{children}</>;
}

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@react-navigation/elements', () => ({ useHeaderHeight: () => 0 }));
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => useContext(mockRouteContext) === mockFocusedKey,
  useFocusEffect: jest.fn(),
}));
jest.mock('@onekeyhq/components', () => ({
  Page: Object.assign(MockProvider, {
    Body: MockProvider,
    Header: () => null,
  }),
  Button: ({
    children,
    onPress,
  }: PropsWithChildren<{ onPress: () => void }>) => (
    <button type="button" onClick={onPress}>
      {children}
    </button>
  ),
  SizableText: MockProvider,
  YStack: MockProvider,
  useIsModalPage: () => false,
  useMedia: () => ({ gtLg: !platformEnv.isNative, md: false }),
  usePreventRemove: jest.fn(),
  rootNavigationRef: {
    current: {
      getCurrentRoute: () => ({ key: mockFocusedKey, name: 'MarketDetailV2' }),
    },
  },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isWeb: false, isNative: false, isExtension: true },
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  getRootRoutersLength: () => mockRootLength,
}));
jest.mock(
  '@onekeyhq/kit/src/provider/Container/TableSplitViewContainer',
  () => ({
    useSetSplitViewDetailFullscreen: () => mockSetSplitFullscreen,
  }),
);
jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: MockProvider,
}));
jest.mock('@onekeyhq/kit/src/provider/TradingViewEmbedGlobalPreload', () => ({
  TradingViewEmbedGlobalPreload: () => null,
}));
jest.mock('../MarketWatchListProviderMirrorV2', () => ({
  MarketWatchListProviderMirrorV2: MockProvider,
}));
jest.mock('../hooks', () => ({ useMarketEnterAnalytics: jest.fn() }));
jest.mock('../../Earn/hooks/useHeaderHeightCacheKey', () => ({
  useHeaderHeightCacheKey: () => 'test',
}));
jest.mock('../../Earn/hooks/useNativeStackHeaderHeightEstimate', () => ({
  useNativeStackHeaderHeightEstimate: () => 0,
}));
jest.mock('../../Earn/hooks/useSettledHeaderHeight', () => ({
  useSettledHeaderHeight: () => ({ paddingTop: 0, isSettled: true }),
}));
jest.mock('./components/MarketDetailHeader', () => ({
  MarketDetailHeader: () => <div data-testid="detail-header" />,
}));
jest.mock('./utils/marketDetailPagePreload', () => ({
  preloadMarketDetailV2BodyModules: jest.fn(),
}));
jest.mock('./hooks', () => ({
  ...jest.requireActual<typeof import('./hooks/useAutoRefreshTokenDetail')>(
    './hooks/useAutoRefreshTokenDetail',
  ),
  useTokenDetail: () => {
    const hooks = jest.requireActual<
      typeof import('@onekeyhq/kit/src/states/jotai/contexts/marketV2')
    >('@onekeyhq/kit/src/states/jotai/contexts/marketV2');
    const [tokenDetail] = hooks.useTokenDetailAtom();
    const [tokenDetailPreview] = hooks.useTokenDetailPreviewAtom();
    return { tokenDetail, tokenDetailPreview };
  },
  useStockDetail: () => ({ isStockRoute: false }),
  BtcMetadataProvider: MockProvider,
  StockDetailProvider: MockProvider,
}));
jest.mock('./hooks/useTokenDetail', () => ({
  useTokenDetail: () => ({
    tokenDetail: undefined,
    networkId: '',
    isLoading: false,
  }),
}));
jest.mock('./layouts/MarketDetailResponsiveLayout', () => ({
  MarketDetailResponsiveLayout: ({
    onChartFullscreenChange,
  }: {
    onChartFullscreenChange: (value: boolean) => void;
  }) => (
    <button type="button" onClick={() => onChartFullscreenChange(true)}>
      Fullscreen
    </button>
  ),
}));
jest.mock('@onekeyhq/kit/src/components/Currency', () => ({
  useCurrency: () => ({ id: 'usd' }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useLocaleVariant', () => ({
  useLocaleVariant: () => 'en-US',
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (factory: () => Promise<unknown>) => {
    mockRefreshes.set(useContext(mockRouteContext), factory);
    return { result: undefined, run: factory };
  },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarket: {
      fetchMarketAssetDetail: (...args: unknown[]) => mockFetchAsset(...args),
    },
    serviceHyperliquid: {
      resolveMarketPerpsInfoBySymbol: async () => undefined,
    },
  },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { app: { error: { log: jest.fn() } } },
}));

function assetDetail(assetId: string): IMarketAssetDetailData {
  return {
    about: '',
    asset: { assetId, name: assetId, symbol: assetId, logoUrl: '' },
    variants: [],
    selectedVariant: {
      variantId: `${assetId}-native`,
      networkId: assetId === 'doge' ? 'doge--0' : 'btc--0',
      tokenAddress: '',
      isNative: true,
      isDefault: true,
      networkName: '',
      networkSymbol: '',
      networkLogoUrl: '',
    },
    market: {
      price: '1',
      priceChange24h: '0',
      priceChange24hPercent: '0',
      marketCap: '1',
      marketCapRank: 1,
      volume24h: '1',
      circulatingSupply: '1',
      fdv: '1',
      totalSupply: '1',
      maxSupply: '1',
    },
    performance: {
      priceChange7dPercent: '0',
      price7dAgo: '1',
      priceChange30dPercent: '0',
      price30dAgo: '1',
      priceChange3mPercent: '0',
      price3mAgo: '1',
      priceChange1yPercent: '0',
      price1yAgo: '1',
      allTimeHighChangePercent: '0',
      allTimeHighPrice: '1',
    },
  };
}

function Detail({ routeKey, assetId }: { routeKey: string; assetId: string }) {
  const props: ComponentProps<typeof MarketDetailV2> = {
    navigation: {} as ComponentProps<typeof MarketDetailV2>['navigation'],
    route: {
      key: routeKey,
      name: ETabMarketRoutes.MarketDetailV2,
      params: { marketTokenId: assetId, marketTokenCategory: 'top_coins' },
    },
  };
  return (
    <mockRouteContext.Provider value={routeKey}>
      <MarketDetailV2 {...props} />
    </mockRouteContext.Provider>
  );
}

async function refresh(routeKey: string) {
  await act(async () => {
    await mockRefreshes.get(routeKey)?.();
  });
}

describe('MarketDetailV2 request ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRefreshes.clear();
    mockFocusedKey = 'a';
    mockRootLength = 1;
    Object.assign(platformEnv, {
      isWeb: false,
      isNative: false,
      isExtension: true,
    });
    mockFetchAsset.mockImplementation(async (payload) =>
      assetDetail((payload as { assetId: string }).assetId),
    );
  });

  it.each(['extension', 'native'])(
    'prevents a retained %s page from polling over a focused detail in the same store',
    async (platform) => {
      platformEnv.isNative = platform === 'native';
      const store = createStore();
      const pages = (showB: boolean) => (
        <ProviderJotaiContextMarketV2 store={store}>
          <Detail routeKey="a" assetId="doge" />
          {showB ? <Detail routeKey="b" assetId="bitcoin" /> : null}
        </ProviderJotaiContextMarketV2>
      );
      const view = render(pages(false));
      await refresh('a');
      expect(store.get(tokenDetailAtom())?.symbol).toBe('DOGE');

      // A stays mounted while another tab opens detail B in a modal.
      mockFocusedKey = 'b';
      mockRootLength = 2;
      view.rerender(pages(true));
      await refresh('b');
      expect(store.get(tokenDetailAtom())?.symbol).toBe('BITCOIN');
      const requestCount = mockFetchAsset.mock.calls.length;
      await refresh('a');
      expect(mockFetchAsset).toHaveBeenCalledTimes(requestCount);
      expect(store.get(tokenDetailAtom())?.symbol).toBe('BITCOIN');
      expect(store.get(networkIdAtom())).toBe('btc--0');
    },
  );

  it('restores the header when an Asset switch fails in fullscreen', async () => {
    platformEnv.isWeb = true;
    platformEnv.isExtension = false;
    const store = createStore();
    const page = (assetId: string) => (
      <ProviderJotaiContextMarketV2 store={store}>
        <Detail routeKey="a" assetId={assetId} />
      </ProviderJotaiContextMarketV2>
    );
    const view = render(page('doge'));
    await refresh('a');
    fireEvent.click(view.getByText('Fullscreen'));
    expect(view.queryByTestId('detail-header')).toBeNull();
    expect(mockSetSplitFullscreen).toHaveBeenLastCalledWith(true);

    view.rerender(page('bitcoin'));
    mockFetchAsset.mockRejectedValueOnce(new Error('offline'));
    await refresh('a');
    expect(view.getByTestId('detail-header')).toBeTruthy();
    expect(view.getByText('global.retry')).toBeTruthy();
    expect(mockSetSplitFullscreen).toHaveBeenLastCalledWith(false);
  });
});
