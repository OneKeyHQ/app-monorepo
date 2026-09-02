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

const mockChartTypeSettingsRow = jest.fn<null, [IChartTypeSettingsRowProps]>(
  () => null,
);
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
    useDialogInstance: () => ({ close: jest.fn() }),
  };
});

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
});
