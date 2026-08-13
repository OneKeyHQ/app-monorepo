/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render } from '@testing-library/react';

import { PerpMobileChartPanel } from './PerpMobileChartPanel';

const mockTradingViewSources: Array<{
  coin: string;
  environment: string;
  kind: string;
}> = [];
const mockTradingViewDisplayModes: Array<string | undefined> = [];

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
  Icon: ({ name, size }: { name: string; size?: string }) => (
    <span data-icon={name} data-size={size} />
  ),
  SizableText: ({
    children,
    size,
  }: {
    children?: ReactNode;
    size?: string;
  }) => <span data-size={size}>{children}</span>,
  XStack: ({
    accessibilityState,
    children,
    minHeight,
    onPress,
    testID,
  }: {
    accessibilityState?: { expanded?: boolean };
    children?: ReactNode;
    minHeight?: number;
    onPress?: () => void;
    testID?: string;
  }) => {
    const Element = onPress ? 'button' : 'div';
    return (
      <Element
        aria-expanded={accessibilityState?.expanded}
        data-min-height={minHeight}
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
    nativeChartDisplayMode,
    onNativeChartClose,
    source,
  }: {
    nativeChartDisplayMode?: string;
    onNativeChartClose?: () => void;
    source: { coin: string; environment: string; kind: string };
  }) => {
    mockTradingViewSources.push(source);
    mockTradingViewDisplayModes.push(nativeChartDisplayMode);
    return (
      <div>
        <span
          data-coin={source.coin}
          data-display-mode={nativeChartDisplayMode}
          data-environment={source.environment}
          data-kind={source.kind}
        >
          Native chart
        </span>
        {onNativeChartClose ? (
          <button
            data-testid="mock-native-chart-close"
            onClick={onNativeChartClose}
            type="button"
          >
            Close chart
          </button>
        ) : null}
      </div>
    );
  },
}));

describe('PerpMobileChartPanel', () => {
  beforeEach(() => {
    mockTradingViewSources.length = 0;
    mockTradingViewDisplayModes.length = 0;
    mockWindowDimensions = { height: 852, width: 393 };
    mockActiveCoin = 'BTC';
  });

  it('lazy mounts the chart and keeps it mounted after collapse', () => {
    const { getByTestId, getByText, queryByTestId, queryByText } = render(
      <PerpMobileChartPanel />,
    );
    const toggle = getByTestId('perp-mobile-chart-toggle');

    expect(getByText('BTCUSDC Perp Chart')).toBeTruthy();
    expect(getByText('BTCUSDC Perp Chart').getAttribute('data-size')).toBe(
      '$bodySmMedium',
    );
    expect(toggle.getAttribute('data-min-height')).toBe('40');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(
      toggle.querySelector('[data-icon="TradingViewCandlesOutline"]'),
    ).toBeNull();
    expect(
      toggle.querySelector('[data-icon="ChevronTopSmallOutline"]'),
    ).toBeTruthy();
    expect(
      toggle
        .querySelector('[data-icon="ChevronTopSmallOutline"]')
        ?.getAttribute('data-size'),
    ).toBe('$5');
    expect(queryByTestId('perp-mobile-chart-content')).toBeNull();
    expect(queryByText('Native chart')).toBeNull();

    fireEvent.click(toggle);

    const nativeChart = getByText('Native chart');
    expect(nativeChart.getAttribute('data-kind')).toBe('hyperliquid');
    expect(nativeChart.getAttribute('data-coin')).toBe('BTC');
    expect(nativeChart.getAttribute('data-environment')).toBe('mainnet');
    expect(nativeChart.getAttribute('data-display-mode')).toBe('compact');
    expect(queryByTestId('perp-mobile-chart-toggle')).toBeNull();
    expect(
      getByTestId('perp-mobile-chart-content').getAttribute('data-h'),
    ).toBe('250');

    fireEvent.click(getByTestId('mock-native-chart-close'));

    // Collapse hides the chart without unmounting so reopening keeps state.
    const collapsedToggle = getByTestId('perp-mobile-chart-toggle');
    expect(collapsedToggle.getAttribute('aria-expanded')).toBe('false');
    expect(
      getByTestId('perp-mobile-chart-content').getAttribute('data-h'),
    ).toBe('0');
    expect(getByText('Native chart')).toBeTruthy();

    const mountedSources = mockTradingViewSources.length;
    fireEvent.click(collapsedToggle);

    expect(queryByTestId('perp-mobile-chart-toggle')).toBeNull();
    expect(mockTradingViewSources.at(-1)).toBe(
      mockTradingViewSources[mountedSources - 1],
    );
  });

  it('drops the hidden chart when the coin changes while collapsed', () => {
    const view = render(<PerpMobileChartPanel />);
    const toggle = view.getByTestId('perp-mobile-chart-toggle');

    fireEvent.click(toggle);
    fireEvent.click(view.getByTestId('mock-native-chart-close'));
    expect(view.getByText('Native chart')).toBeTruthy();

    mockActiveCoin = 'ETH';
    view.rerender(<PerpMobileChartPanel />);

    // No off-screen rebuild for a coin the user never expanded.
    expect(view.queryByText('Native chart')).toBeNull();

    // Switching back while collapsed must not rebuild the chart either.
    mockActiveCoin = 'BTC';
    view.rerender(<PerpMobileChartPanel />);
    expect(view.queryByText('Native chart')).toBeNull();

    mockActiveCoin = 'ETH';
    view.rerender(<PerpMobileChartPanel />);
    fireEvent.click(toggle);
    expect(view.getByText('Native chart').getAttribute('data-coin')).toBe(
      'ETH',
    );
  });

  it('clamps the expanded chart height to short viewports', () => {
    mockWindowDimensions = { height: 474, width: 320 };
    const { getByTestId } = render(<PerpMobileChartPanel bottomOffset={34} />);

    fireEvent.click(getByTestId('perp-mobile-chart-toggle'));

    expect(
      getByTestId('perp-mobile-chart-content').getAttribute('data-h'),
    ).toBe('220');
  });

  it('never collapses the chart below its minimum usable height', () => {
    mockWindowDimensions = { height: 400, width: 320 };
    const { getByTestId } = render(<PerpMobileChartPanel bottomOffset={34} />);

    fireEvent.click(getByTestId('perp-mobile-chart-toggle'));

    expect(
      getByTestId('perp-mobile-chart-content').getAttribute('data-h'),
    ).toBe('200');
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
