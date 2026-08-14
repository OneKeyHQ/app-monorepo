/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render } from '@testing-library/react';

import {
  PerpMobileChartPanel,
  PerpMobileTopChartPanel,
} from './PerpMobileChartPanel';

const mockTradingViewSources: Array<{
  coin: string;
  environment: string;
  kind: string;
}> = [];
const mockTradingViewDisplayModes: Array<string | undefined> = [];

let mockWindowDimensions = { height: 852, width: 393 };
let mockActiveCoin = 'BTC';
const mockDeferredTasks: Array<() => void> = [];

jest.mock('react-native', () => ({
  useWindowDimensions: () => mockWindowDimensions,
}));

jest.mock('@onekeyhq/kit/src/utils/deferHeavyWork', () => ({
  deferHeavyWorkUntilUIIdle: () =>
    new Promise<void>((resolve) => {
      mockDeferredTasks.push(resolve);
    }),
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
    borderBottomWidth,
    borderColor,
    borderTopLeftRadius,
    borderTopRightRadius,
    borderTopWidth,
    borderWidth,
    bottom,
    children,
    h,
    left,
    mb,
    mt,
    overflow,
    pb,
    pointerEvents,
    position,
    right,
    testID,
    top,
    zIndex,
  }: {
    borderBottomWidth?: number | string;
    borderColor?: string;
    borderTopLeftRadius?: number | string;
    borderTopRightRadius?: number | string;
    borderTopWidth?: number | string;
    borderWidth?: number | string;
    bottom?: number;
    children?: ReactNode;
    h?: number;
    left?: number;
    mb?: number | string;
    mt?: number;
    overflow?: string;
    pb?: number;
    pointerEvents?: string;
    position?: string;
    right?: number;
    testID?: string;
    top?: number;
    zIndex?: number;
  }) => (
    <div
      data-border-bottom-width={borderBottomWidth}
      data-border-color={borderColor}
      data-border-top-left-radius={borderTopLeftRadius}
      data-border-top-right-radius={borderTopRightRadius}
      data-border-top-width={borderTopWidth}
      data-border-width={borderWidth}
      data-bottom={bottom}
      data-h={h}
      data-left={left}
      data-mb={mb}
      data-mt={mt}
      data-overflow={overflow}
      data-pb={pb}
      data-pointer-events={pointerEvents}
      data-position={position}
      data-right={right}
      data-testid={testID}
      data-top={top}
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
    showNativeChartCloseControl,
    source,
  }: {
    nativeChartDisplayMode?: string;
    onNativeChartClose?: () => void;
    showNativeChartCloseControl?: boolean;
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
        {onNativeChartClose && showNativeChartCloseControl !== false ? (
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
    mockDeferredTasks.length = 0;
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
    expect(toggle.getAttribute('data-min-height')).toBe('48');
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
    expect(
      getByTestId('perp-mobile-chart-content').querySelector('[data-mt="-4"]'),
    ).toBeTruthy();
    const expandedOverlay = getByTestId('perp-mobile-chart-overlay');
    expect(
      getByTestId('perp-mobile-chart-corner-border').getAttribute(
        'data-border-width',
      ),
    ).toBe('0.5');
    expect(expandedOverlay.getAttribute('data-pb')).toBe('8');
    expect(expandedOverlay.getAttribute('data-border-bottom-width')).toBeNull();

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
    fireEvent.click(view.getByTestId('perp-mobile-chart-toggle'));
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
    ).toBe('212');
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
    expect(overlay.getAttribute('data-border-top-left-radius')).toBe('$2');
    expect(overlay.getAttribute('data-border-top-right-radius')).toBe('$2');
    expect(overlay.getAttribute('data-overflow')).toBe('hidden');
    expect(overlay.getAttribute('data-pb')).toBe('0');

    const cornerBorder = getByTestId('perp-mobile-chart-corner-border');
    expect(cornerBorder.getAttribute('data-position')).toBe('absolute');
    expect(cornerBorder.getAttribute('data-top')).toBe('0');
    expect(cornerBorder.getAttribute('data-h')).toBe('12');
    expect(cornerBorder.getAttribute('data-border-width')).toBe('0.5');
    expect(cornerBorder.getAttribute('data-border-bottom-width')).toBe('0');
    expect(cornerBorder.getAttribute('data-border-color')).toBe(
      '$borderSubdued',
    );
    expect(cornerBorder.getAttribute('data-border-top-left-radius')).toBe('$2');
    expect(cornerBorder.getAttribute('data-border-top-right-radius')).toBe(
      '$2',
    );
  });

  it('reports the full overlay height as the scroll inset while expanded', () => {
    const handleScrollInsetChange = jest.fn();
    const view = render(
      <PerpMobileChartPanel
        bottomOffset={34}
        onScrollInsetChange={handleScrollInsetChange}
      />,
    );

    expect(handleScrollInsetChange).toHaveBeenLastCalledWith(48);

    fireEvent.click(view.getByTestId('perp-mobile-chart-toggle'));

    expect(handleScrollInsetChange).toHaveBeenLastCalledWith(258);

    fireEvent.click(view.getByTestId('mock-native-chart-close'));

    expect(handleScrollInsetChange).toHaveBeenLastCalledWith(48);
  });

  it('renders the top chart as a controlled inline panel', () => {
    const handleClose = jest.fn();
    const view = render(
      <PerpMobileTopChartPanel isExpanded={false} onClose={handleClose} />,
    );

    expect(view.queryByTestId('perp-mobile-top-chart-content')).toBeNull();
    expect(view.queryByTestId('perp-mobile-chart-overlay')).toBeNull();
    expect(view.queryByTestId('perp-mobile-chart-toggle')).toBeNull();

    view.rerender(<PerpMobileTopChartPanel isExpanded onClose={handleClose} />);

    const topChartPanel = view.container.firstElementChild;
    expect(topChartPanel?.getAttribute('data-border-top-width')).toBe('0.5');
    expect(topChartPanel?.getAttribute('data-border-bottom-width')).toBe('0.5');
    expect(topChartPanel?.getAttribute('data-mb')).toBe('$3');
    expect(
      view.getByTestId('perp-mobile-top-chart-content').getAttribute('data-h'),
    ).toBe('250');
    expect(
      view
        .getByTestId('perp-mobile-top-chart-content')
        .querySelector('[data-mt="-4"]'),
    ).toBeTruthy();
    expect(view.getByText('Native chart').getAttribute('data-coin')).toBe(
      'BTC',
    );
    expect(view.queryByTestId('mock-native-chart-close')).toBeNull();

    view.rerender(
      <PerpMobileTopChartPanel isExpanded={false} onClose={handleClose} />,
    );
    expect(
      view.getByTestId('perp-mobile-top-chart-content').getAttribute('data-h'),
    ).toBe('0');
    expect(view.getByText('Native chart')).toBeTruthy();
  });

  it('preloads the collapsed top chart after initial interactions', async () => {
    const view = render(
      <PerpMobileTopChartPanel isExpanded={false} onClose={jest.fn()} />,
    );

    expect(view.queryByTestId('perp-mobile-top-chart-content')).toBeNull();
    expect(mockDeferredTasks).toHaveLength(1);

    await act(async () => {
      mockDeferredTasks[0]?.();
      await Promise.resolve();
    });

    expect(
      view.getByTestId('perp-mobile-top-chart-content').getAttribute('data-h'),
    ).toBe('0');
    expect(view.getByText('Native chart').getAttribute('data-coin')).toBe(
      'BTC',
    );
  });

  it('replaces a hidden top chart after a selected market change', async () => {
    const view = render(
      <PerpMobileTopChartPanel isExpanded onClose={jest.fn()} />,
    );
    view.rerender(
      <PerpMobileTopChartPanel isExpanded={false} onClose={jest.fn()} />,
    );
    expect(view.getByText('Native chart')).toBeTruthy();

    mockActiveCoin = 'ETH';
    view.rerender(
      <PerpMobileTopChartPanel isExpanded={false} onClose={jest.fn()} />,
    );

    expect(view.queryByText('Native chart')).toBeNull();

    expect(mockDeferredTasks).toHaveLength(1);
    await act(async () => {
      mockDeferredTasks[0]?.();
      await Promise.resolve();
    });

    expect(view.getByText('Native chart').getAttribute('data-coin')).toBe(
      'ETH',
    );
  });
});
