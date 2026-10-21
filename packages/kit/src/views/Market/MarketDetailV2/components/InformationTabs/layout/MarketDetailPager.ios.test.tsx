/** @jest-environment jsdom */
import { useContext, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';

import { fireEvent, render } from '@testing-library/react';

import { MarketDetailNativePageContext } from './MarketDetailNativeContext';
import { MarketDetailPager } from './MarketDetailPager.ios';

import type { IMarketDetailPagerProps } from './MarketDetailPager';

jest.mock('@onekeyhq/components', () => ({
  useTheme: () => ({ bgApp: { val: '#000' } }),
}));
jest.mock('react-native', () => ({
  View: ({ children }: PropsWithChildren) => <div>{children}</div>,
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
        }: PropsWithChildren<{
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
          <div>
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
