/** @jest-environment jsdom */

import type { ReactElement } from 'react';

import { showTradingViewChartSettingsDialog } from './showTradingViewChartSettingsDialog';

import type { ITradingViewChartSettingsProps } from './TradingViewChartSettings';

type IMockDialogConfig = {
  renderContent: ReactElement<ITradingViewChartSettingsProps>;
};

const mockCloseDialog = jest.fn();
const mockShowDialog = jest.fn<
  { close: typeof mockCloseDialog },
  [IMockDialogConfig]
>(() => ({ close: mockCloseDialog }));

jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    show: (config: IMockDialogConfig) => mockShowDialog(config),
  },
}));

jest.mock('./TradingViewChartSettings', () => ({
  TradingViewChartSettings: () => null,
}));

describe('showTradingViewChartSettingsDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hides options that only the native chart implements', () => {
    showTradingViewChartSettingsDialog();

    expect(
      mockShowDialog.mock.calls[0][0].renderContent.props.hiddenOptionIds,
    ).toEqual(['previousClose']);
  });
});
