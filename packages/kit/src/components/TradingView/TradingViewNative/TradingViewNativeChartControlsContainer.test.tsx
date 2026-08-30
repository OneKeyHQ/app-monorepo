/**
 * @jest-environment jsdom
 */

import type { ReactElement, ReactNode } from 'react';

import { render } from '@testing-library/react';

import type { ITradingViewNativeIndicatorSelection } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls';

import { TradingViewNativeChartControlsContainer } from './TradingViewNativeChartControlsContainer';
import { TRADING_VIEW_NATIVE_INDICATOR_CATALOG } from './utils/chartIndicators/indicatorCatalog';
import { TRADING_VIEW_NATIVE_SUB_INDICATORS } from './utils/chartIndicators/subIndicatorTypes';

type IMockIndicatorListProps = {
  maxSelectableSubIndicatorCount?: number;
  onSelect: (indicatorName: string, desiredActive: boolean) => void;
  onSelectionConfirm?: (
    selection: ITradingViewNativeIndicatorSelection,
  ) => void;
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
  activeChartType: 'candlestick' as const,
  onChartTypeChange: jest.fn(),
  onIndicatorSettingsPress: jest.fn(),
  onIndicatorSelectionConfirm: jest.fn(),
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
        showChartTypeSelect: true,
        showChartTypeToggle: false,
        activeChartType: 1,
        chartTypes: [
          { id: 'candlestick', label: 'Candles', value: 1 },
          { id: 'heikinAshi', label: 'Heikin Ashi', value: 8 },
          { id: 'bars', label: 'Bars', value: 0 },
          { id: 'line', label: 'Line', value: 2 },
          { id: 'area', label: 'Area', value: 3 },
        ],
      }),
    );
  });

  it('maps shared menu values back to native chart types', () => {
    const handleChartTypeChange = jest.fn();
    render(
      <TradingViewNativeChartControlsContainer
        {...defaultIndicatorSettingsProps}
        activeChartType="line"
        activeIndicatorValues={new Set(['MA'])}
        intervalConfig={{ activeInterval: '60', intervals: [] }}
        onChartTypeChange={handleChartTypeChange}
        onIndicatorChange={jest.fn()}
        onIntervalChange={jest.fn()}
      />,
    );

    const controlsProps = mockTradingViewChartControls.mock.calls[0][0] as {
      activeChartType: number;
      onChartTypeChange: (chartType: number) => void;
    };
    expect(controlsProps.activeChartType).toBe(2);

    controlsProps.onChartTypeChange(8);
    controlsProps.onChartTypeChange(21);

    expect(handleChartTypeChange).toHaveBeenCalledTimes(1);
    expect(handleChartTypeChange).toHaveBeenCalledWith('heikinAshi');
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

  it('hides the chart type selector in the compact mobile toolbar', () => {
    render(
      <TradingViewNativeChartControlsContainer
        {...defaultIndicatorSettingsProps}
        activeIndicatorValues={new Set()}
        compactMobileLayout
        intervalConfig={{ activeInterval: '60', intervals: [] }}
        onIndicatorChange={jest.fn()}
        onIntervalChange={jest.fn()}
      />,
    );

    expect(mockTradingViewChartControls).toHaveBeenCalledWith(
      expect.objectContaining({
        compactMobileLayout: true,
        showChartTypeSelect: false,
      }),
    );
  });

  it('replaces the mobile indicator control with a close action', () => {
    const handleChartClose = jest.fn();
    render(
      <TradingViewNativeChartControlsContainer
        {...defaultIndicatorSettingsProps}
        activeIndicatorValues={new Set()}
        intervalConfig={{ activeInterval: '60', intervals: [] }}
        onChartClose={handleChartClose}
        onIndicatorChange={jest.fn()}
        onIntervalChange={jest.fn()}
      />,
    );

    const controlsProps = mockTradingViewChartControls.mock.calls[0][0] as {
      hasVisibleIndicators: boolean;
      rightControl: ReactElement<{
        name: string;
        size: string;
      }>;
      rightControlLabel: string;
      onRightControlPress: () => void;
    };
    expect(controlsProps.hasVisibleIndicators).toBe(false);
    expect(controlsProps.rightControl.props.name).toBe(
      'ChevronDownSmallOutline',
    );
    expect(controlsProps.rightControl.props.size).toBe('$5');
    expect(controlsProps.rightControlLabel).toBe('global.close');

    controlsProps.onRightControlPress();
    expect(handleChartClose).toHaveBeenCalledTimes(1);
  });

  it('can suppress the close action without restoring indicator controls', () => {
    render(
      <TradingViewNativeChartControlsContainer
        {...defaultIndicatorSettingsProps}
        activeIndicatorValues={new Set()}
        intervalConfig={{ activeInterval: '60', intervals: [] }}
        onChartClose={jest.fn()}
        onIndicatorChange={jest.fn()}
        onIntervalChange={jest.fn()}
        showChartCloseControl={false}
      />,
    );

    expect(mockTradingViewChartControls).toHaveBeenCalledWith(
      expect.objectContaining({
        hasVisibleIndicators: false,
        onRightControlPress: undefined,
        rightControl: null,
        rightControlLabel: undefined,
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

  it('delegates desktop indicator settings to the chart owner', () => {
    render(
      <TradingViewNativeChartControlsContainer
        {...defaultIndicatorSettingsProps}
        activeIndicatorValues={new Set(['MA'])}
        intervalConfig={{ activeInterval: '60', intervals: [] }}
        layoutMode="desktop"
        maxSelectableSubIndicatorCount={4}
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

    expect(
      defaultIndicatorSettingsProps.onIndicatorSettingsPress,
    ).toHaveBeenCalledTimes(1);
    expect(mockDialogShow).not.toHaveBeenCalled();
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

  it('forwards the sub-indicator selection cap to dialog and popover controls', () => {
    const handleIndicatorSelectionConfirm = jest.fn();
    render(
      <TradingViewNativeChartControlsContainer
        {...defaultIndicatorSettingsProps}
        activeIndicatorValues={new Set(['MA'])}
        intervalConfig={{ activeInterval: '60', intervals: [] }}
        maxSelectableSubIndicatorCount={4}
        onIndicatorChange={jest.fn()}
        onIndicatorSelectionConfirm={handleIndicatorSelectionConfirm}
        onIntervalChange={jest.fn()}
      />,
    );

    const controlsProps = mockTradingViewChartControls.mock.calls[0][0] as {
      maxSelectableSubIndicatorCount?: number;
      onShowIndicatorsDialog: () => void;
    };
    expect(controlsProps.maxSelectableSubIndicatorCount).toBe(4);

    controlsProps.onShowIndicatorsDialog();
    expect(
      mockDialogShow.mock.calls[0][0].renderContent.props
        .maxSelectableSubIndicatorCount,
    ).toBe(4);
    const selection: ITradingViewNativeIndicatorSelection = {
      activeIndicatorValues: new Set(['MA', 'RSI']),
      replaceMainIndicators: false,
      replaceSubIndicators: true,
    };
    mockDialogShow.mock.calls[0][0].renderContent.props.onSelectionConfirm?.(
      selection,
    );
    expect(handleIndicatorSelectionConfirm).toHaveBeenCalledWith(selection);
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
