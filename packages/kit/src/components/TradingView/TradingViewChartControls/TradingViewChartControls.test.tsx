/** @jest-environment jsdom */

import type { ComponentProps, ReactNode } from 'react';

import { fireEvent, render } from '@testing-library/react';

import { TradingViewChartControls } from './TradingViewChartControls';

const mockTradingViewNativeIntervalSelector = jest.fn<null, [unknown]>(
  () => null,
);

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  IconButton: () => null,
  ScrollView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
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
    children,
    onPress,
    testID,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
  }) => {
    const Element = onPress ? 'button' : 'div';
    return (
      <Element
        aria-label={accessibilityLabel}
        data-testid={testID}
        onClick={onPress}
        type={onPress ? 'button' : undefined}
      >
        {children}
      </Element>
    );
  },
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
jest.mock('./utils/NativeChartControlsShared', () => ({
  HEADER_ICON_BUTTON_STYLE_PROPS: {},
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

describe('TradingViewChartControls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps default active interval backgrounds outside compact mode', () => {
    const { rerender } = render(<TradingViewChartControls {...BASE_PROPS} />);

    expect(mockTradingViewNativeIntervalSelector).toHaveBeenLastCalledWith(
      expect.objectContaining({
        compactMobileLayout: false,
        showActiveBackground: true,
      }),
    );

    rerender(<TradingViewChartControls {...BASE_PROPS} compactMobileLayout />);
    expect(mockTradingViewNativeIntervalSelector).toHaveBeenLastCalledWith(
      expect.objectContaining({
        compactMobileLayout: true,
        showActiveBackground: false,
      }),
    );
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
        rightControl={<span>Chevron</span>}
        rightControlLabel="Close chart"
        onRightControlPress={handleClose}
      />,
    );

    fireEvent.click(getByTestId('interval-selector'));
    expect(handleClose).not.toHaveBeenCalled();

    const closeArea = getByTestId('trading-view-native-chart-close');
    expect(closeArea.getAttribute('aria-label')).toBe('Close chart');
    fireEvent.click(closeArea);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
