/** @jest-environment jsdom */
import { useContext, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';

import { act, fireEvent, render } from '@testing-library/react';

import { MarketDetailNativePageContext } from './MarketDetailNativeContext';
import { MarketDetailPager } from './MarketDetailPager.ios';

import type { IMarketDetailPagerProps } from './MarketDetailPager';

const mockLayouts: Record<
  string,
  (event: {
    nativeEvent: { layout: { width: number; height: number } };
  }) => void
> = {};
jest.mock('@onekeyhq/components', () => ({
  useTheme: () => ({ bgApp: { val: '#000' } }),
}));
jest.mock('react-native', () => ({
  View: ({
    children,
    testID,
    onLayout,
  }: PropsWithChildren<{
    testID?: string;
    onLayout?: (event: {
      nativeEvent: { layout: { width: number; height: number } };
    }) => void;
  }>) => {
    if (testID && onLayout) mockLayouts[testID] = onLayout;
    return <div data-testid={testID}>{children}</div>;
  },
}));
jest.mock('react-native-reanimated', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  return {
    useSharedValue: (value: unknown) => react.useRef({ value }).current,
  };
});
jest.mock('react-native-pager-view', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  return {
    CollapsiblePagerView: react.forwardRef(
      (
        {
          children,
          header,
          stickyHeader,
          onPageSelected,
          style,
          headerHeight,
          nativeSmoothHeaderScrollEnabled,
        }: PropsWithChildren<{
          style: { opacity: number };
          headerHeight: number;
          nativeSmoothHeaderScrollEnabled: boolean;
          header: React.ReactNode;
          stickyHeader: React.ReactNode;
          onPageSelected: (event: {
            nativeEvent: { position: number };
          }) => void;
        }>,
        ref,
      ) => {
        react.useImperativeHandle(ref, () => ({
          setPage: (position: number) =>
            onPageSelected({ nativeEvent: { position } }),
          setPageWithoutAnimation: (position: number) =>
            onPageSelected({ nativeEvent: { position } }),
        }));
        return (
          <div
            data-testid="native-pager"
            style={style}
            data-header-height={headerHeight}
            data-smooth={nativeSmoothHeaderScrollEnabled}
          >
            {header}
            {stickyHeader}
            {children}
          </div>
        );
      },
    ),
  };
});

function Page({ name }: { name: string }) {
  const page = useContext(MarketDetailNativePageContext);
  const [value, setValue] = useState(0);
  return (
    <button
      type="button"
      data-testid={name}
      data-focused={page?.isFocused}
      onClick={() => setValue((current) => current + 1)}
    >
      {value}
    </button>
  );
}

it('keeps the chart and each page state while selecting and renaming tabs', () => {
  const unmounted = jest.fn();
  const changed = jest.fn();
  function Chart() {
    useEffect(() => unmounted, []);
    return <canvas data-testid="chart" />;
  }
  function Tab({ children }: PropsWithChildren<{ name: string }>) {
    return children;
  }
  const renderTabBar: IMarketDetailPagerProps['renderTabBar'] = ({
    tabNames,
    onTabPress,
  }) => (
    <div>
      {tabNames.map((name) => (
        <button type="button" key={name} onClick={() => onTabPress(name)}>
          {name}
        </button>
      ))}
    </div>
  );
  const pager = (positionName: string) => (
    <MarketDetailPager
      initialTabName="Position"
      renderHeader={() => <Chart />}
      renderTabBar={renderTabBar}
      onTabChange={changed}
    >
      {[
        <Tab key="overview" name="Overview">
          <Page name="overview" />
        </Tab>,
        <Tab key="portfolio" name={positionName}>
          <Page name="portfolio" />
        </Tab>,
      ]}
    </MarketDetailPager>
  );
  const { getByTestId, getByText, rerender } = render(pager('Position'));
  const chart = getByTestId('chart');
  expect(getByTestId('portfolio').dataset.focused).toBe('true');
  fireEvent.click(getByTestId('portfolio'));
  fireEvent.click(getByText('Overview'));
  expect(getByTestId('portfolio').dataset.focused).toBe('false');
  fireEvent.click(getByText('Position'));
  rerender(pager('My position'));
  expect(getByTestId('portfolio').dataset.focused).toBe('true');
  expect(getByTestId('portfolio').textContent).toBe('1');
  expect(getByTestId('chart')).toBe(chart);
  expect(unmounted).not.toHaveBeenCalled();
  expect(changed).toHaveBeenCalledTimes(2);
});

it('reveals the same header only after all initial native layout measurements are ready', () => {
  function Tab({ children }: PropsWithChildren<{ name: string }>) {
    return children;
  }
  const unmounted = jest.fn();
  function Header() {
    useEffect(() => unmounted, []);
    return <div data-testid="price-header">Quote</div>;
  }
  const { getByTestId, queryByTestId } = render(
    <MarketDetailPager
      renderHeader={() => <Header />}
      renderTabBar={() => <div>Overview</div>}
      onTabChange={jest.fn()}
    >
      {[
        <Tab key="overview" name="Overview">
          <span>Content</span>
        </Tab>,
      ]}
    </MarketDetailPager>,
  );
  const header = getByTestId('price-header');
  const pager = getByTestId('native-pager');
  const measure = (id: string, width: number, height: number) =>
    act(() => mockLayouts[id]({ nativeEvent: { layout: { width, height } } }));
  expect(pager.style.opacity).toBe('0');
  expect(queryByTestId('market-detail-native-pager-loading')).toBeNull();
  measure('market-detail-native-header', 402, 0);
  expect(pager.dataset.headerHeight).toBe('1');
  measure('market-detail-native-header', 402, 454);
  measure('market-detail-native-sticky-header', 402, 45);
  expect(pager.style.opacity).toBe('0');
  measure('market-detail-native-pager-container', 402, 630);
  expect(pager.style.opacity).toBe('1');
  expect(pager.dataset.headerHeight).toBe('454');
  expect(queryByTestId('market-detail-native-pager-loading')).toBeNull();
  measure('market-detail-native-header', 402, 460);
  expect(pager.style.opacity).toBe('1');
  expect(getByTestId('price-header')).toBe(header);
  expect(unmounted).not.toHaveBeenCalled();
});

it('shows known header geometry before measurement and enables list ownership only after layout', () => {
  function Tab({ children }: PropsWithChildren<{ name: string }>) {
    return children;
  }
  const { getByTestId } = render(
    <MarketDetailPager
      initialHeaderHeight={454}
      initialStickyHeaderHeight={45}
      renderHeader={() => <div data-testid="early-header">Price</div>}
      renderTabBar={() => <div>Overview</div>}
      onTabChange={jest.fn()}
    >
      {[
        <Tab key="overview" name="Overview">
          Body
        </Tab>,
      ]}
    </MarketDetailPager>,
  );
  const header = getByTestId('early-header');
  const pager = getByTestId('native-pager');
  expect(pager.style.opacity).toBe('1');
  expect(pager.dataset.headerHeight).toBe('454');
  expect(pager.dataset.smooth).toBe('false');
  act(() => {
    for (const [id, height] of [
      ['market-detail-native-header', 454],
      ['market-detail-native-sticky-header', 45],
      ['market-detail-native-pager-container', 630],
    ] as const) {
      mockLayouts[id]({ nativeEvent: { layout: { width: 402, height } } });
    }
  });
  expect(pager.dataset.smooth).toBe('true');
  expect(getByTestId('early-header')).toBe(header);
});
