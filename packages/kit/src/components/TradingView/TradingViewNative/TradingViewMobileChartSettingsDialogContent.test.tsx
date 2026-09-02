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
type IChartTypeSettingsRowProps = {
  value: ITradingViewNativeChartTypePreference;
  onChange: (value: ITradingViewNativeChartTypePreference) => void;
};
type IChartModeSelectProps = {
  chartMode: 'native' | 'tradingView';
  isDisabled?: boolean;
  onChartSwitch: () => void;
};

const mockChartTypeSettingsRow = jest.fn<null, [IChartTypeSettingsRowProps]>(
  () => null,
);
const mockChartModeSelect = jest.fn<null, [IChartModeSelectProps]>(() => null);
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
    Checkbox: () => null,
    Divider: () => null,
    Icon: () => null,
    SizableText: View,
    XStack: View,
    YStack: View,
    useDialogInstance: () => ({ close: mockDialogClose }),
  };
});

jest.mock('../TradingViewChartControls', () => ({
  TradingViewChartModeSelect: (props: IChartModeSelectProps) =>
    mockChartModeSelect(props),
}));

jest.mock('../TradingViewChartControls/chartSettings', () => ({
  TradingViewChartTypeSettingsRow: (props: IChartTypeSettingsRowProps) =>
    mockChartTypeSettingsRow(props),
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

    const chartTypeProps = mockChartTypeSettingsRow.mock.calls[0][0];
    expect(chartTypeProps.value).toBe('auto');

    act(() => {
      chartTypeProps.onChange('line');
    });

    expect(mockSetSettings).toHaveBeenCalledTimes(1);
    expect(mockSettings.chartType).toBe('line');
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
    expect(mockChartTypeSettingsRow).not.toHaveBeenCalled();
  });
});
