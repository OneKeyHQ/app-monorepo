/**
 * @jest-environment jsdom
 */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { TradingViewChartControls } from './TradingViewChartControls';

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
    items,
    onChange,
    renderTrigger,
    testID,
  }: {
    items: { label: string; value: string }[];
    onChange: (value: string) => void;
    renderTrigger: (props: {
      disabled: boolean;
      onPress: () => void;
    }) => ReactNode;
    testID?: string;
  }) => (
    <div data-testid={testID}>
      {renderTrigger({ disabled: false, onPress: jest.fn() })}
      {items.map((item) => (
        <button
          data-testid={`chart-mode-option-${item.value}`}
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
  XStack: ({ children, testID }: { children?: ReactNode; testID?: string }) => (
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

describe('TradingView chart controls', () => {
  it('renders a chart mode select and switches to the other chart', () => {
    const handleChartSwitch = jest.fn();

    render(
      <TradingViewChartControls
        intervalConfig={null}
        activeChartType={undefined}
        activeIndicatorValues={new Set()}
        chartSettingsTitle="Settings"
        chartStyleTitle="Chart style"
        chartTypeToggleIcon="TradingViewCandlesOutline"
        chartTypes={[]}
        hasVisibleControls={false}
        hasVisibleIndicators={false}
        hasVisibleIntervalSelector={false}
        indicators={[]}
        indicatorsTitle="Indicators"
        nextChartTypeLabel="Next chart type"
        priceMarketCap={undefined}
        settingsEnabled={false}
        showChartTypeSelect={false}
        showChartTypeToggle={false}
        showIndicatorPopover={false}
        showPriceMarketCapSelect={false}
        isControlsReady
        intervalControlMode="dialog"
        layoutMode="mobile"
        chartTimezone="UTC"
        isFullscreen={false}
        chartMode="native"
        onChartSwitch={handleChartSwitch}
        onIntervalChange={jest.fn()}
        onIndicatorPress={jest.fn()}
        onShowIndicatorsDialog={jest.fn()}
        onChartTypeChange={jest.fn()}
        onChartTypeToggle={jest.fn()}
        onPriceMarketCapModeChange={jest.fn()}
        onSettingsPress={jest.fn()}
      />,
    );

    expect(
      screen.getByTestId('trading-view-chart-switch-trigger').textContent,
    ).toBe('Original');

    fireEvent.click(screen.getByTestId('chart-mode-option-native'));
    expect(handleChartSwitch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('chart-mode-option-tradingView'));

    expect(handleChartSwitch).toHaveBeenCalledTimes(1);
  });
});
