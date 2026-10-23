/**
 * @jest-environment jsdom
 */

import { render } from '@testing-library/react';

import {
  TradingViewNativeChartSettingsButton,
  getTradingViewNativeChartSettingsButtonRight,
} from './TradingViewNativeChartSettingsButton';

const mockIconButton = jest.fn<null, [Record<string, unknown>]>(() => null);
const mockPushModal = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  IconButton: (props: Record<string, unknown>) => mockIconButton(props),
}));

jest.mock(
  '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls/utils/NativeChartControlsShared',
  () => ({
    HEADER_ICON_BUTTON_STYLE_PROPS: {
      bg: '$transparent',
    },
  }),
);

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => () => ({
  pushModal: mockPushModal,
}));

const pressSettingsButton = () => {
  const buttonProps = mockIconButton.mock.calls[0][0] as {
    onPress: () => void;
  };
  buttonProps.onPress();
};

describe('TradingViewNativeChartSettingsButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('centers the small borderless trigger in the native price axis', () => {
    render(<TradingViewNativeChartSettingsButton priceAxisWidth={60} />);

    expect(mockIconButton).toHaveBeenCalledWith(
      expect.objectContaining({
        accessibilityLabel: 'market.chart_settings',
        bg: '$bgApp',
        borderWidth: 0,
        bottom: 0,
        height: 24,
        icon: 'SettingsOutline',
        iconSize: '$4',
        position: 'absolute',
        right: 18,
        testID: 'trading-view-native-chart-settings-trigger',
        width: 24,
        zIndex: 3,
      }),
    );
    expect(mockIconButton.mock.calls[0][0]).not.toHaveProperty('borderColor');
    expect(mockIconButton.mock.calls[0][0]).not.toHaveProperty('title');
  });

  it('uses the native price-axis fallback before measurement', () => {
    expect(getTradingViewNativeChartSettingsButtonRight(0)).toBe(14);
  });

  it.each(['chart', 'toolbar'] as const)(
    'opens the chart settings page with the chart switch from the %s',
    (placement) => {
      const handleChartSwitch = jest.fn();
      render(
        <TradingViewNativeChartSettingsButton
          priceAxisWidth={52}
          placement={placement}
          isChartSwitchDisabled
          onChartSwitch={handleChartSwitch}
        />,
      );

      pressSettingsButton();

      expect(mockPushModal).toHaveBeenCalledWith('MarketModal', {
        screen: 'MarketChartSettings',
        params: {
          showPreviousClose: false,
          chartMode: 'native',
          isChartSwitchDisabled: true,
          onChartSwitch: handleChartSwitch,
        },
      });
    },
  );

  it('carries the Prev close opt-in into the chart settings page', () => {
    render(
      <TradingViewNativeChartSettingsButton
        priceAxisWidth={52}
        enablePreviousClose
      />,
    );

    pressSettingsButton();

    expect(mockPushModal).toHaveBeenCalledWith('MarketModal', {
      screen: 'MarketChartSettings',
      params: { showPreviousClose: true },
    });
  });

  it('exits the fullscreen overlay before pushing the chart settings page', () => {
    const onBeforeOpenSettings = jest.fn();
    render(
      <TradingViewNativeChartSettingsButton
        priceAxisWidth={52}
        placement="toolbar"
        onBeforeOpenSettings={onBeforeOpenSettings}
      />,
    );

    pressSettingsButton();

    expect(onBeforeOpenSettings).toHaveBeenCalledTimes(1);
    expect(mockPushModal).toHaveBeenCalledWith('MarketModal', {
      screen: 'MarketChartSettings',
      params: { showPreviousClose: false },
    });
    expect(onBeforeOpenSettings.mock.invocationCallOrder[0]).toBeLessThan(
      mockPushModal.mock.invocationCallOrder[0],
    );
  });
});
