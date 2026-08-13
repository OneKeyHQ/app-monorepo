/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render } from '@testing-library/react';

import { PerpMobileChartPanel } from './PerpMobileChartPanel';

const mockTradingViewSources: Array<{
  coin: string;
  environment: string;
  kind: string;
}> = [];

let mockWindowDimensions = { height: 852, width: 393 };
let mockActiveCoin = 'BTC';

jest.mock('react-native', () => ({
  useWindowDimensions: () => mockWindowDimensions,
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) =>
      id === 'perp.label_perp' ? 'Perp' : 'Chart',
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  HeaderScrollGestureWrapper: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  Icon: ({ name }: { name: string }) => <span data-icon={name} />,
  SizableText: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  XStack: ({
    accessibilityState,
    children,
    onPress,
    testID,
  }: {
    accessibilityState?: { expanded?: boolean };
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
  }) => {
    const Element = onPress ? 'button' : 'div';
    return (
      <Element
        aria-expanded={accessibilityState?.expanded}
        data-testid={testID}
        onClick={onPress}
        type={onPress ? 'button' : undefined}
      >
        {children}
      </Element>
    );
  },
  YStack: ({
    bottom,
    children,
    h,
    left,
    position,
    right,
    testID,
    zIndex,
  }: {
    bottom?: number;
    children?: ReactNode;
    h?: number;
    left?: number;
    position?: string;
    right?: number;
    testID?: string;
    zIndex?: number;
  }) => (
    <div
      data-bottom={bottom}
      data-h={h}
      data-left={left}
      data-position={position}
      data-right={right}
      data-testid={testID}
      data-z-index={zIndex}
    >
      {children}
    </div>
  ),
}));

jest.mock('../hooks/useActiveTradeDisplay', () => ({
  useActiveTradeDisplay: () => ({
    coin: mockActiveCoin,
    displayName: mockActiveCoin,
    mode: 'perp',
  }),
}));

jest.mock('@onekeyhq/kit/src/components/TradingView/TradingViewNative', () => ({
  TradingViewNative: ({
    source,
  }: {
    source: { coin: string; environment: string; kind: string };
  }) => {
    mockTradingViewSources.push(source);
    return (
      <span
        data-coin={source.coin}
        data-environment={source.environment}
        data-kind={source.kind}
      >
        Native chart
      </span>
    );
  },
}));

describe('PerpMobileChartPanel', () => {
  beforeEach(() => {
    mockTradingViewSources.length = 0;
    mockWindowDimensions = { height: 852, width: 393 };
    mockActiveCoin = 'BTC';
  });

  it('lazy mounts the chart and keeps it mounted after collapse', () => {
    const { getByTestId, getByText, queryByTestId, queryByText } = render(
      <PerpMobileChartPanel />,
    );
    const toggle = getByTestId('perp-mobile-chart-toggle');

    expect(getByText('BTCUSDC Perp Chart')).toBeTruthy();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(queryByTestId('perp-mobile-chart-content')).toBeNull();
    expect(queryByText('Native chart')).toBeNull();

    fireEvent.click(toggle);

    const nativeChart = getByText('Native chart');
    expect(nativeChart.getAttribute('data-kind')).toBe('hyperliquid');
    expect(nativeChart.getAttribute('data-coin')).toBe('BTC');
    expect(nativeChart.getAttribute('data-environment')).toBe('mainnet');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(
      getByTestId('perp-mobile-chart-content').getAttribute('data-h'),
    ).toBe('500');

    fireEvent.click(toggle);

    // Collapse hides the chart without unmounting so reopening keeps state.
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(
      getByTestId('perp-mobile-chart-content').getAttribute('data-h'),
    ).toBe('0');
    expect(getByText('Native chart')).toBeTruthy();

    const mountedSources = mockTradingViewSources.length;
    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(mockTradingViewSources.at(-1)).toBe(
      mockTradingViewSources[mountedSources - 1],
    );
  });

  it('drops the hidden chart when the coin changes while collapsed', () => {
    const view = render(<PerpMobileChartPanel />);
    const toggle = view.getByTestId('perp-mobile-chart-toggle');

    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(view.getByText('Native chart')).toBeTruthy();

    mockActiveCoin = 'ETH';
    view.rerender(<PerpMobileChartPanel />);

    // No off-screen rebuild for a coin the user never expanded.
    expect(view.queryByText('Native chart')).toBeNull();

    fireEvent.click(toggle);
    expect(view.getByText('Native chart').getAttribute('data-coin')).toBe(
      'ETH',
    );
  });

  it('clamps the expanded chart height to short viewports', () => {
    mockWindowDimensions = { height: 568, width: 320 };
    const { getByTestId } = render(<PerpMobileChartPanel bottomOffset={34} />);

    fireEvent.click(getByTestId('perp-mobile-chart-toggle'));

    expect(
      getByTestId('perp-mobile-chart-content').getAttribute('data-h'),
    ).toBe('314');
  });

  it('never collapses the chart below its minimum usable height', () => {
    mockWindowDimensions = { height: 400, width: 320 };
    const { getByTestId } = render(<PerpMobileChartPanel bottomOffset={34} />);

    fireEvent.click(getByTestId('perp-mobile-chart-toggle'));

    expect(
      getByTestId('perp-mobile-chart-content').getAttribute('data-h'),
    ).toBe('240');
  });

  it('anchors the chart panel as a bottom overlay', () => {
    const { getByTestId } = render(<PerpMobileChartPanel bottomOffset={34} />);
    const overlay = getByTestId('perp-mobile-chart-overlay');

    expect(overlay.getAttribute('data-position')).toBe('absolute');
    expect(overlay.getAttribute('data-bottom')).toBe('34');
    expect(overlay.getAttribute('data-left')).toBe('0');
    expect(overlay.getAttribute('data-right')).toBe('0');
  });
});
