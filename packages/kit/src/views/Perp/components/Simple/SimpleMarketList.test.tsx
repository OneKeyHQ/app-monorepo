/** @jest-environment jsdom */

import type { ComponentProps, PropsWithChildren, ReactElement } from 'react';

import { act, fireEvent, render } from '@testing-library/react';
import { StyleSheet } from 'react-native';

import type { IPerpsUniverse } from '@onekeyhq/shared/types/hyperliquid';

import { SimpleMarketList } from './SimpleMarketList';

import type {
  FlatListProps,
  LayoutChangeEvent,
  RefreshControlProps,
  ScrollViewInstance,
  ScrollViewProps,
} from 'react-native';
import type { CollapsiblePagerViewProps } from 'react-native-pager-view';

type ITestPagerProps = CollapsiblePagerViewProps;
let mockPagerProps: ITestPagerProps;
let mockIsNative = false;
let mockIsNativeIOS = false;
const mockSetPage = jest.fn();
const mockSetPageWithoutAnimation = jest.fn();
const mockLists = new Map<string, FlatListProps<IPerpsUniverse>>();
const mockScrollViews = new Map<string, ScrollViewProps>();
const mockLayouts = new Map<string, (event: LayoutChangeEvent) => void>();

jest.mock('react-native', () => {
  const actual =
    jest.requireActual<typeof import('react-native')>('react-native-web');
  class TestFlatList extends actual.FlatList<IPerpsUniverse> {
    override render() {
      if (this.props.testID) mockLists.set(this.props.testID, this.props);
      return super.render();
    }
  }
  return { ...actual, FlatList: TestFlatList };
});

jest.mock('react-native-pager-view', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { ScrollView: TestScrollView } =
    jest.requireActual<typeof import('react-native')>('react-native-web');
  return {
    ScrollEdgeEffect: { Hard: 'hard' },
    CollapsiblePagerView: React.forwardRef(function TestPager(
      props: ITestPagerProps,
      ref,
    ) {
      const [selectedPage, setSelectedPage] = React.useState(
        props.initialPage ?? 0,
      );
      mockPagerProps = {
        ...props,
        onPageSelected: (event) => {
          setSelectedPage(event.nativeEvent.position);
          return props.onPageSelected?.(event);
        },
      };
      React.useImperativeHandle(ref, () => ({
        setPage: mockSetPage,
        setPageWithoutAnimation: mockSetPageWithoutAnimation,
      }));
      return (
        <div>
          {props.header}
          {props.stickyHeader}
          {React.Children.toArray(props.children).map((page, index) =>
            !mockIsNative ||
            Math.abs(index - selectedPage) <= (props.pageRetentionDistance ?? 1)
              ? page
              : null,
          )}
        </div>
      );
    }),
    NativeScroller: React.forwardRef<
      ScrollViewInstance,
      ScrollViewProps & { pagerScrollKey: string }
    >(function TestScroller({ pagerScrollKey, ...props }, ref) {
      mockScrollViews.set(pagerScrollKey, props);
      return <TestScrollView {...props} ref={ref} />;
    }),
  };
});
jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: { createAnimatedComponent: (component: unknown) => component },
    useSharedValue: (value: unknown) => React.useRef({ value }).current,
    useEvent:
      (handler: (event: unknown) => void) =>
      (event: { nativeEvent: unknown }) =>
        handler(event.nativeEvent),
  };
});
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  get isNative() {
    return mockIsNative;
  },
  get isNativeIOS() {
    return mockIsNativeIOS;
  },
}));
jest.mock('@onekeyhq/components', () => {
  const { View } =
    jest.requireActual<typeof import('react-native')>('react-native-web');
  return {
    useScrollContentTabBarOffset: () => 64,
    YStack: ({
      children,
      testID,
      onLayout,
    }: PropsWithChildren<{
      testID?: string;
      onLayout?: (event: LayoutChangeEvent) => void;
    }>) => {
      if (testID && onLayout) mockLayouts.set(testID, onLayout);
      return <View testID={testID}>{children}</View>;
    },
  };
});
jest.mock('@onekeyhq/kit/src/hooks/useThemeVariant', () => ({
  useThemeVariant: () => 'light',
}));

const markets: IPerpsUniverse[] = Array.from({ length: 40 }, (_, index) => ({
  name: `COIN${index}`,
  assetId: index,
  maxLeverage: 20,
  szDecimals: 2,
  marginTableId: 1,
}));
const props: ComponentProps<typeof SimpleMarketList> = {
  overview: <div>Overview</div>,
  categories: [
    { id: 'favorites', markets: [] },
    { id: 'perps', markets },
    { id: 'stocks', markets: [markets[3]] },
  ],
  selectedCategoryId: 'perps',
  renderMarket: (market) => <div>{market.name}</div>,
  renderCategories: (onSelect) => (
    <>
      <button type="button" onClick={() => onSelect('stocks')}>
        Stocks
      </button>
      <button type="button" onClick={() => onSelect('favorites')}>
        Watchlist
      </button>
    </>
  ),
  emptyState: <div>No markets</div>,
  onCategoryChange: jest.fn(),
  refreshing: false,
  onRefresh: jest.fn(),
};
const layout = (height: number) =>
  ({
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height } },
  }) as LayoutChangeEvent;
const selected = (position: number) =>
  ({ nativeEvent: { position } }) as Parameters<
    NonNullable<ITestPagerProps['onPageSelected']>
  >[0];
const progress = (position: number, offset: number) =>
  ({
    nativeEvent: { position, offset },
  }) as Parameters<NonNullable<ITestPagerProps['onPageScroll']>>[0];

beforeEach(() => {
  jest.clearAllMocks();
  mockLayouts.clear();
  mockLists.clear();
  mockScrollViews.clear();
  mockIsNative = false;
  mockIsNativeIOS = false;
});

it('keeps distinct virtualized pages ready for the shared pager transition', () => {
  const { getByText } = render(<SimpleMarketList {...props} />);
  expect(mockPagerProps.initialPage).toBe(1);
  expect(mockPagerProps.scrollEnabled).toBe(true);
  expect(mockPagerProps.pageRetentionDistance).toBe(props.categories.length);
  expect(mockLists.get('perps-simple-market-list-perps')?.data).toHaveLength(
    40,
  );
  expect(mockLists.get('perps-simple-market-list-stocks')?.data).toEqual([
    markets[3],
  ]);
  expect(
    mockLists.get('perps-simple-market-list-favorites')?.data,
  ).toHaveLength(0);
  expect(getByText('No markets')).toBeTruthy();
});

it.each([false, true])(
  'retains native scroll hosts and measured layouts across distant category switches (ios=%s)',
  (ios) => {
    mockIsNative = true;
    mockIsNativeIOS = ios;
    const { getByTestId } = render(
      <SimpleMarketList
        {...props}
        selectedCategoryId="favorites"
        categories={[
          ...props.categories,
          { id: 'crypto', markets },
          { id: 'fx', markets: [markets[0]] },
        ]}
      />,
    );
    const firstList = getByTestId('perps-simple-market-list-favorites');
    const distantList = getByTestId('perps-simple-market-list-fx');
    act(() => {
      mockLayouts.get('perps-simple-sticky-categories')?.(layout(56));
      mockLists
        .get('perps-simple-market-list-favorites')
        ?.onLayout?.(layout(700));
      void mockPagerProps.onPageSelected?.(selected(4));
    });
    expect(firstList.isConnected).toBe(true);
    expect(getByTestId('perps-simple-market-list-fx')).toBe(distantList);
    act(() => {
      void mockPagerProps.onPageSelected?.(selected(0));
    });
    expect(getByTestId('perps-simple-market-list-favorites')).toBe(firstList);
    expect(distantList.isConnected).toBe(true);
    expect(
      mockLists.get('perps-simple-market-list-favorites')
        ?.contentContainerStyle,
    ).toMatchObject({ minHeight: 644 });
  },
);

it('does not rerender market rows for selection or overview changes, but applies new market data', () => {
  const renderMarket = jest.fn(props.renderMarket);
  const { rerender } = render(
    <SimpleMarketList {...props} renderMarket={renderMarket} />,
  );
  renderMarket.mockClear();
  act(() => {
    void mockPagerProps.onPageSelected?.(selected(2));
  });
  rerender(
    <SimpleMarketList
      {...props}
      selectedCategoryId="stocks"
      overview={<div>Updated overview</div>}
      renderMarket={renderMarket}
    />,
  );
  expect(renderMarket).not.toHaveBeenCalled();
  rerender(
    <SimpleMarketList
      {...props}
      renderMarket={renderMarket}
      categories={props.categories.map((category) =>
        category.id === 'stocks'
          ? { ...category, markets: [markets[4]] }
          : category,
      )}
    />,
  );
  expect(renderMarket).toHaveBeenCalledWith(markets[4]);
});

it.each(['ios', 'android', 'web'])(
  'switches tapped tabs immediately and accepts consecutive presses (%s)',
  (platform) => {
    mockIsNative = platform !== 'web';
    mockIsNativeIOS = platform === 'ios';
    const renderCategories = jest.fn(props.renderCategories);
    const { getByRole } = render(
      <SimpleMarketList {...props} renderCategories={renderCategories} />,
    );
    const indexDecimal = renderCategories.mock.calls[0][1];
    fireEvent.click(getByRole('button', { name: 'Stocks' }));
    expect(mockSetPageWithoutAnimation).toHaveBeenLastCalledWith(2);
    expect(indexDecimal.value).toBe(2);
    // A second command must not wait for the previous selection callback.
    fireEvent.click(getByRole('button', { name: 'Watchlist' }));
    expect(mockSetPageWithoutAnimation).toHaveBeenLastCalledWith(0);
    expect(indexDecimal.value).toBe(0);
    fireEvent.click(getByRole('button', { name: 'Stocks' }));
    expect(mockSetPageWithoutAnimation).toHaveBeenLastCalledWith(2);
    expect(indexDecimal.value).toBe(2);
    expect(mockSetPage).not.toHaveBeenCalled();
    expect(props.onCategoryChange).not.toHaveBeenCalled();
    act(() => {
      void mockPagerProps.onPageSelected?.(selected(2));
    });
    expect(props.onCategoryChange).toHaveBeenCalledWith('stocks');
  },
);

it.each([false, true])(
  'tracks colour progress and rolls back cancelled swipes (native=%s)',
  (native) => {
    mockIsNative = native;
    const renderCategories = jest.fn(props.renderCategories);
    render(<SimpleMarketList {...props} renderCategories={renderCategories} />);
    const indexDecimal = renderCategories.mock.calls[0][1];
    act(() => {
      void mockPagerProps.onPageScroll?.(progress(1, 0.4));
    });
    // Tab colors receive in-flight progress before the category is committed.
    expect(indexDecimal.value).toBe(1.4);
    expect(props.onCategoryChange).not.toHaveBeenCalled();
    act(() => {
      void mockPagerProps.onPageScroll?.(progress(1, 0));
    });
    expect(indexDecimal.value).toBe(1);
    expect(props.onCategoryChange).not.toHaveBeenCalled();
  },
);

it('switches in both directions, including into and out of an empty Watchlist', () => {
  render(<SimpleMarketList {...props} />);
  act(() => {
    void mockPagerProps.onPageSelected?.(selected(0));
  });
  expect(props.onCategoryChange).toHaveBeenLastCalledWith('favorites');
  act(() => {
    void mockPagerProps.onPageSelected?.(selected(1));
  });
  expect(props.onCategoryChange).toHaveBeenLastCalledWith('perps');
  act(() => {
    void mockPagerProps.onPageSelected?.(selected(2));
  });
  expect(props.onCategoryChange).toHaveBeenLastCalledWith('stocks');
  act(() => {
    void mockPagerProps.onPageSelected?.(selected(-1));
    void mockPagerProps.onPageSelected?.(selected(3));
  });
  expect(props.onCategoryChange).toHaveBeenCalledTimes(3);
});

it.each(['ios', 'android', 'web'])(
  'waits for native initial geometry before revealing the pager (%s)',
  (platform) => {
    mockIsNative = platform !== 'web';
    mockIsNativeIOS = platform === 'ios';
    const { getByText } = render(<SimpleMarketList {...props} />);
    const overview = getByText('Overview');
    const expectVisible = (visible: boolean) => {
      expect(mockPagerProps.pointerEvents).toBe(visible ? 'auto' : 'none');
      expect(mockPagerProps.accessibilityElementsHidden).toBe(!visible);
      expect(StyleSheet.flatten(mockPagerProps.style)?.opacity ?? 1).toBe(
        visible ? 1 : 0,
      );
    };
    expectVisible(!mockIsNative);
    act(() => {
      mockPagerProps.onLayout?.(layout(800));
      mockLayouts.get('perps-simple-overview')?.(layout(500));
      mockLayouts.get('perps-simple-sticky-categories')?.(layout(0));
    });
    expectVisible(!mockIsNative);
    act(() => {
      mockLayouts.get('perps-simple-sticky-categories')?.(layout(48));
    });
    expectVisible(true);
    expect(mockPagerProps.headerHeight).toBe(500);
    expect(mockPagerProps.stickyHeaderHeight).toBe(48);
    expect(getByText('Overview')).toBe(overview);
  },
);

it('supplies measured header and sticky heights without remounting the overview', () => {
  const { getByText } = render(<SimpleMarketList {...props} />);
  const overview = getByText('Overview');
  act(() => {
    (
      mockPagerProps.header as ReactElement<{
        onLayout: (event: LayoutChangeEvent) => void;
      }>
    ).props.onLayout(layout(500));
    mockLayouts.get('perps-simple-sticky-categories')?.(layout(48));
  });
  expect(mockPagerProps.headerHeight).toBe(500);
  expect(mockPagerProps.stickyHeaderHeight).toBe(48);
  act(() => {
    void mockPagerProps.onPageSelected?.(selected(2));
  });
  expect(getByText('Overview')).toBe(overview);
});

it.each([false, true])(
  'preserves measured geometry through zero layouts during a swipe (completes=%s)',
  (completes) => {
    mockIsNative = true;
    render(<SimpleMarketList {...props} />);
    act(() => {
      mockPagerProps.onLayout?.(layout(800));
      mockLayouts.get('perps-simple-overview')?.(layout(500));
      mockLayouts.get('perps-simple-sticky-categories')?.(layout(48));
    });
    expect(mockPagerProps.nativeSmoothHeaderScrollEnabled).toBe(true);

    act(() => {
      void mockPagerProps.onPageScroll?.(progress(1, 0.4));
      mockLayouts.get('perps-simple-overview')?.(layout(0));
      mockLayouts.get('perps-simple-sticky-categories')?.(layout(0));
      mockPagerProps.onLayout?.(layout(0));
    });
    expect(mockPagerProps.headerHeight).toBe(500);
    expect(mockPagerProps.stickyHeaderHeight).toBe(48);
    expect(mockPagerProps.nativeSmoothHeaderScrollEnabled).toBe(true);
    act(() => {
      void mockPagerProps.onPageScroll?.(progress(completes ? 2 : 1, 0));
      if (completes) void mockPagerProps.onPageSelected?.(selected(2));
    });
    expect(mockPagerProps.headerHeight).toBe(500);
    expect(mockSetPageWithoutAnimation).not.toHaveBeenCalled();
    // Removing a position or changing the viewport must still resize the header.
    act(() => {
      mockLayouts.get('perps-simple-overview')?.(layout(380));
      mockLayouts.get('perps-simple-sticky-categories')?.(layout(52));
    });
    expect(mockPagerProps.headerHeight).toBe(380);
    expect(mockPagerProps.stickyHeaderHeight).toBe(52);
  },
);

it('keeps empty pages scrollable and connects refresh to each pager-owned scroller', () => {
  render(<SimpleMarketList {...props} refreshing />);
  act(() => {
    mockLists
      .get('perps-simple-market-list-favorites')
      ?.onLayout?.(layout(700));
  });
  expect(
    mockLists.get('perps-simple-market-list-favorites')?.contentContainerStyle,
  ).toEqual({
    minHeight: 700,
    paddingTop: 8,
    paddingBottom: 80,
  });
  const refresh = mockScrollViews.get('perps-simple-favorites')
    ?.refreshControl as ReactElement<RefreshControlProps> | undefined;
  expect(refresh?.props.refreshing).toBe(true);
  void refresh?.props.onRefresh?.();
  expect(props.onRefresh).toHaveBeenCalledTimes(1);
});

it.each([false, true])(
  'ends short native pages at header collapse without hiding the first row (ios=%s)',
  (ios) => {
    mockIsNative = true;
    mockIsNativeIOS = ios;
    render(<SimpleMarketList {...props} />);
    act(() => {
      mockLayouts.get('perps-simple-overview')?.(layout(300));
      mockLayouts.get('perps-simple-sticky-categories')?.(layout(56));
      mockLists.get('perps-simple-market-list-stocks')?.onLayout?.(layout(700));
      mockLists
        .get('perps-simple-market-list-favorites')
        ?.onLayout?.(layout(700));
    });

    for (const category of ['stocks', 'favorites']) {
      const style = mockLists.get(
        `perps-simple-market-list-${category}`,
      )?.contentContainerStyle;
      expect(style).toEqual({
        minHeight: 644,
        paddingTop: 8,
        paddingBottom: 80,
      });
      // After the native top inset is added, a short page's full scroll range
      // should collapse only the overview, leaving its first row below the bar.
      const contentHeight = Number(StyleSheet.flatten(style)?.minHeight);
      expect(
        contentHeight +
          mockPagerProps.headerHeight +
          mockPagerProps.stickyHeaderHeight -
          700,
      ).toBe(mockPagerProps.headerHeight);
    }

    act(() => {
      mockLayouts.get('perps-simple-sticky-categories')?.(layout(64));
      mockLists.get('perps-simple-market-list-stocks')?.onLayout?.(layout(620));
    });
    expect(
      mockLists.get('perps-simple-market-list-stocks')?.contentContainerStyle,
    ).toMatchObject({ minHeight: 556 });
  },
);

it('returns to All when the active server category is removed', () => {
  const { rerender } = render(
    <SimpleMarketList {...props} selectedCategoryId="stocks" />,
  );
  rerender(
    <SimpleMarketList {...props} categories={props.categories.slice(0, 2)} />,
  );
  expect(mockSetPageWithoutAnimation).toHaveBeenLastCalledWith(1);
  expect(props.onCategoryChange).toHaveBeenLastCalledWith('perps');
});

it('reconciles reordered server tabs by identity without an animated jump', () => {
  const { rerender } = render(<SimpleMarketList {...props} />);
  rerender(
    <SimpleMarketList
      {...props}
      categories={[
        props.categories[2],
        props.categories[0],
        props.categories[1],
      ]}
    />,
  );
  expect(mockSetPageWithoutAnimation).toHaveBeenCalledWith(2);
  expect(props.onCategoryChange).not.toHaveBeenCalled();
});

it.each([false, true])(
  'coordinates native headers and enables iOS transition clipping (ios=%s)',
  (ios) => {
    mockIsNative = true;
    mockIsNativeIOS = ios;
    render(<SimpleMarketList {...props} />);
    expect(mockPagerProps.nestedScrollEnabled).toBe(true);
    expect(mockPagerProps.nativeSmoothHeaderScrollEnabled).toBe(false);
    expect(mockPagerProps.scrollEnabled).toBe(false);
    expect(mockPagerProps.headerHeight).toBeGreaterThan(0);
    act(() => {
      mockLayouts.get('perps-simple-overview')?.(layout(500));
      mockLayouts.get('perps-simple-sticky-categories')?.(layout(48));
    });
    expect(mockPagerProps.nativeSmoothHeaderScrollEnabled).toBe(false);
    act(() => {
      mockPagerProps.onLayout?.(layout(800));
    });
    expect(mockPagerProps.nativeSmoothHeaderScrollEnabled).toBe(true);
    expect(mockPagerProps.scrollEnabled).toBe(true);
    expect(mockPagerProps.topScrollEdgeEffect).toBe(ios ? 'hard' : undefined);
    expect(mockPagerProps.topOverlayColorScheme).toBe(
      ios ? 'light' : undefined,
    );
  },
);
