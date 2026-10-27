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
  enableNativeChartSettings = true,
  layoutMode = 'mobile',
  onChartSwitch,
  onControlInteraction,
  onOpenChartSettings,
}: {
  enableNativeChartSettings?: boolean;
  layoutMode?: 'mobile' | 'desktop';
  onChartSwitch?: () => void;
  onControlInteraction?: () => void;
  onOpenChartSettings?: () => void;
}) {
  return render(
    <TradingViewV2ChartControlsContainer
      enableNativeChartSettings={enableNativeChartSettings}
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
      onControlInteraction={onControlInteraction}
      onOpenChartSettings={onOpenChartSettings}
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

  it.each<{
    enableNativeChartSettings: boolean;
    layoutMode: 'desktop' | 'mobile';
  }>([
    { enableNativeChartSettings: false, layoutMode: 'desktop' },
    { enableNativeChartSettings: true, layoutMode: 'desktop' },
    { enableNativeChartSettings: false, layoutMode: 'mobile' },
    { enableNativeChartSettings: true, layoutMode: 'mobile' },
  ])(
    'opens built-in $layoutMode chart settings when native settings are enabled: $enableNativeChartSettings',
    ({ enableNativeChartSettings, layoutMode }) => {
      const onControlInteraction = jest.fn();
      const onOpenChartSettings = jest.fn();
      renderControls({
        enableNativeChartSettings,
        layoutMode,
        onChartSwitch: layoutMode === 'desktop' ? jest.fn() : undefined,
        onControlInteraction,
        onOpenChartSettings,
      });

      const controlsProps = mockTradingViewChartControls.mock.calls[0][0] as {
        onSettingsPress: () => void;
      };
      controlsProps.onSettingsPress();

      expect(onControlInteraction).toHaveBeenCalledTimes(1);
      expect(onOpenChartSettings).toHaveBeenCalledTimes(1);
      expect(onControlInteraction.mock.invocationCallOrder[0]).toBeLessThan(
        onOpenChartSettings.mock.invocationCallOrder[0],
      );
      expect(mockDialogShow).not.toHaveBeenCalled();
      expect(mockShowTradingViewChartSettingsDialog).not.toHaveBeenCalled();
    },
  );

  it('opens built-in settings from the mobile dialog while keeping the chart switch', () => {
    const onChartSwitch = jest.fn();
    const onOpenChartSettings = jest.fn();
    renderControls({ onChartSwitch, onOpenChartSettings });

    const controlsProps = mockTradingViewChartControls.mock.calls[0][0] as {
      onSettingsPress: () => void;
    };
    controlsProps.onSettingsPress();

    expect(onOpenChartSettings).not.toHaveBeenCalled();
    const settingsProps = mockDialogShow.mock.calls[0][0].renderContent
      .props as IMobileSettingsProps;
    expect(settingsProps.onChartSwitch).toBe(onChartSwitch);
    settingsProps.onOpenSettings();

    expect(onOpenChartSettings).toHaveBeenCalledTimes(1);
    expect(mockShowTradingViewChartSettingsDialog).not.toHaveBeenCalled();
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
