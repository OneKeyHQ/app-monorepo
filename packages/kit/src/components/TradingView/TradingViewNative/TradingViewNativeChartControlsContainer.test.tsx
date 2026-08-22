/**
 * @jest-environment jsdom
 */

import type { ReactElement, ReactNode } from 'react';

import { render } from '@testing-library/react';

import { createTradingViewNativeIndicatorSettings } from '@onekeyhq/shared/types/tradingViewNative';

import { getTradingViewNativeIndicatorSettingsValue } from './indicatorSettingsAdapter';
import { TradingViewNativeChartControlsContainer } from './TradingViewNativeChartControlsContainer';
import { TRADING_VIEW_NATIVE_INDICATOR_CATALOG } from './utils/chartIndicators/indicatorCatalog';
import { TRADING_VIEW_NATIVE_SUB_INDICATORS } from './utils/chartIndicators/subIndicatorTypes';

type IMockIndicatorListProps = {
  maxSubIndicatorCount?: number;
  onSelect: (indicatorName: string, desiredActive: boolean) => void;
};

type IMockDialogConfig = {
  renderContent: ReactElement<
    IMockIndicatorListProps & Record<string, unknown>
  >;
  testID?: string;
};

const mockTradingViewChartControls = jest.fn<null, [unknown]>(() => null);
const mockPushModal = jest.fn();
const mockDialogShow = jest.fn<void, [IMockDialogConfig]>();
const defaultIndicatorSettingsProps = {
  indicatorSettingsValue: getTradingViewNativeIndicatorSettingsValue(
    createTradingViewNativeIndicatorSettings(),
  ),
  onIndicatorSettingsConfirm: jest.fn(),
};

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    show: (config: IMockDialogConfig) => mockDialogShow(config),
  },
}));

jest.mock(
  '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls',
  () => ({
    IndicatorListDialogContent: () => null,
    TradingViewChartControls: (props: unknown) =>
      mockTradingViewChartControls(props),
  }),
);

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => () => ({
  pushModal: mockPushModal,
}));

describe('TradingViewNative chart controls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exposes intervals and the implemented indicators in mobile layout', () => {
    render(
      <TradingViewNativeChartControlsContainer
        {...defaultIndicatorSettingsProps}
        activeIndicatorValues={new Set(['MA'])}
        intervalConfig={{ activeInterval: '60', intervals: [] }}
        onIndicatorChange={jest.fn()}
        onIntervalChange={jest.fn()}
      />,
    );

    const controlsProps = mockTradingViewChartControls.mock.calls[0][0] as {
      indicators: { active: boolean; label: string; value: string }[];
    };

    expect(controlsProps.indicators).toEqual(
      TRADING_VIEW_NATIVE_INDICATOR_CATALOG.map(({ id, label }) => ({
        active: id === 'MA',
        label,
        value: id,
      })),
    );
    expect(
      controlsProps.indicators
        .filter(({ value }) =>
          TRADING_VIEW_NATIVE_SUB_INDICATORS.some(
            (indicator) => indicator === value,
          ),
        )
        .map(({ value }) => value),
    ).toEqual(TRADING_VIEW_NATIVE_SUB_INDICATORS);
    expect(mockTradingViewChartControls).toHaveBeenCalledWith(
      expect.objectContaining({
        backgroundColor: '$transparent',
        hasVisibleIndicators: true,
        hasVisibleIntervalSelector: true,
        settingsEnabled: false,
        showIndicatorPopover: false,
        showChartTypeToggle: false,
      }),
    );
  });

  it('keeps chart settings hidden in desktop layout without an opt-in', () => {
    render(
      <TradingViewNativeChartControlsContainer
        {...defaultIndicatorSettingsProps}
        activeIndicatorValues={new Set(['MA'])}
        intervalConfig={{ activeInterval: '60', intervals: [] }}
        layoutMode="desktop"
        onIndicatorChange={jest.fn()}
        onIntervalChange={jest.fn()}
      />,
    );

    expect(mockTradingViewChartControls).toHaveBeenCalledWith(
      expect.objectContaining({
        settingsEnabled: false,
      }),
    );
  });

  it('opens chart settings from opted-in desktop controls', () => {
    render(
      <TradingViewNativeChartControlsContainer
        {...defaultIndicatorSettingsProps}
        activeIndicatorValues={new Set(['MA'])}
        enableNativeChartSettings
        intervalConfig={{ activeInterval: '60', intervals: [] }}
        layoutMode="desktop"
        onIndicatorChange={jest.fn()}
        onIntervalChange={jest.fn()}
      />,
    );

    expect(mockTradingViewChartControls).toHaveBeenCalledWith(
      expect.objectContaining({
        settingsEnabled: true,
      }),
    );

    const controlsProps = mockTradingViewChartControls.mock.calls[0][0] as {
      onSettingsPress: () => void;
    };
    controlsProps.onSettingsPress();

    expect(mockPushModal).toHaveBeenCalledWith('MarketModal', {
      screen: 'MarketChartSettings',
    });
  });

  it('enables calendar navigation in desktop controls', () => {
    const handleCalendarPanelOpen = jest.fn();
    const handleCalendarPanelSubmit = jest.fn();
    render(
      <TradingViewNativeChartControlsContainer
        {...defaultIndicatorSettingsProps}
        activeIndicatorValues={new Set(['MA'])}
        calendarAvailableTimeRange={{ from: 100 }}
        intervalConfig={{ activeInterval: '60', intervals: [] }}
        layoutMode="desktop"
        onIndicatorChange={jest.fn()}
        onIntervalChange={jest.fn()}
        onCalendarPanelOpen={handleCalendarPanelOpen}
        onCalendarPanelSubmit={handleCalendarPanelSubmit}
      />,
    );

    expect(mockTradingViewChartControls).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarAvailableTimeRange: { from: 100 },
        chartTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        onCalendarPanelOpen: handleCalendarPanelOpen,
        onCalendarPanelSubmit: handleCalendarPanelSubmit,
      }),
    );
  });

  it('forwards the chart switch action to the shared controls', () => {
    const handleChartSwitch = jest.fn();
    render(
      <TradingViewNativeChartControlsContainer
        {...defaultIndicatorSettingsProps}
        activeIndicatorValues={new Set(['MA'])}
        intervalConfig={{ activeInterval: '60', intervals: [] }}
        isChartSwitchDisabled
        onChartSwitch={handleChartSwitch}
        onIndicatorChange={jest.fn()}
        onIntervalChange={jest.fn()}
      />,
    );

    const controlsProps = mockTradingViewChartControls.mock.calls[0][0] as {
      chartMode: string;
      isChartSwitchDisabled: boolean;
      onChartSwitch: () => void;
    };
    expect(controlsProps.chartMode).toBe('native');
    expect(controlsProps.isChartSwitchDisabled).toBe(true);
    controlsProps.onChartSwitch();

    expect(handleChartSwitch).toHaveBeenCalledTimes(1);
  });

  it('opens and confirms the persisted indicator settings dialog on desktop', async () => {
    render(
      <TradingViewNativeChartControlsContainer
        {...defaultIndicatorSettingsProps}
        activeIndicatorValues={new Set(['MA'])}
        intervalConfig={{ activeInterval: '60', intervals: [] }}
        layoutMode="desktop"
        onIndicatorChange={jest.fn()}
        onIntervalChange={jest.fn()}
      />,
    );

    const controlsProps = mockTradingViewChartControls.mock.calls[0][0] as {
      onShowIndicatorsDialog: () => void;
      showIndicatorPopover: boolean;
    };
    expect(controlsProps.showIndicatorPopover).toBe(false);
    controlsProps.onShowIndicatorsDialog();

    expect(mockDialogShow).toHaveBeenCalledWith(
      expect.objectContaining({
        showFooter: false,
        showHeader: false,
        testID: 'trading-view-native-indicator-settings-dialog',
      }),
    );
    const dialogContent = mockDialogShow.mock.calls[0][0]
      .renderContent as unknown as ReactElement<{
      createDefaultValue: () => ReturnType<
        typeof getTradingViewNativeIndicatorSettingsValue
      >;
      onConfirm: (
        value: ReturnType<typeof getTradingViewNativeIndicatorSettingsValue>,
      ) => Promise<void>;
    }>;
    const resetValue = dialogContent.props.createDefaultValue();
    const ma = resetValue.indicators.find((indicator) => indicator.id === 'MA');
    expect(ma).toBeDefined();
    if (ma) {
      ma.active = true;
    }

    await dialogContent.props.onConfirm(resetValue);

    expect(
      defaultIndicatorSettingsProps.onIndicatorSettingsConfirm,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        mainIndicators: expect.arrayContaining([
          expect.objectContaining({ active: true, id: 'MA' }),
        ]),
      }),
    );
  });

  it('selects subpane indicators from the mobile dialog', () => {
    const handleIndicatorChange = jest.fn();
    render(
      <TradingViewNativeChartControlsContainer
        {...defaultIndicatorSettingsProps}
        activeIndicatorValues={new Set(['MA'])}
        intervalConfig={{ activeInterval: '60', intervals: [] }}
        onIndicatorChange={handleIndicatorChange}
        onIntervalChange={jest.fn()}
      />,
    );

    const controlsProps = mockTradingViewChartControls.mock.calls[0][0] as {
      onShowIndicatorsDialog: () => void;
    };
    controlsProps.onShowIndicatorsDialog();

    expect(mockDialogShow).toHaveBeenCalledWith(
      expect.objectContaining({
        testID: 'trading-view-native-indicators-dialog',
      }),
    );
    const dialogConfig = mockDialogShow.mock.calls[0][0];
    dialogConfig.renderContent.props.onSelect('RSI', true);

    expect(handleIndicatorChange).toHaveBeenCalledWith('RSI', true);
  });

  it('forwards the sub-indicator cap to the dialog and popover controls', () => {
    render(
      <TradingViewNativeChartControlsContainer
        {...defaultIndicatorSettingsProps}
        activeIndicatorValues={new Set(['MA'])}
        intervalConfig={{ activeInterval: '60', intervals: [] }}
        maxNativeSubIndicatorCount={4}
        onIndicatorChange={jest.fn()}
        onIntervalChange={jest.fn()}
      />,
    );

    const controlsProps = mockTradingViewChartControls.mock.calls[0][0] as {
      maxSubIndicatorCount?: number;
      onShowIndicatorsDialog: () => void;
    };
    expect(controlsProps.maxSubIndicatorCount).toBe(4);

    controlsProps.onShowIndicatorsDialog();
    expect(
      mockDialogShow.mock.calls[0][0].renderContent.props.maxSubIndicatorCount,
    ).toBe(4);
  });

  it('reports fullscreen state changes through the shared chart controls', () => {
    const handleFullscreenChange = jest.fn();
    const fullscreenHeader = <div>Token info</div>;
    const { rerender } = render(
      <TradingViewNativeChartControlsContainer
        {...defaultIndicatorSettingsProps}
        activeIndicatorValues={new Set(['MA'])}
        intervalConfig={{ activeInterval: '60', intervals: [] }}
        isFullscreen={false}
        fullscreenHeader={fullscreenHeader}
        onIndicatorChange={jest.fn()}
        onIntervalChange={jest.fn()}
        onFullscreenChange={handleFullscreenChange}
      />,
    );

    let controlsProps = mockTradingViewChartControls.mock.calls.at(-1)?.[0] as {
      isFullscreen: boolean;
      fullscreenHeader: ReactNode;
      onFullscreenToggle: () => void;
    };
    expect(controlsProps).toEqual(
      expect.objectContaining({
        isFullscreen: false,
        fullscreenHeader,
      }),
    );

    controlsProps.onFullscreenToggle();
    expect(handleFullscreenChange).toHaveBeenLastCalledWith(true);

    rerender(
      <TradingViewNativeChartControlsContainer
        {...defaultIndicatorSettingsProps}
        activeIndicatorValues={new Set(['MA'])}
        intervalConfig={{ activeInterval: '60', intervals: [] }}
        isFullscreen
        fullscreenHeader={fullscreenHeader}
        onIndicatorChange={jest.fn()}
        onIntervalChange={jest.fn()}
        onFullscreenChange={handleFullscreenChange}
      />,
    );
    controlsProps = mockTradingViewChartControls.mock.calls.at(-1)?.[0] as {
      isFullscreen: boolean;
      fullscreenHeader: ReactNode;
      onFullscreenToggle: () => void;
    };
    controlsProps.onFullscreenToggle();

    expect(handleFullscreenChange).toHaveBeenLastCalledWith(false);
  });
});
