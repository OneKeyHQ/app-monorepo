/** @jest-environment jsdom */

import type { ReactElement, ReactNode } from 'react';

import { showTradingViewChartSettingsDialog } from './showTradingViewChartSettingsDialog';

import type { ITradingViewChartSettingsProps } from './TradingViewChartSettings';
import type { ITradingViewSettingsDialogRef } from './TradingViewSettingsDialog';

type IMockDialogConfig = {
  dialogContainer: (params: {
    ref: ITradingViewSettingsDialogRef;
  }) => ReactElement<ITradingViewChartSettingsProps & { children?: ReactNode }>;
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
      mockShowDialog.mock.calls[0][0].dialogContainer({
        ref: { current: null },
      }).props.hiddenOptionIds,
    ).toEqual(['previousClose']);
  });

  it('lets custom settings content close its own dialog', () => {
    const renderContent = jest.fn((closeDialog: () => void) => (
      <button onClick={closeDialog} type="button">
        Close
      </button>
    ));

    showTradingViewChartSettingsDialog({ renderContent });

    expect(
      mockShowDialog.mock.calls[0][0].dialogContainer({
        ref: { current: null },
      }).props.children,
    ).toBe(renderContent.mock.results[0].value);
    renderContent.mock.calls[0][0]();
    expect(mockCloseDialog).toHaveBeenCalledTimes(1);
  });
});
