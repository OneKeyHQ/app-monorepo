/** @jest-environment jsdom */
import type { PropsWithChildren, ReactNode } from 'react';

import {
  act,
  isInaccessible,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { MarketBannerProvider } from '../components/MarketBanner/MarketBannerList';

import { DesktopLayout } from './DesktopLayout';

import type { IDesktopLayoutProps } from './DesktopLayout.types';

let mockRouteFocused = true;

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockRouteFocused,
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => mockRouteFocused,
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false, isWeb: true },
}));
jest.mock('@onekeyhq/components', () => {
  const { forwardRef } = jest.requireActual<typeof import('react')>('react');
  const Stack = forwardRef<
    HTMLDivElement,
    PropsWithChildren<{
      opacity?: number;
      testID?: string;
      'aria-hidden'?: boolean;
    }>
  >(function MockStack(
    { children, opacity, testID, 'aria-hidden': hidden },
    ref,
  ) {
    return (
      <div
        ref={ref}
        style={{ opacity }}
        data-testid={testID}
        aria-hidden={hidden}
      >
        {children}
      </div>
    );
  });
  return {
    s: (value: number) => value,
    XStack: Stack,
    YStack: Stack,
    TabBar: () => <span>Trending</span>,
    useMedia: () => ({ md: false }),
  };
});
jest.mock('@onekeyhq/kit/src/components/AppPager', () => ({
  AppPager: ({
    renderHeader,
    renderTabBar,
    pages,
    isRouteFocused,
  }: {
    renderHeader: () => ReactNode;
    renderTabBar: (props: object) => ReactNode;
    pages: { key: string; children: ReactNode }[];
    isRouteFocused: boolean;
  }) => (
    <div
      data-testid="modal-test-pager"
      data-active={String(isRouteFocused)}
      data-collapsible-pager-active={String(isRouteFocused)}
      style={
        {
          '--ok-collapsible-pager-header-inset': '0px',
          '--ok-collapsible-pager-sticky-inset': '0px',
        } as import('react').CSSProperties
      }
    >
      {renderHeader()}
      {renderTabBar({})}
      {pages.map((page) => (
        <div key={page.key}>{page.children}</div>
      ))}
    </div>
  ),
}));
jest.mock('./hooks', () => {
  const { useRef } = jest.requireActual<typeof import('react')>('react');
  return {
    useMarketTabsLogic: () => ({
      spotTabItems: [{ categoryId: 'trending', tabName: 'Trending' }],
      selectedTabName: 'Trending',
      getSpotCategoryIdByTabName: () => 'trending',
    }),
    useSyncedMarketTab: () => ({
      activeTabName: 'Trending',
      setActiveTabName: jest.fn(),
      tabsRef: useRef(null),
    }),
  };
});
jest.mock('./useMarketSubCategorySelection', () => ({
  useMarketSubCategorySelection: () => [undefined, jest.fn()],
}));
jest.mock('../../utils/marketPerf', () => ({ markMarketPerf: jest.fn() }));
jest.mock('../../utils/marketReactPerf', () => ({
  useMarketRenderCommitProbe: jest.fn(),
}));
jest.mock('../utils', () => ({
  getMarketCategoryTooltipId: () => undefined,
  isMarketStockCategoryById: () => false,
  isTrendingStyleSpotCategory: () => true,
  shouldHideSpotExtendedStats: () => false,
  shouldShowSpotNetworkSelector: () => false,
}));
jest.mock('../components/CompactNetworkSelector', () => ({
  CompactNetworkSelector: () => null,
}));
jest.mock('../components/TimeRangeDropdown', () => ({
  TimeRangeDropdown: () => null,
}));
jest.mock('../components/MarketTopCoinsList/MarketTopCoinsList', () => ({
  MarketTopCoinsList: () => null,
}));
jest.mock(
  '../components/MarketTokenList/MarketListLoadingFallback',
  () => ({}),
);
jest.mock('../components/MarketTokenList/MarketNormalTokenList', () => ({
  MarketNormalTokenList: ({
    enableWebSocket,
  }: {
    enableWebSocket: boolean;
  }) => (
    <div data-testid="modal-test-table" data-live={String(enableWebSocket)}>
      Token rows
    </div>
  ),
}));
jest.mock('../components/MarketBanner/useMarketBannerList', () => ({
  useMarketBannerList: () => ({
    bannerList: [],
    isLoading: false,
    isFetched: true,
    scope: 'en:false',
  }),
}));
jest.mock('../components/MarketBanner/useToMarketBannerDetail', () => ({
  useToMarketBannerDetail: () => jest.fn(),
}));
jest.mock('../components/MarketBanner/MarketBannerItem', () => ({
  MarketBannerItem: () => null,
}));
jest.mock('../components/MarketBanner/MarketBannerItemSkeleton', () => ({
  MarketBannerItemSkeleton: () => null,
}));
jest.mock('../components/MarketBanner/MarketBannerDesktopScroller', () => ({
  MarketBannerDesktopScroller: () => null,
}));

it('preserves the real desktop layout under a modal while pausing live quotes', async () => {
  const props: IDesktopLayoutProps = {
    isLayoutActive: true,
    selectedNetworkId: 'all',
    onTabChange: jest.fn(),
    filterBarProps: {
      selectedNetworkId: 'all',
      onNetworkIdChange: jest.fn(),
      selectedCategory: 'trending',
      categories: [{ id: 'trending', name: 'Trending' }],
      onCategoryChange: jest.fn(),
      timeRange: '1h',
      onTimeRangeChange: jest.fn(),
    },
  };
  const page = (isLayoutActive: boolean) => (
    <MarketBannerProvider>
      <DesktopLayout {...props} isLayoutActive={isLayoutActive} />
    </MarketBannerProvider>
  );
  const view = render(page(true));
  const table = screen.getByTestId('modal-test-table');
  await waitFor(() => expect(isInaccessible(table)).toBe(false));
  expect(table.getAttribute('data-live')).toBe('true');

  mockRouteFocused = false;
  await act(async () => view.rerender(page(true)));
  expect(isInaccessible(table)).toBe(false);
  expect(isInaccessible(screen.getByTestId('market-tabs'))).toBe(false);
  expect(
    screen.getByTestId('modal-test-pager').getAttribute('data-active'),
  ).toBe('true');
  expect(table.getAttribute('data-live')).toBe('false');

  await act(async () => view.rerender(page(false)));
  expect(isInaccessible(table)).toBe(true);
  expect(
    screen.getByTestId('modal-test-pager').getAttribute('data-active'),
  ).toBe('false');

  mockRouteFocused = true;
  await act(async () => view.rerender(page(true)));
  await waitFor(() => expect(isInaccessible(table)).toBe(false));
  expect(screen.getByTestId('modal-test-table')).toBe(table);
  expect(table.getAttribute('data-live')).toBe('true');
});
