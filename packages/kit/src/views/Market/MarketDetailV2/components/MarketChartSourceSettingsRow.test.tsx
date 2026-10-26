/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import { MarketChartSourceSettingsRow } from './MarketChartSourceSettingsRow';

type ISettingsSelectProps = {
  testID: string;
  value: string;
  options: readonly string[];
  optionLabels?: Record<string, string>;
  width?: number;
  disabled: boolean;
  onChange: (value: string) => void;
};

const mockSettingsSelect = jest.fn<null, [ISettingsSelectProps]>(() => null);

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock(
  '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls/chartSettings/TradingViewSettingsPrimitives',
  () => ({
    CHART_DISPLAY_SELECT_WIDTH: 160,
    SettingsRow: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    SettingsSelect: (props: ISettingsSelectProps) => mockSettingsSelect(props),
  }),
);

describe('MarketChartSourceSettingsRow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the shared settings select for the chart source', () => {
    render(
      <MarketChartSourceSettingsRow
        chartMode="native"
        isDisabled
        onChartSwitch={jest.fn()}
      />,
    );

    expect(mockSettingsSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        testID: 'chart-source',
        value: 'native',
        options: ['native', 'tradingView'],
        optionLabels: {
          native: 'market.chart_original',
          tradingView: 'TradingView',
        },
        width: 160,
        disabled: true,
      }),
    );
  });

  it('switches only when another chart source is picked', () => {
    const handleChartSwitch = jest.fn();
    render(
      <MarketChartSourceSettingsRow
        chartMode="native"
        isDisabled={false}
        onChartSwitch={handleChartSwitch}
      />,
    );

    const { onChange } = mockSettingsSelect.mock.calls[0][0];
    onChange('native');
    expect(handleChartSwitch).not.toHaveBeenCalled();

    onChange('tradingView');
    expect(handleChartSwitch).toHaveBeenCalledTimes(1);
  });
});
