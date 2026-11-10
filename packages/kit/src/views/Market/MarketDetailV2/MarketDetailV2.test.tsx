/** @jest-environment jsdom */

import type { ComponentProps, PropsWithChildren } from 'react';
import { createContext, useContext } from 'react';

import { act, fireEvent, render } from '@testing-library/react';
import { createStore } from 'jotai';

import {
  ProviderJotaiContextMarketV2,
  useTokenDetailAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes';
import type { ITabMarketParamList } from '@onekeyhq/shared/src/routes';
import type {
  IMarketAssetDetailData,
  IMarketAssetVariant,
} from '@onekeyhq/shared/types/market';
import type { IMarketTokenDetailPreview } from '@onekeyhq/shared/types/marketV2';

import {
  MarketDetailV2,
  resolveMarketAssetTokenDetailPreview,
} from './MarketDetailV2';

const mockRouteContext = createContext('a');
const mockRefreshes = new Map<string, () => Promise<unknown>>();
const mockFetchAsset = jest.fn<Promise<IMarketAssetDetailData>, unknown[]>();
const mockFetchTokenInfoOnly = jest.fn<Promise<unknown>, unknown[]>();
const mockSetSplitFullscreen = jest.fn();
const mockLayoutProps = new Map<string, Record<string, unknown>>();
let mockFocusedKey = 'a';
let mockRootLength = 1;

function MockProvider({ children }: PropsWithChildren) {
  return <>{children}</>;
}

function mockNavigation() {
  return {
    addListener: jest.fn(() => jest.fn()),
    dispatch: jest.fn(),
    setOptions: jest.fn(),
    setParams: jest.fn(),
  } as unknown as ComponentProps<typeof MarketDetailV2>['navigation'];
}

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('react-native', () => ({
  useWindowDimensions: () => ({ width: 1280, height: 800 }),
}));
jest.mock('@react-navigation/elements', () => ({ useHeaderHeight: () => 0 }));
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => useContext(mockRouteContext) === mockFocusedKey,
  useFocusEffect: jest.fn(),
  useNavigationState: (selector: (state: { index: number }) => unknown) =>
    selector({ index: 1 }),
  useNavigation: () => ({
    addListener: jest.fn(() => jest.fn()),
    dispatch: jest.fn(),
    isFocused: () => true,
  }),
}));
jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Provider = ({ children }: PropsWithChildren) => (
    <React.Fragment>{children}</React.Fragment>
  );
  const Page = Object.assign(Provider, {
    Body: Provider,
    Header: () => null,
  });
  return {
    Button: ({
      children,
      onPress,
    }: PropsWithChildren<{ onPress: () => void }>) => (
      <button type="button" onClick={onPress}>
        {children}
      </button>
    ),
    HeaderScrollGestureContext: React.createContext({
      gestures: [],
      excludeStartEdgeWidth: 0,
    }),
    Page,
    SizableText: Provider,
    Stack: Provider,
    rootNavigationRef: { current: undefined },
    useIsModalPage: () => false,
    useIsOverlayPage: () => false,
    useMedia: () => ({ gtLg: !platformEnv.isNative, md: false }),
    usePreventRemove: jest.fn(),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    useSplitSubView: () => false,
  };
});
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isWeb: false, isNative: false, isExtension: true },
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  getRootRoutersLength: () => mockRootLength,
  useRouteIsFocused: () => true,
  useRouteIsFocusedWhenEnabled: () => true,
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
jest.mock('../../../components/AccountSelector', () => ({
  AccountSelectorProviderMirror: MockProvider,
}));
jest.mock('../../../provider/TradingViewEmbedGlobalPreload', () => ({
  TradingViewEmbedGlobalPreload: () => null,
}));
jest.mock('../hooks', () => ({ useMarketEnterAnalytics: jest.fn() }));
jest.mock('../MarketWatchListProviderMirrorV2', () => ({
  MarketWatchListProviderMirrorV2: MockProvider,
}));
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
jest.mock('./hooks/MarketSimpleChartRangeChangeContext', () => ({
  MarketSimpleChartRangeChangeProvider: MockProvider,
}));
jest.mock('./hooks/useMarketDetailBackNavigation', () => ({
  useSwapStockBackTrip: jest.fn(),
}));
jest.mock('./hooks/useMarketDetailChartMode', () => ({
  useMarketDetailChartMode: () => ({
    isTradingViewNative: true,
    toggleChartMode: jest.fn(),
  }),
}));
jest.mock('./hooks/useMarketDetailTabBarVisibility', () => ({
  useMarketDetailTabBarVisibility: jest.fn(),
}));
jest.mock('./hooks/useTokenDetail', () => ({
  useTokenDetail: () => ({
    tokenDetail: undefined,
    networkId: '',
    isLoading: false,
  }),
}));
jest.mock('./hooks', () => ({
  ...jest.requireActual<typeof import('./hooks/useAutoRefreshTokenDetail')>(
    './hooks/useAutoRefreshTokenDetail',
  ),
  BtcMetadataProvider: MockProvider,
  StockDetailProvider: MockProvider,
  useStockDetail: () => ({ isStockRoute: false }),
}));
jest.mock('./layouts/MarketDetailResponsiveLayout', () => ({
  MarketDetailResponsiveLayout: (layoutProps: Record<string, unknown>) => {
    mockLayoutProps.set(useContext(mockRouteContext), layoutProps);
    const onChartFullscreenChange = layoutProps.onChartFullscreenChange as (
      value: boolean,
    ) => void;
    return (
      <button
        type="button"
        onClick={() => onChartFullscreenChange(true)}
        data-testid="detail-layout"
      >
        Fullscreen
      </button>
    );
  },
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
      fetchMarketAssetList: async () => ({ list: [], total: 0 }),
    },
    serviceHyperliquid: {
      resolveMarketPerpsInfoBySymbol: async () => undefined,
    },
    serviceToken: {
      fetchTokenInfoOnly: (...args: unknown[]) =>
        mockFetchTokenInfoOnly(...args),
    },
  },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { app: { error: { log: jest.fn() } } },
}));

const nativeVariant: IMarketAssetVariant = {
  variantId: 'bitcoin-btc--0-native',
  networkId: 'btc--0',
  tokenAddress: '',
  networkName: 'Bitcoin',
  networkSymbol: 'BTC',
  networkLogoUrl: '',
  isNative: true,
  isDefault: true,
};

const contractVariant: IMarketAssetVariant = {
  variantId: 'bitcoin-evm--1-0xbtc',
  networkId: 'evm--1',
  tokenAddress: '0xBtc',
  networkName: 'Ethereum',
  networkSymbol: 'ETH',
  networkLogoUrl: '',
  isNative: false,
  isDefault: true,
};

function assetDetail(
  assetId: string,
  variant: IMarketAssetVariant = assetId === 'bitcoin'
    ? nativeVariant
    : {
        ...nativeVariant,
        variantId: `${assetId}-native`,
        networkId: assetId === 'doge' ? 'doge--0' : 'btc--0',
      },
): IMarketAssetDetailData {
  return {
    about: '',
    asset: { assetId, name: assetId, symbol: assetId, logoUrl: '' },
    variants: [],
    selectedVariant: variant,
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

function TokenDetailProbe() {
  const [tokenDetail] = useTokenDetailAtom();
  return (
    <div data-testid="token-detail">
      {`${tokenDetail?.name ?? 'none'}:${
        tokenDetail?.decimals ?? 'none'
      }:${String(tokenDetail?.decimalsResolved)}`}
    </div>
  );
}

function Detail({
  routeKey,
  params,
}: {
  routeKey: string;
  params: ITabMarketParamList[ETabMarketRoutes.MarketDetailV2];
}) {
  const props: ComponentProps<typeof MarketDetailV2> = {
    navigation: mockNavigation(),
    route: {
      key: routeKey,
      name: ETabMarketRoutes.MarketDetailV2,
      params,
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

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('MarketDetailV2 asset detail recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRefreshes.clear();
    mockLayoutProps.clear();
    mockFocusedKey = 'a';
    mockRootLength = 1;
    Object.assign(platformEnv, {
      isWeb: false,
      isNative: false,
      isExtension: true,
    });
    mockFetchAsset.mockImplementation(async (payload) => {
      const { assetId } = payload as { assetId: string };
      return assetDetail(assetId);
    });
  });

  it('restores the header when an Asset switch fails in fullscreen', async () => {
    platformEnv.isWeb = true;
    platformEnv.isExtension = false;
    const store = createStore();
    const page = (assetId: string) => (
      <ProviderJotaiContextMarketV2 store={store}>
        <Detail
          routeKey="a"
          params={{
            marketTokenId: assetId,
            marketTokenCategory: 'top_coins',
          }}
        />
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

  it('only lets the focused detail own shared detail state', async () => {
    platformEnv.isWeb = true;
    platformEnv.isExtension = false;
    const store = createStore();
    const page = () => (
      <ProviderJotaiContextMarketV2 store={store}>
        <TokenDetailProbe />
        <Detail
          routeKey="a"
          params={{ marketTokenId: 'doge', marketTokenCategory: 'top_coins' }}
        />
        <Detail
          routeKey="b"
          params={{
            marketTokenId: 'bitcoin',
            marketTokenCategory: 'top_coins',
          }}
        />
      </ProviderJotaiContextMarketV2>
    );
    const view = render(page());
    await refresh('a');
    expect(view.getByTestId('token-detail').textContent).toContain('doge');

    // Another detail opens above the retained one: 'a' is still mounted but
    // hidden, so only 'b' may poll and write the shared detail atoms.
    mockFocusedKey = 'b';
    mockRootLength = 2;
    view.rerender(page());
    expect(mockLayoutProps.get('a')).toEqual(
      expect.objectContaining({ active: false }),
    );
    expect(mockLayoutProps.get('b')).toEqual(
      expect.objectContaining({ active: true }),
    );

    mockFetchAsset.mockClear();
    await refresh('b');
    expect(view.getByTestId('token-detail').textContent).toContain('bitcoin');

    // The hidden route's polling must not steal the focused asset again.
    const callsAfterFocus = mockFetchAsset.mock.calls.length;
    await refresh('a');
    expect(mockFetchAsset).toHaveBeenCalledTimes(callsAfterFocus);
    expect(view.getByTestId('token-detail').textContent).toContain('bitcoin');
  });

  it('tops up precision instead of trusting a placeholder preview for an asset-only route', async () => {
    platformEnv.isWeb = true;
    platformEnv.isExtension = false;
    const store = createStore();
    const placeholderPreview: IMarketTokenDetailPreview = {
      address: '',
      networkId: '',
      isNative: false,
      name: 'Bitcoin',
      symbol: 'BTC',
      decimals: 0,
      price: 1,
      selectedAt: 1,
    };
    mockFetchAsset.mockResolvedValue(assetDetail('bitcoin', contractVariant));
    let resolveTokenInfo: (value: unknown) => void = () => undefined;
    mockFetchTokenInfoOnly.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveTokenInfo = resolve;
        }),
    );
    const view = render(
      <ProviderJotaiContextMarketV2 store={store}>
        <TokenDetailProbe />
        <Detail
          routeKey="a"
          params={{
            marketTokenId: 'bitcoin',
            marketTokenCategory: 'top_coins',
            legacyTokenPreview: placeholderPreview,
          }}
        />
      </ProviderJotaiContextMarketV2>,
    );
    await refresh('a');
    // The placeholder's decimals (0) must not be treated as resolved precision;
    // the token metadata request has to top it up.
    expect(mockFetchTokenInfoOnly).toHaveBeenCalledWith({
      networkId: 'evm--1',
      tokenAddress: '0xBtc',
    });
    expect(view.getByTestId('token-detail').textContent).toContain(':false');

    await act(async () => {
      resolveTokenInfo({ info: { decimals: 18 } });
      await Promise.resolve();
    });
    await flushPromises();
    expect(view.getByTestId('token-detail').textContent).toContain('18:true');
  });
});

describe('resolveMarketAssetTokenDetailPreview', () => {
  const identity = {
    isNative: false,
    networkId: 'evm--1',
    tokenAddress: '0xBtc',
  };
  const buildPreview = (
    overrides: Partial<IMarketTokenDetailPreview>,
  ): IMarketTokenDetailPreview => ({
    address: '',
    networkId: '',
    isNative: false,
    name: 'Bitcoin',
    symbol: 'BTC',
    decimals: 0,
    selectedAt: 1,
    ...overrides,
  });

  it('does not re-target a placeholder preview that has no chain identity', () => {
    const placeholder = buildPreview({ decimals: 0 });
    expect(
      resolveMarketAssetTokenDetailPreview({ preview: placeholder, identity }),
    ).toBe(placeholder);
  });

  it('re-targets a preview that already carries the chain identity', () => {
    const preview = buildPreview({
      address: '0xOld',
      networkId: 'evm--1',
      decimals: 8,
    });
    expect(resolveMarketAssetTokenDetailPreview({ preview, identity })).toEqual(
      {
        ...preview,
        address: '0xBtc',
        networkId: 'evm--1',
        isNative: false,
      },
    );
  });
});
