/**
 * @jest-environment jsdom
 */

import type { ReactElement } from 'react';

import { render } from '@testing-library/react';

import {
  TradingViewNativeChartSettingsButton,
  getTradingViewNativeChartSettingsButtonRight,
} from './TradingViewNativeChartSettingsButton';

type IMockDialogConfig = {
  renderContent: ReactElement<{
    chartMode: 'native';
    isChartSwitchDisabled?: boolean;
    onChartSwitch?: () => void;
    onOpenSettings: () => void;
  }>;
  testID?: string;
};

const mockDialogShow = jest.fn<void, [IMockDialogConfig]>();
const mockIconButton = jest.fn<null, [Record<string, unknown>]>(() => null);
const mockPushModal = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    show: (config: IMockDialogConfig) => mockDialogShow(config),
  },
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

jest.mock('./TradingViewMobileChartSettingsDialogContent', () => ({
  TradingViewMobileChartSettingsDialogContent: () => null,
}));

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

  it('opens the native quick settings dialog', () => {
    const handleChartSwitch = jest.fn();
    render(
      <TradingViewNativeChartSettingsButton
        priceAxisWidth={52}
        isChartSwitchDisabled
        onChartSwitch={handleChartSwitch}
      />,
    );

    const buttonProps = mockIconButton.mock.calls[0][0] as {
      onPress: () => void;
    };
    buttonProps.onPress();

    expect(mockDialogShow).toHaveBeenCalledWith(
      expect.objectContaining({
        testID: 'trading-view-native-chart-settings-quick-dialog',
      }),
    );
    expect(mockDialogShow.mock.calls[0][0].renderContent.props).toEqual(
      expect.objectContaining({
        chartMode: 'native',
        isChartSwitchDisabled: true,
        onChartSwitch: handleChartSwitch,
      }),
    );
    mockDialogShow.mock.calls[0][0].renderContent.props.onOpenSettings();
    expect(mockPushModal).toHaveBeenCalledWith('MarketModal', {
      screen: 'MarketChartSettings',
    });
  });
});
