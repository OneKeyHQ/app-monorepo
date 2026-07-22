/**
 * @jest-environment jsdom
 */

import { render } from '@testing-library/react';

import { TradingViewNativeChartControlsContainer } from './TradingViewNativeChartControlsContainer';

const mockTradingViewChartControls = jest.fn<null, [unknown]>(() => null);
const mockShowTradingViewChartSettingsDialog = jest.fn<void, []>();

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock(
  '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls',
  () => ({
    TradingViewChartControls: (props: unknown) =>
      mockTradingViewChartControls(props),
  }),
);

jest.mock(
  '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls/chartSettings',
  () => ({
    showTradingViewChartSettingsDialog: () => {
      mockShowTradingViewChartSettingsDialog();
    },
  }),
);

describe('TradingViewNative chart controls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('only exposes the implemented interval control in mobile layout', () => {
    render(
      <TradingViewNativeChartControlsContainer
        intervalConfig={{ activeInterval: '60', intervals: [] }}
        onIntervalChange={jest.fn()}
      />,
    );

    expect(mockTradingViewChartControls).toHaveBeenCalledWith(
      expect.objectContaining({
        hasVisibleIndicators: false,
        hasVisibleIntervalSelector: true,
        settingsEnabled: false,
        showChartTypeToggle: false,
      }),
    );
  });

  it('keeps chart settings hidden in desktop layout without an opt-in', () => {
    render(
      <TradingViewNativeChartControlsContainer
        intervalConfig={{ activeInterval: '60', intervals: [] }}
        layoutMode="desktop"
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
        enableNativeChartSettings
        intervalConfig={{ activeInterval: '60', intervals: [] }}
        layoutMode="desktop"
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

    expect(mockShowTradingViewChartSettingsDialog).toHaveBeenCalledTimes(1);
  });
});
