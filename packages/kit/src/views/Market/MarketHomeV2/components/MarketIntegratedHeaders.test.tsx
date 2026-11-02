/** @jest-environment jsdom */
import type { ComponentProps, ReactNode } from 'react';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { DesktopStickyHeaderContext } from '../layouts/DesktopStickyHeaderContext';

import { MarketPerpsTokenList } from './MarketPerpsList/MarketPerpsTokenList';
import { MarketStockList } from './MarketStockList/MarketStockList';
import { MarketTokenListBase } from './MarketTokenList/MarketTokenListBase';
import { MarketTopCoinsList } from './MarketTopCoinsList/MarketTopCoinsList';

const mockColumns = [
  { title: 'Name', dataIndex: 'name' },
  { title: 'Price', dataIndex: 'price' },
  { title: 'Change', dataIndex: 'change24h' },
];
const mockRows = [
  {
    id: 'low',
    name: 'low',
    stockId: 'low',
    assetId: 'low',
    price: '1',
    markPrice: '1',
    change24h: '1',
  },
  {
    id: 'high',
    name: 'high',
    stockId: 'high',
    assetId: 'high',
    price: '2',
    markPrice: '2',
    change24h: '2',
  },
];
let mockWidth = 375;
const mockSetSorting = jest.fn();
const mockNoop = jest.fn();

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  type Column = { title: ReactNode; dataIndex: string };
  type HeaderProps = {
    columns: Column[];
    onHeaderRow?: (
      column: Column,
      index: number,
    ) => { onSortTypeChange?: (order: 'desc') => void } | undefined;
  };
  // Keep business callbacks/state real; only replace the Table presentation boundary.
  const HeaderRow = ({ columns, onHeaderRow }: HeaderProps) => (
    <div role="row">
      {columns.map((column, index) => (
        <button
          key={column.dataIndex}
          role="columnheader"
          data-column={column.dataIndex}
          onClick={() =>
            onHeaderRow?.(column, index)?.onSortTypeChange?.('desc')
          }
        >
          {column.title}
        </button>
      ))}
    </div>
  );
  const Box = React.forwardRef<
    HTMLDivElement,
    { children?: ReactNode; testID?: string }
  >(({ children, testID }, ref) => (
    <div ref={ref} data-testid={testID}>
      {children}
    </div>
  ));
  Box.displayName = 'TestBox';
  const Table = Object.assign(
    ({ showHeader = true, ...props }: HeaderProps & { showHeader?: boolean }) =>
      showHeader ? <HeaderRow {...props} /> : null,
    { HeaderRow, Skeleton: () => null },
  );
  return {
    Stack: Box,
    XStack: Box,
    YStack: Box,
    SizableText: Box,
    NumberSizeableText: Box,
    Button: Box,
    Spinner: () => null,
    Skeleton: () => null,
    ListEndIndicator: () => null,
    Table,
    useMedia: () => ({ md: mockWidth <= 767 }),
    useScrollContentTabBarOffset: () => 0,
  };
});
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false, isWeb: true },
}));
jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: new Proxy({}, { get: (_target, key) => key }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useThemeVariant', () => ({
  useThemeVariant: () => 'light',
}));
jest.mock('@onekeyhq/kit/src/components/Token', () => ({ Token: () => null }));
jest.mock('../../components/PriceChangePercentage', () => ({
  PriceChangePercentage: () => null,
}));
jest.mock('../../components/SparklineChart', () => ({
  __esModule: true,
  default: () => null,
  MARKET_SPARKLINE_COLORS: { light: {}, dark: {} },
}));
jest.mock('./MarketTopCoinsList/MarketTopCoinStar', () => ({
  MarketTopCoinStar: () => null,
}));
jest.mock('./MarketTokenList/MarketStockCategorySelector', () => ({
  MarketStockCategorySelector: () => <div>Categories</div>,
}));
jest.mock('./MarketPerpsList/MarketPerpsCategorySelector', () => ({
  MarketPerpsCategorySelector: () => <div>Categories</div>,
}));
jest.mock('./MarketHoverRevealLine', () => ({
  MARKET_TOKEN_ROW_GROUP_NAME: 'row',
}));
jest.mock('./useMarketDesktopResponsiveColumns', () => ({
  useMarketDesktopResponsiveColumns: ({ columns }: { columns: unknown[] }) => ({
    columns,
    handleContainerLayout: mockNoop,
  }),
}));
jest.mock('./MarketNativeList/WebMarketTokenList', () => {
  const List = ({
    items,
    data,
  }: {
    items?: typeof mockRows;
    data?: typeof mockRows;
  }) => (
    <div data-testid="web-rows">
      {(items ?? data ?? [])
        .map((item) => item.id ?? item.assetId ?? item.name)
        .join(',')}
    </div>
  );
  return {
    WebMarketStockList: List,
    WebMarketPerpsList: List,
    WebMarketTopCoinsList: List,
    WebMarketTokenList: List,
  };
});
jest.mock('./MarketStockList/hooks/useMarketStockList', () => ({
  useMarketStockList: () => ({
    items: mockRows,
    isLoading: false,
    canLoadMore: false,
    setSorting: mockSetSorting,
  }),
}));
jest.mock('./MarketStockList/hooks/useToMarketStockDetailPage', () => ({
  useToMarketStockDetailPage: () => mockNoop,
}));
jest.mock('./MarketStockList/useMarketStockColumns', () => ({
  useMarketStockColumns: () => mockColumns,
}));
jest.mock('../../hooks/usePerpsNavigation', () => ({
  usePerpsNavigation: () => ({ navigateToPerps: mockNoop }),
}));
jest.mock('./MarketPerpsList/hooks/useMarketPerpsTokenList', () => ({
  useMarketPerpsTokenList: () => ({ tokens: mockRows, isLoading: false }),
}));
jest.mock('./MarketPerpsList/hooks/usePerpsColumns', () => ({
  usePerpsColumns: () => mockColumns,
}));
jest.mock('./MarketPerpsList/hooks/useSyncedMarketPerpsCategory', () => ({
  useSyncedMarketPerpsCategory: () => ({
    perpsCategories: [],
    selectedCategoryId: 'all',
    handleSelectCategory: mockNoop,
  }),
}));
jest.mock('./MarketTopCoinsList/hooks/useMarketTopCoins', () => ({
  useMarketTopCoins: () => ({ data: mockRows, isLoading: false }),
}));
jest.mock('@onekeyhq/kit/src/views/Market/utils/marketReactPerf', () => ({
  useMarketRenderCommitProbe: () => undefined,
}));
jest.mock(
  '@onekeyhq/kit/src/views/Market/utils/useMarketWebDeferredFeaturesReady',
  () => ({ useMarketWebDeferredFeaturesReady: () => false }),
);
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings', () => ({
  useDevSettingsPersistAtom: () => [{}],
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {},
  appEventBus: { on: jest.fn(), off: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { dex: { list: { dexSort: jest.fn() } } },
}));
jest.mock('./MarketTokenList/hooks/useMarketHomeTokenListWebSocket', () => ({
  useMarketHomeTokenListWebSocket: ({ tokens }: { tokens: unknown[] }) =>
    tokens,
  applyMarketTokenListLiveOverrides: ({ tokens }: { tokens: unknown[] }) =>
    tokens,
}));
jest.mock('./MarketTokenList/hooks/useMarketTokenColumns', () => ({
  useMarketTokenColumns: () => mockColumns,
}));
jest.mock(
  './MarketTokenList/hooks/useMarketTokenColumns/useTrendingColumnsDesktop',
  () => ({ useTrendingColumnsDesktop: () => mockColumns }),
);
jest.mock(
  './MarketTokenList/hooks/useMarketTokenColumns/useWatchlistColumnsDesktop',
  () => ({ useWatchlistColumnsDesktop: () => mockColumns }),
);
jest.mock('./MarketTokenList/hooks/useToMarketDetailPage', () => ({
  useToDetailPage: () => mockNoop,
}));

const result = {
  data: mockRows,
  isLoading: false,
  isLoadingMore: false,
  isError: false,
  canLoadMore: false,
  loadMore: mockNoop,
  refetch: mockNoop,
  setSortBy: mockNoop,
  setSortType: mockNoop,
} as unknown as ComponentProps<typeof MarketTokenListBase>['result'];
const shared = {
  tabIntegrated: true,
  tabName: 'active',
  categories: [],
  selectedCategoryId: 'all',
  onSelectCategory: mockNoop,
};
const subjects = {
  stock: () => <MarketStockList {...shared} />,
  perps: () => <MarketPerpsTokenList {...shared} />,
  topCoins: () => <MarketTopCoinsList {...shared} />,
  trending: (showTableHeader = true) => (
    <MarketTokenListBase
      {...shared}
      result={result}
      desktopColumnVariant="trending"
      showTableHeader={showTableHeader}
    />
  ),
  watchlist: (showTableHeader = true) => (
    <MarketTokenListBase
      {...shared}
      result={result}
      isWatchlistMode
      showTableHeader={showTableHeader}
    />
  ),
};
type Subject = keyof typeof subjects;
function mount(
  subject: Subject,
  width: number,
  portal: boolean,
  showTableHeader = true,
) {
  mockWidth = width;
  Object.defineProperty(globalThis, 'innerWidth', {
    configurable: true,
    value: width,
  });
  const target = document.createElement('div');
  target.dataset.testid = 'portal';
  document.body.append(target);
  const contextValue = Object.freeze({
    activeTabName: 'active',
    portalTarget: portal ? target : null,
  });
  const view = render(
    <DesktopStickyHeaderContext.Provider value={contextValue}>
      {subjects[subject](showTableHeader)}
    </DesktopStickyHeaderContext.Provider>,
  );
  return { ...view, target };
}
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  jest.clearAllMocks();
});

describe.each([375, 767, 768, 1920])(
  'integrated market headers at %ipx (md maxWidth 767)',
  (width) => {
    test.each<Subject>(['stock', 'perps', 'topCoins', 'trending', 'watchlist'])(
      '%s keeps exactly one local header when the portal target is absent',
      (subject) => {
        const { container, target } = mount(subject, width, false);
        expect(
          container.querySelectorAll('[data-column="price"]'),
        ).toHaveLength(1);
        expect(target.querySelectorAll('[role="columnheader"]')).toHaveLength(
          0,
        );
      },
    );
    test.each<Subject>(['stock', 'perps', 'topCoins', 'trending', 'watchlist'])(
      '%s uses a single header with an available portal',
      (subject) => {
        const { container, target } = mount(subject, width, true);
        const usesPortal = subject === 'topCoins' || width > 767;
        expect(
          container.querySelectorAll('[data-column="price"]'),
        ).toHaveLength(usesPortal ? 0 : 1);
        expect(target.querySelectorAll('[data-column="price"]')).toHaveLength(
          usesPortal ? 1 : 0,
        );
      },
    );
  },
);

test.each([375, 1920])(
  'local sorting invokes the original stock callback and reorders actual Perps state at %ipx',
  (width) => {
    const stock = mount('stock', width, false);
    mockSetSorting.mockClear();
    fireEvent.click(stock.container.querySelector('[data-column="price"]')!);
    expect(mockSetSorting).toHaveBeenCalledTimes(1);
    expect(mockSetSorting).toHaveBeenCalledWith('price', 'desc');
    stock.unmount();
    stock.target.remove();
    const perps = mount('perps', width, false);
    expect(screen.getByTestId('web-rows').textContent).toBe('low,high');
    fireEvent.click(perps.container.querySelector('[data-column="price"]')!);
    expect(screen.getByTestId('web-rows').textContent).toBe('high,low');
  },
);
test.each([768, 1920])(
  'Base preserves showTableHeader=false for desktop trending/watchlist at %ipx',
  (width) => {
    for (const subject of ['trending', 'watchlist'] as const) {
      const view = mount(subject, width, false, false);
      expect(
        view.container.querySelectorAll('[role="columnheader"]'),
      ).toHaveLength(0);
      expect(screen.getByTestId('web-rows')).toBeTruthy();
      view.unmount();
      view.target.remove();
    }
  },
);

test.each([768, 1920])(
  'local TopCoins and trending headers update their original sort state at %ipx',
  (width) => {
    for (const subject of ['topCoins', 'trending'] as const) {
      const view = mount(subject, width, false);
      expect(screen.getByTestId('web-rows').textContent).toBe('low,high');
      const column = subject === 'topCoins' ? 'price' : 'change24h';
      fireEvent.click(
        view.container.querySelector(`[data-column="${column}"]`)!,
      );
      expect(screen.getByTestId('web-rows').textContent).toBe('high,low');
      view.unmount();
      view.target.remove();
    }
  },
);
