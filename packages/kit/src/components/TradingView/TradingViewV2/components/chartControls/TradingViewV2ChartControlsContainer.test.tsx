/** @jest-environment jsdom */

import type { ReactElement } from 'react';

import { render } from '@testing-library/react';

import { TradingViewV2ChartControlsContainer } from './TradingViewV2ChartControlsContainer';

type IMobileSettingsProps = {
  chartMode: 'tradingView';
  onChartSwitch?: () => void;
  onOpenSettings: () => void;
};

type IDialogConfig = {
  renderContent: ReactElement<Record<string, unknown>>;
  testID?: string;
};

const mockDialogShow = jest.fn<void, [IDialogConfig]>();
const mockShowTradingViewChartSettingsDialog = jest.fn<void, []>();
const mockTradingViewChartControls = jest.fn<null, [Record<string, unknown>]>(
  () => null,
);

jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    show: (config: IDialogConfig) => mockDialogShow(config),
  },
}));

jest.mock(
  '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls',
  () => ({
    IndicatorListDialogContent: () => null,
    TradingViewChartControls: (props: Record<string, unknown>) =>
      mockTradingViewChartControls(props),
  }),
);

jest.mock(
  '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls/chartSettings',
  () => ({
    ChartSettingsDialogContent: () => null,
    showTradingViewChartSettingsDialog: () =>
      mockShowTradingViewChartSettingsDialog(),
  }),
);

jest.mock(
  '@onekeyhq/kit/src/components/TradingView/TradingViewNative/TradingViewMobileChartSettingsDialogContent',
  () => ({
    TradingViewMobileChartSettingsDialogContent: () => null,
  }),
);

jest.mock('../indicatorControls/hooks/useNativeIndicatorActiveValues', () => ({
  canToggleTradingViewNativeIndicatorOn: () => true,
}));

jest.mock('./hooks/useNativeChartControls', () => ({
  useNativeChartControls: () => ({
    activeChartType: 1,
    activeIndicatorValues: new Set(),
    chartSettingsTitle: 'Chart settings',
    chartStyleTitle: 'Chart style',
    chartTypeToggleIcon: 'TradingViewCandlesOutline',
    chartTypes: [],
    hasVisibleControls: true,
    hasVisibleIndicators: false,
    hasVisibleIntervalSelector: true,
    indicators: [],
    indicatorsTitle: 'Indicators',
    nextChartType: undefined,
    nextChartTypeLabel: 'Chart type',
    priceMarketCap: undefined,
    priceMarketCapSettings: undefined,
    priceScale: undefined,
    resetLayout: jest.fn(),
    settingsEnabled: true,
    showChartTypeSelect: false,
    showChartTypeToggle: false,
    showIndicatorPopover: false,
    showPriceMarketCapSelect: false,
  }),
}));

function renderControls({
  layoutMode = 'mobile',
  onChartSwitch,
}: {
  layoutMode?: 'mobile' | 'desktop';
  onChartSwitch?: () => void;
}) {
  return render(
    <TradingViewV2ChartControlsContainer
      enableNativeChartSettings
      intervalConfig={{ activeInterval: '60', intervals: [] }}
      nativeChartControlsConfig={null}
      nativeIndicatorState={{
        activeIndicatorValues: new Set(),
        getActiveIndicatorValues: () => new Set(),
        isInitialized: true,
        sourceIndicators: [],
        updateActiveIndicatorValue: jest.fn(),
      }}
      layoutMode={layoutMode}
      chartTimezone="UTC"
      onChartSwitch={onChartSwitch}
      onIntervalChange={jest.fn()}
      onIndicatorSelect={jest.fn()}
      onChartTypeChange={jest.fn()}
      onResetLayout={jest.fn()}
      onPriceScaleModeChange={jest.fn()}
      onPriceMarketCapModeChange={jest.fn()}
    />,
  );
}

describe('TradingViewV2ChartControlsContainer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens mobile settings with the TradingView source switch', () => {
    const handleChartSwitch = jest.fn();
    renderControls({ onChartSwitch: handleChartSwitch });

    const controlsProps = mockTradingViewChartControls.mock.calls[0][0] as {
      onSettingsPress: () => void;
    };
    controlsProps.onSettingsPress();

    expect(mockDialogShow).toHaveBeenCalledWith(
      expect.objectContaining({
        testID: 'trading-view-native-chart-settings-quick-dialog',
      }),
    );
    const settingsProps = mockDialogShow.mock.calls[0][0].renderContent
      .props as IMobileSettingsProps;
    expect(settingsProps).toEqual(
      expect.objectContaining({
        chartMode: 'tradingView',
        onChartSwitch: handleChartSwitch,
      }),
    );
    settingsProps.onOpenSettings();
    expect(mockShowTradingViewChartSettingsDialog).toHaveBeenCalledTimes(1);
  });

  it('keeps desktop settings on the full settings dialog', () => {
    renderControls({ layoutMode: 'desktop', onChartSwitch: jest.fn() });

    const controlsProps = mockTradingViewChartControls.mock.calls[0][0] as {
      onSettingsPress: () => void;
    };
    controlsProps.onSettingsPress();

    expect(mockDialogShow).not.toHaveBeenCalled();
    expect(mockShowTradingViewChartSettingsDialog).toHaveBeenCalledTimes(1);
  });
});
