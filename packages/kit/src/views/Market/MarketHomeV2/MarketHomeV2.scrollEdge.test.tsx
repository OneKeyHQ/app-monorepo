/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { render } from '@testing-library/react';

import { MarketHomeWithProvider } from './MarketHomeV2';

let mockBannerLoading = true;
let mockCategoryLoading = false;
const mockSetSelection = jest.fn();
const mockActions = { current: { refreshWatchListV2: jest.fn() } };
let mockLayoutProps:
  | { externalTopOverlayTag?: number; externalTopOverlayHeight?: number }
  | undefined;

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => ({
  useMedia: () => ({ md: false }),
  YStack: ({ children, pt }: PropsWithChildren<{ pt?: number }>) => (
    <div data-padding-top={pt}>{children}</div>
  ),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  isNative: true,
  isNativeIOS: true,
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  EJotaiContextStoreNames: {},
  useMarketSelectedTabAtom: () => [
    {
      tab: 'trending',
      selectedSpotCategory: mockCategoryLoading ? 'missing' : undefined,
    },
    mockSetSelection,
  ],
}));
jest.mock('@onekeyhq/shared/src/config/networkIds', () => ({
  getNetworkIdsMap: () => ({ onekeyall: 'all' }),
}));
jest.mock('@onekeyhq/shared/src/performance/init', () => ({
  debugLandingLog: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { market: { navigation: {} } },
}));
jest.mock('../../../components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({ children }: PropsWithChildren) => children,
}));
jest.mock('../../../components/LazyPageContainer', () => ({
  LazyPageContainer: ({ children }: PropsWithChildren) => children,
}));
jest.mock('../../../components/TabPageHeader', () => ({
  TabPageHeader: () => null,
}));
jest.mock('../../../states/jotai/contexts/marketV2', () => ({
  useWatchListV2Actions: () => mockActions,
}));
jest.mock('../hooks', () => ({
  useMarketBasicConfig: () => ({
    spotCategories: [],
    stockCategories: [],
    assetCategories: [],
    networkList: [],
    isLoading: mockCategoryLoading,
  }),
}));
jest.mock('../hooks/marketNetworkUtils', () => ({
  resolveMarketHomeNetworkSelection: () => 'all',
}));
jest.mock('../hooks/useMarketEnterAnalytics', () => ({
  useMarketHomePageEnterAnalytics: jest.fn(),
}));
jest.mock('../MarketWatchListProviderMirrorV2', () => ({
  MarketWatchListProviderMirrorV2: ({ children }: PropsWithChildren) =>
    children,
}));
jest.mock('../utils/marketHomeTokenListSeed', () => ({
  preloadMarketHomeTokenListSeed: jest.fn(),
}));
jest.mock('../utils/marketPerf', () => ({ markMarketPerf: jest.fn() }));
jest.mock('../utils/marketReactPerf', () => ({
  useMarketRenderCommitProbe: jest.fn(),
}));
jest.mock('./components/MarketBanner/MarketBannerList', () => ({
  MarketBannerProvider: ({ children }: PropsWithChildren) => children,
  useMarketBannerState: () => ({ isLoading: mockBannerLoading }),
}));
jest.mock('./components/MarketHomeLoadingFallback', () => ({
  MarketHomeLoadingFallback: () => <span data-testid="loading" />,
}));
jest.mock('./hooks', () => ({
  useNetworkAnalytics: () => ({}),
  useTabAnalytics: () => ({}),
}));
jest.mock('./hooks/useMarketHomeSelection', () => ({
  useMarketHomeSelection: (_key: string, fallback: string) => [
    fallback,
    mockSetSelection,
  ],
}));
jest.mock('./layouts/DesktopLayout', () => ({ DesktopLayout: () => null }));
jest.mock('./layouts/MobileLayout', () => ({
  MobileLayout: (props: typeof mockLayoutProps) => {
    mockLayoutProps = props;
    return <span data-testid="pager" />;
  },
}));
jest.mock('./utils', () => ({
  ensureMarketTopCoinsCategory: () => [],
  getMarketHomeFallbackSpotCategories: () => [],
  isMarketStockCategory: () => false,
}));

it.each(['banner', 'category'])(
  'reserves the external header during %s loading and passes geometry to the ready layout',
  (kind) => {
    mockBannerLoading = kind === 'banner';
    mockCategoryLoading = kind === 'category';
    const screen = render(
      <MarketHomeWithProvider
        externalTopOverlayTag={123}
        externalTopOverlayHeight={96}
        nestedPager
      />,
    );
    expect(
      screen
        .getByTestId('loading')
        .parentElement?.getAttribute('data-padding-top'),
    ).toBe('96');
    mockBannerLoading = false;
    mockCategoryLoading = false;
    screen.rerender(
      <MarketHomeWithProvider
        externalTopOverlayTag={123}
        externalTopOverlayHeight={96}
        nestedPager
      />,
    );
    expect(screen.queryByTestId('loading')).toBeNull();
    expect(screen.getByTestId('pager')).toBeTruthy();
    expect(mockLayoutProps).toMatchObject({
      externalTopOverlayTag: 123,
      externalTopOverlayHeight: 96,
    });
  },
);
