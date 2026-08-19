/**
 * @jest-environment jsdom
 */

import type { ComponentProps, ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { TradingViewChartControls } from './TradingViewChartControls';

const mockSelectTriggerPress = jest.fn();

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
  Stack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  XStack: ({
    children,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    onPress?: (event: unknown) => void;
    testID?: string;
  }) =>
    onPress ? (
      <button data-testid={testID} onClick={onPress} type="button">
        {children}
      </button>
    ) : (
      <div data-testid={testID}>{children}</div>
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
  TradingViewNativeIntervalSelector: () => null,
}));
jest.mock('./priceMarketCap/PriceMarketCapSelect', () => ({
  PriceMarketCapSelect: () => null,
}));

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
});
