/**
 * @jest-environment jsdom
 */

import type { ReactElement, ReactNode } from 'react';

import { render } from '@testing-library/react';

import { TradingViewNativeChartControlsContainer } from './TradingViewNativeChartControlsContainer';

const mockTradingViewChartControls = jest.fn<null, [unknown]>(() => null);
const mockPushModal = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
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
        activeIndicatorValues={new Set(['MA'])}
        intervalConfig={{ activeInterval: '60', intervals: [] }}
        onIndicatorChange={jest.fn()}
        onIntervalChange={jest.fn()}
      />,
    );

    expect(mockTradingViewChartControls).toHaveBeenCalledWith(
      expect.objectContaining({
        backgroundColor: '$transparent',
        hasVisibleIndicators: true,
        hasVisibleIntervalSelector: true,
        indicators: [
          { active: true, label: 'MA', value: 'MA' },
          { active: false, label: 'EMA', value: 'EMA' },
          { active: false, label: 'BOLL', value: 'BOLL' },
          { active: false, label: 'SAR', value: 'SAR' },
        ],
        settingsEnabled: false,
        showIndicatorPopover: false,
        showChartTypeToggle: false,
      }),
    );
  });

  it('keeps chart settings hidden in desktop layout without an opt-in', () => {
    render(
      <TradingViewNativeChartControlsContainer
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

  it('replaces the mobile indicator control with a close action', () => {
    const handleChartClose = jest.fn();
    render(
      <TradingViewNativeChartControlsContainer
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

  it('opens chart settings from opted-in desktop controls', () => {
    render(
      <TradingViewNativeChartControlsContainer
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

  it('toggles indicators directly from the desktop popover', () => {
    const handleIndicatorChange = jest.fn();
    render(
      <TradingViewNativeChartControlsContainer
        activeIndicatorValues={new Set(['MA'])}
        intervalConfig={{ activeInterval: '60', intervals: [] }}
        layoutMode="desktop"
        onIndicatorChange={handleIndicatorChange}
        onIntervalChange={jest.fn()}
      />,
    );

    const controlsProps = mockTradingViewChartControls.mock.calls[0][0] as {
      onIndicatorPress: (indicator: { label: string; value: string }) => void;
      showIndicatorPopover: boolean;
    };
    expect(controlsProps.showIndicatorPopover).toBe(true);

    controlsProps.onIndicatorPress({ label: 'EMA', value: 'EMA' });
    expect(handleIndicatorChange).toHaveBeenCalledWith('EMA', true);
  });

  it('reports fullscreen state changes through the shared chart controls', () => {
    const handleFullscreenChange = jest.fn();
    const fullscreenHeader = <div>Token info</div>;
    const { rerender } = render(
      <TradingViewNativeChartControlsContainer
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
