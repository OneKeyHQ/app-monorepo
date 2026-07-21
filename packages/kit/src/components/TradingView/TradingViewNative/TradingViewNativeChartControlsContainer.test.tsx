/**
 * @jest-environment jsdom
 */

import { render } from '@testing-library/react';

import { TradingViewNativeChartControlsContainer } from './TradingViewNativeChartControlsContainer';

const mockTradingViewChartControls = jest.fn<null, [unknown]>(() => null);

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

describe('TradingViewNative chart controls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('only exposes the implemented interval control', () => {
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
});
