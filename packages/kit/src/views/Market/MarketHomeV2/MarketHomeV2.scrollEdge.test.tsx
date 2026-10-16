/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { act, render } from '@testing-library/react';

import { MarketHomeV2, MarketHomeWithProvider } from './MarketHomeV2';

let mockBannerLoading = true;
let mockCategoryLoading = false;
let mockSplitViewType: 'main' | 'sub' | undefined;
let mockIsSplitView = false;
const mockSetSelection = jest.fn();
const mockActions = { current: { refreshWatchListV2: jest.fn() } };
let mockLayoutProps:
  | { externalTopOverlayTag?: number; externalTopOverlayHeight?: number }
  | undefined;
let mockHeaderLayout:
  | ((event: {
      nativeEvent: { target: number; layout: { height: number } };
    }) => void)
  | undefined;
let mockHeaderNode: HTMLDivElement | null = null;
let mockNextTag = 200;
const mockTags = new WeakMap<object, number>();
let mockSearchInputProps: Record<string, unknown> | undefined;

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('react-native', () => ({
  StyleSheet: { create: (styles: object) => styles },
  findNodeHandle: (view: object | null) => (view ? mockTags.get(view) : null),
}));
jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Wrapper = ({ children }: PropsWithChildren) => <div>{children}</div>;
  return {
    ESplitViewType: {
      MAIN: 'main',
      SUB: 'sub',
    },
    Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
    Page: Object.assign(Wrapper, {
      Header: () => null,
      Body: Wrapper,
    }),
    DelayedFreeze: Wrapper,
    XStack: Wrapper,
    isLiquidGlassAvailable: () => true,
    isNativeTablet: () => false,
    useIsSplitView: () => mockIsSplitView,
    useSplitViewType: () => mockSplitViewType,
    useSafeAreaInsets: () => ({ top: 44 }),
    useMedia: () => ({ md: false }),
    YStack: React.forwardRef<
      HTMLDivElement,
      PropsWithChildren<{ pt?: number; onLayout?: typeof mockHeaderLayout }>
    >(({ children, pt, onLayout }, ref) => {
      if (onLayout) {
        mockHeaderLayout = onLayout;
      }
      const handleRef = React.useCallback(
        (node: HTMLDivElement | null) => {
          if (ref) {
            mockHeaderNode = node;
            if (node && !mockTags.has(node)) {
              mockNextTag += 1;
              mockTags.set(node, mockNextTag);
            }
          }
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        },
        [ref],
      );
      return (
        <div ref={handleRef} data-padding-top={pt}>
          {children}
        </div>
      );
    }),
  };
});
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
jest.mock(
  '../../../components/TabPageHeader/LegacyUniversalSearchInput',
  () => ({
    LegacyUniversalSearchInput: (props: Record<string, unknown>) => {
      mockSearchInputProps = props;
      return <span data-testid="market-search-input" />;
    },
  }),
);
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

it('renders the standalone native Market search header and forwards its measured overlay geometry to MobileLayout', () => {
  mockBannerLoading = false;
  mockCategoryLoading = false;
  mockSplitViewType = undefined;
  mockIsSplitView = false;
  mockLayoutProps = undefined;
  mockSearchInputProps = undefined;

  const screen = render(<MarketHomeV2 />);
  expect(screen.getByTestId('market-search-input')).toBeTruthy();
  expect(mockSearchInputProps).toMatchObject({
    initialTab: 'market',
    tabRoute: 'Market',
    glass: true,
  });

  const headerTag = mockTags.get(mockHeaderNode as object) as number;
  expect(headerTag).toBeGreaterThan(200);
  act(() => {
    mockHeaderLayout?.({
      nativeEvent: { target: headerTag, layout: { height: 108 } },
    });
  });

  expect(mockLayoutProps).toMatchObject({
    externalTopOverlayTag: headerTag,
    externalTopOverlayHeight: 108,
  });
});

it('controls tablet split-view panes across landscape entry, detail back return, and portrait/landscape rotation', () => {
  mockBannerLoading = false;
  mockCategoryLoading = false;

  // 1. Landscape entry on MAIN pane: renders interactive search bar and market list
  mockIsSplitView = true;
  mockSplitViewType = 'main';
  const mainScreen = render(<MarketHomeV2 />);
  expect(mainScreen.getByTestId('market-search-input')).toBeTruthy();
  expect(mainScreen.getByTestId('pager')).toBeTruthy();
  expect(mainScreen.queryByTestId('icon-OnekeyLogoMonoIllus')).toBeNull();
  mainScreen.unmount();

  // 2. Landscape entry or detail back-return on SUB pane: renders placeholder instead of duplicate list
  mockIsSplitView = true;
  mockSplitViewType = 'sub';
  const subScreen = render(<MarketHomeV2 />);
  expect(subScreen.getByTestId('icon-OnekeyLogoMonoIllus')).toBeTruthy();
  expect(subScreen.queryByTestId('market-search-input')).toBeNull();
  expect(subScreen.queryByTestId('pager')).toBeNull();

  // 3. Rotate to portrait on SUB pane: placeholder is replaced by full Market home
  mockIsSplitView = false;
  subScreen.rerender(<MarketHomeV2 />);
  expect(subScreen.queryByTestId('icon-OnekeyLogoMonoIllus')).toBeNull();
  expect(subScreen.getByTestId('market-search-input')).toBeTruthy();
  expect(subScreen.getByTestId('pager')).toBeTruthy();

  // 4. Rotate back to landscape on SUB pane: returns to placeholder
  mockIsSplitView = true;
  subScreen.rerender(<MarketHomeV2 />);
  expect(subScreen.getByTestId('icon-OnekeyLogoMonoIllus')).toBeTruthy();
  expect(subScreen.queryByTestId('market-search-input')).toBeNull();
  expect(subScreen.queryByTestId('pager')).toBeNull();
  subScreen.unmount();

  // 5. Portrait on MAIN pane: returns null so only SUB renders Market home
  mockIsSplitView = false;
  mockSplitViewType = 'main';
  const portraitMainScreen = render(<MarketHomeV2 />);
  expect(portraitMainScreen.queryByTestId('market-search-input')).toBeNull();
  expect(portraitMainScreen.queryByTestId('pager')).toBeNull();
  expect(
    portraitMainScreen.queryByTestId('icon-OnekeyLogoMonoIllus'),
  ).toBeNull();
});
