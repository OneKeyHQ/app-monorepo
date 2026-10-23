/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react';

import {
  type ITradingViewNativeChartSettings,
  type ITradingViewNativeChartTypePreference,
  createTradingViewNativeChartSettings,
} from '@onekeyhq/shared/types/tradingViewNative';

import { TradingViewMobileChartSettingsDialogContent } from './TradingViewMobileChartSettingsDialogContent';

type IChartSettingsUpdater = (
  settings: ITradingViewNativeChartSettings,
) => ITradingViewNativeChartSettings;
type ISelectProps = {
  testID?: string;
  value?: ITradingViewNativeChartTypePreference;
  items?: Array<{
    value: ITradingViewNativeChartTypePreference;
    label: string;
  }>;
  onChange?: (value: ITradingViewNativeChartTypePreference) => void;
};
type IChartModeSelectProps = {
  chartMode: 'native' | 'tradingView';
  isDisabled?: boolean;
  onChartSwitch: () => void;
};

const mockSelect = jest.fn<null, [ISelectProps]>(() => null);
const mockChartModeSelect = jest.fn<null, [IChartModeSelectProps]>(() => null);
type ISwitchProps = {
  testID?: string;
  value?: boolean;
  onChange?: (value: boolean) => void;
};

const mockSwitch = jest.fn<null, [ISwitchProps]>(() => null);
const mockDialogClose = jest.fn<Promise<void>, []>(() => Promise.resolve());
const mockSetSettings = jest.fn<Promise<void>, [IChartSettingsUpdater]>();
let mockSettings = createTradingViewNativeChartSettings();

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const View = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );

  return {
    ESwitchSize: { small: 'small' },
    Icon: () => null,
    Select: (props: ISelectProps) => mockSelect(props),
    SizableText: View,
    Switch: (props: ISwitchProps) => mockSwitch(props),
    XStack: View,
    YStack: View,
    useDialogInstance: () => ({ close: mockDialogClose }),
  };
});

jest.mock('../TradingViewChartControls', () => ({
  TradingViewChartModeSelect: (props: IChartModeSelectProps) =>
    mockChartModeSelect(props),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useMarketTradingViewChartSettingsPersistAtom: () => [
    mockSettings,
    mockSetSettings,
  ],
}));

describe('TradingViewMobileChartSettingsDialogContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettings = createTradingViewNativeChartSettings();
    mockSetSettings.mockImplementation((update) => {
      mockSettings = update(mockSettings);
      return Promise.resolve();
    });
  });

  it('shows and persists the chart type preference', () => {
    render(
      <TradingViewMobileChartSettingsDialogContent
        onOpenSettings={jest.fn()}
      />,
    );

    const chartStyleProps = mockSelect.mock.calls[0][0];
    expect(chartStyleProps.testID).toBe(
      'trading-view-native-chart-settings-dialog-chart-style-select',
    );
    expect(chartStyleProps.value).toBe('auto');
    expect(chartStyleProps.items?.map((item) => item.value)).toEqual([
      'auto',
      'candlestick',
      'heikinAshi',
      'bars',
      'line',
      'area',
    ]);

    act(() => {
      chartStyleProps.onChange?.('line');
    });

    expect(mockSetSettings).toHaveBeenCalledTimes(1);
    expect(mockSettings.chartType).toBe('line');
  });

  it('lists Prev close only when the chart opts in', () => {
    const renderedOptions = () => [
      ...new Set(mockSwitch.mock.calls.map(([props]) => props.testID)),
    ];

    const { unmount } = render(
      <TradingViewMobileChartSettingsDialogContent
        onOpenSettings={jest.fn()}
      />,
    );
    expect(renderedOptions()).toEqual([
      'trading-view-native-chart-settings-dialog-option-yAxis',
    ]);
    unmount();
    mockSwitch.mockClear();

    render(
      <TradingViewMobileChartSettingsDialogContent
        onOpenSettings={jest.fn()}
        showPreviousClose
      />,
    );
    expect(renderedOptions()).toEqual([
      'trading-view-native-chart-settings-dialog-option-yAxis',
      'trading-view-native-chart-settings-dialog-option-previousClose',
    ]);
  });

  it('toggles quick settings with switches', () => {
    render(
      <TradingViewMobileChartSettingsDialogContent
        onOpenSettings={jest.fn()}
      />,
    );

    const yAxisProps = mockSwitch.mock.calls.find(
      ([props]) =>
        props.testID ===
        'trading-view-native-chart-settings-dialog-option-yAxis',
    )?.[0];
    expect(yAxisProps?.value).toBe(true);

    act(() => {
      yAxisProps?.onChange?.(false);
    });

    expect(mockSetSettings).toHaveBeenCalledTimes(1);
    expect(mockSettings.options.yAxis).toBe(false);
  });

  it('shows the chart source switch and closes before switching', async () => {
    const handleChartSwitch = jest.fn();

    render(
      <TradingViewMobileChartSettingsDialogContent
        chartMode="native"
        isChartSwitchDisabled
        onChartSwitch={handleChartSwitch}
        onOpenSettings={jest.fn()}
      />,
    );

    const chartModeProps = mockChartModeSelect.mock.calls[0][0];
    expect(chartModeProps).toEqual(
      expect.objectContaining({
        chartMode: 'native',
        isDisabled: true,
      }),
    );

    await act(async () => {
      chartModeProps.onChartSwitch();
    });

    expect(mockDialogClose).toHaveBeenCalledTimes(1);
    expect(handleChartSwitch).toHaveBeenCalledTimes(1);
  });

  it('hides native-only quick settings in TradingView mode', () => {
    render(
      <TradingViewMobileChartSettingsDialogContent
        chartMode="tradingView"
        onChartSwitch={jest.fn()}
        onOpenSettings={jest.fn()}
      />,
    );

    expect(mockChartModeSelect).toHaveBeenCalledWith(
      expect.objectContaining({ chartMode: 'tradingView' }),
    );
    expect(mockSelect).not.toHaveBeenCalled();
  });
});
