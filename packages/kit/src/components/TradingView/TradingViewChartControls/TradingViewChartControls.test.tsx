/**
 * @jest-environment jsdom
 */

import type { ComponentProps, ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { TradingViewChartControls } from './TradingViewChartControls';

const mockSelectTriggerPress = jest.fn();
const mockTradingViewNativeIntervalSelector = jest.fn<null, [unknown]>(
  () => null,
);

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Icon: () => null,
  IconButton: ({
    onPress,
    testID,
    title,
  }: {
    onPress?: () => void;
    testID?: string;
    title?: string;
  }) => (
    <button data-testid={testID} onClick={onPress} type="button">
      {title}
    </button>
  ),
  ScrollView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Select: ({
    disabled,
    items,
    onChange,
    renderTrigger,
    testID,
  }: {
    disabled?: boolean;
    items: { label: string; value: string }[];
    onChange: (value: string) => void;
    renderTrigger: (props: {
      disabled: boolean;
      onPress: () => void;
    }) => ReactNode;
    testID?: string;
  }) => (
    <div data-disabled={disabled ? 'true' : 'false'} data-testid={testID}>
      {renderTrigger({
        disabled: Boolean(disabled),
        onPress: mockSelectTriggerPress,
      })}
      {items.map((item) => (
        <button
          data-testid={`chart-mode-option-${item.value}`}
          disabled={disabled}
          key={item.value}
          onClick={() => onChange(item.value)}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  ),
  SizableText: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  Stack: ({
    borderBottomColor,
    borderBottomWidth,
    children,
    pb,
    pt,
    py,
  }: {
    borderBottomColor?: string;
    borderBottomWidth?: number;
    children?: ReactNode;
    pb?: string;
    pt?: string;
    py?: string;
  }) => (
    <div
      data-border-bottom-color={borderBottomColor}
      data-border-bottom-width={borderBottomWidth}
      data-pb={pb}
      data-pt={pt}
      data-py={py}
    >
      {children}
    </div>
  ),
  XStack: ({
    accessibilityLabel,
    alignSelf,
    children,
    flex,
    onPress,
    gap,
    pr,
    testID,
  }: {
    accessibilityLabel?: string;
    alignSelf?: string;
    children?: ReactNode;
    flex?: number;
    gap?: string;
    onPress?: (event: unknown) => void;
    pr?: string;
    testID?: string;
  }) =>
    onPress ? (
      <button
        aria-label={accessibilityLabel}
        data-align-self={alignSelf}
        data-flex={flex}
        data-gap={gap}
        data-pr={pr}
        data-testid={testID}
        onClick={onPress}
        type="button"
      >
        {children}
      </button>
    ) : (
      <div
        aria-label={accessibilityLabel}
        data-align-self={alignSelf}
        data-flex={flex}
        data-gap={gap}
        data-pr={pr}
        data-testid={testID}
      >
        {children}
      </div>
    ),
}));

jest.mock('./calendarControls/CalendarPanelPopover', () => ({
  CalendarPanelPopover: () => null,
}));
jest.mock('./chartType/ChartTypeSelect', () => ({
  ChartTypeSelect: () => null,
}));
jest.mock('./indicatorSelector/NativeIndicatorSelector', () => ({
  IndicatorPopover: () => null,
}));
jest.mock('./intervalSelector/NativeIntervalSelector', () => ({
  TradingViewNativeIntervalSelector: (props: unknown) => {
    mockTradingViewNativeIntervalSelector(props);
    return (
      <button data-testid="interval-selector" type="button">
        Intervals
      </button>
    );
  },
}));
jest.mock('./priceMarketCap/PriceMarketCapSelect', () => ({
  PriceMarketCapSelect: () => null,
}));

const BASE_PROPS: ComponentProps<typeof TradingViewChartControls> = {
  activeChartType: undefined,
  activeIndicatorValues: new Set(),
  calendarAvailableTimeRange: undefined,
  chartSettingsTitle: 'Settings',
  chartStyleTitle: 'Style',
  chartTimezone: 'UTC',
  chartTypeToggleIcon: 'TradingViewCandlesOutline',
  chartTypes: [],
  fullscreenHeader: undefined,
  hasVisibleControls: true,
  hasVisibleIndicators: false,
  hasVisibleIntervalSelector: true,
  indicators: [],
  indicatorsTitle: 'Indicators',
  intervalConfig: { activeInterval: '60', intervals: [] },
  intervalControlMode: 'dialog',
  isControlsReady: true,
  isFullscreen: false,
  layoutMode: 'mobile',
  nextChartTypeLabel: 'Chart type',
  onChartTypeChange: jest.fn(),
  onChartTypeToggle: jest.fn(),
  onIndicatorPress: jest.fn(),
  onIntervalChange: jest.fn(),
  onPriceMarketCapModeChange: jest.fn(),
  onSettingsPress: jest.fn(),
  onShowIndicatorsDialog: jest.fn(),
  priceMarketCap: undefined,
  settingsEnabled: false,
  showChartTypeSelect: false,
  showChartTypeToggle: false,
  showIndicatorPopover: false,
  showPriceMarketCapSelect: false,
};

function renderChartControls(
  overrides: Partial<ComponentProps<typeof TradingViewChartControls>> = {},
) {
  const props: ComponentProps<typeof TradingViewChartControls> = {
    intervalConfig: null,
    activeChartType: undefined,
    activeIndicatorValues: new Set(),
    chartSettingsTitle: 'Settings',
    chartStyleTitle: 'Chart style',
    chartTypeToggleIcon: 'TradingViewCandlesOutline',
    chartTypes: [],
    hasVisibleControls: false,
    hasVisibleIndicators: false,
    hasVisibleIntervalSelector: false,
    indicators: [],
    indicatorsTitle: 'Indicators',
    nextChartTypeLabel: 'Next chart type',
    priceMarketCap: undefined,
    settingsEnabled: false,
    showChartTypeSelect: false,
    showChartTypeToggle: false,
    showIndicatorPopover: false,
    showPriceMarketCapSelect: false,
    isControlsReady: true,
    intervalControlMode: 'dialog',
    layoutMode: 'mobile',
    chartTimezone: 'UTC',
    isFullscreen: false,
    onIntervalChange: jest.fn(),
    onIndicatorPress: jest.fn(),
    onShowIndicatorsDialog: jest.fn(),
    onChartTypeChange: jest.fn(),
    onChartTypeToggle: jest.fn(),
    onPriceMarketCapModeChange: jest.fn(),
    onSettingsPress: jest.fn(),
    ...overrides,
  };

  return render(<TradingViewChartControls {...props} />);
}

describe('TradingView chart controls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders a chart mode select and switches to the other chart', () => {
    const handleChartSwitch = jest.fn();

    renderChartControls({
      chartMode: 'native',
      onChartSwitch: handleChartSwitch,
    });

    expect(
      screen.getByTestId('trading-view-chart-switch-trigger').textContent,
    ).toBe('Original');

    fireEvent.click(screen.getByTestId('trading-view-chart-switch-trigger'));
    expect(mockSelectTriggerPress).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('chart-mode-option-native'));
    expect(handleChartSwitch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('chart-mode-option-tradingView'));

    expect(handleChartSwitch).toHaveBeenCalledTimes(1);
  });

  it('disables switching to TradingView until its parameters are ready', () => {
    const handleChartSwitch = jest.fn();

    renderChartControls({
      chartMode: 'native',
      isChartSwitchDisabled: true,
      onChartSwitch: handleChartSwitch,
    });

    expect(
      screen.getByTestId('trading-view-chart-switch').dataset.disabled,
    ).toBe('true');

    fireEvent.click(screen.getByTestId('trading-view-chart-switch-trigger'));
    fireEvent.click(screen.getByTestId('chart-mode-option-tradingView'));

    expect(mockSelectTriggerPress).not.toHaveBeenCalled();
    expect(handleChartSwitch).not.toHaveBeenCalled();
  });

  it.each(['desktop', 'mobile'] as const)(
    'keeps recovery controls interactive while %s chart controls load',
    (layoutMode) => {
      const handleChartSwitch = jest.fn();
      const handleFullscreenToggle = jest.fn();

      renderChartControls({
        chartMode: 'tradingView',
        isControlsReady: false,
        isFullscreen: true,
        layoutMode,
        onChartSwitch: handleChartSwitch,
        onFullscreenToggle: handleFullscreenToggle,
      });

      const readyControls = screen.getByTestId(
        'trading-view-chart-ready-controls',
      );
      const chartSwitch = screen.getByTestId(
        'trading-view-chart-switch-trigger',
      );
      const fullscreenToggle = screen.getByTestId(
        'trading-view-native-fullscreen-toggle',
      );

      expect(readyControls.contains(chartSwitch)).toBe(false);
      expect(readyControls.contains(fullscreenToggle)).toBe(false);

      fireEvent.click(screen.getByTestId('chart-mode-option-native'));
      fireEvent.click(fullscreenToggle);

      expect(handleChartSwitch).toHaveBeenCalledTimes(1);
      expect(handleFullscreenToggle).toHaveBeenCalledTimes(1);
    },
  );

  it('keeps default active interval backgrounds outside compact mode', () => {
    const { rerender } = render(<TradingViewChartControls {...BASE_PROPS} />);

    expect(mockTradingViewNativeIntervalSelector).toHaveBeenLastCalledWith(
      expect.objectContaining({
        compactMobileLayout: false,
        fullWidth: false,
        showActiveBackground: true,
      }),
    );

    rerender(<TradingViewChartControls {...BASE_PROPS} compactMobileLayout />);
    expect(mockTradingViewNativeIntervalSelector).toHaveBeenLastCalledWith(
      expect.objectContaining({
        compactMobileLayout: true,
        fullWidth: true,
        showActiveBackground: false,
      }),
    );
    expect(
      screen
        .getByTestId('trading-view-chart-ready-controls')
        .getAttribute('data-gap'),
    ).toBe('$0');
  });
  it('tightens vertical padding only for compact mobile charts', () => {
    const view = render(
      <TradingViewChartControls {...BASE_PROPS} compactMobileLayout />,
    );

    expect(view.container.firstElementChild?.getAttribute('data-pt')).toBe(
      '$1.5',
    );
    expect(view.container.firstElementChild?.getAttribute('data-pb')).toBe(
      '$0.5',
    );
    expect(mockTradingViewNativeIntervalSelector).toHaveBeenLastCalledWith(
      expect.objectContaining({ compactMobileLayout: true }),
    );
    expect(
      view.container.firstElementChild?.getAttribute(
        'data-border-bottom-width',
      ),
    ).toBe('0.5');
    expect(
      view.container.firstElementChild?.getAttribute(
        'data-border-bottom-color',
      ),
    ).toBe('$borderSubdued');

    view.rerender(<TradingViewChartControls {...BASE_PROPS} />);
    expect(view.container.firstElementChild?.getAttribute('data-py')).toBe(
      '$2',
    );
    expect(
      view.container.firstElementChild?.getAttribute(
        'data-border-bottom-width',
      ),
    ).toBe('0');
  });
  it('uses the full remaining mobile toolbar area as the close action', () => {
    const handleClose = jest.fn();
    const { getByTestId } = render(
      <TradingViewChartControls
        {...BASE_PROPS}
        compactMobileLayout
        rightControl={<span>Chevron</span>}
        rightControlLabel="Close chart"
        onRightControlPress={handleClose}
      />,
    );

    fireEvent.click(getByTestId('interval-selector'));
    expect(handleClose).not.toHaveBeenCalled();
    expect(mockTradingViewNativeIntervalSelector).toHaveBeenLastCalledWith(
      expect.objectContaining({ fullWidth: false }),
    );
    expect(
      getByTestId('trading-view-chart-ready-controls').getAttribute('data-gap'),
    ).toBe('$2');
    expect(
      getByTestId('interval-selector').parentElement?.getAttribute('data-flex'),
    ).toBeNull();

    const closeArea = getByTestId('trading-view-native-chart-close');
    expect(closeArea.getAttribute('aria-label')).toBe('Close chart');
    expect(closeArea.getAttribute('data-flex')).toBe('1');
    expect(closeArea.getAttribute('data-align-self')).toBe('stretch');
    expect(closeArea.getAttribute('data-pr')).toBe('$2');
    fireEvent.click(closeArea);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
