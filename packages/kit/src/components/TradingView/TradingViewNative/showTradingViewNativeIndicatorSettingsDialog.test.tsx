/** @jest-environment jsdom */

import type { ReactElement } from 'react';

import { showTradingViewNativeIndicatorSettingsDialog } from './showTradingViewNativeIndicatorSettingsDialog';

import type { IIndicatorSettingsIntl } from './indicatorSettingsLocalization';
import type {
  ITradingViewIndicatorSettingsProps,
  ITradingViewIndicatorSettingsValue,
} from '../TradingViewChartControls/chartSettings';

type IDialogConfig = {
  renderContent: ReactElement<ITradingViewIndicatorSettingsProps>;
};

const mockCloseDialog = jest.fn(() => Promise.resolve());
const mockShowDialog = jest.fn((_config: IDialogConfig) => ({
  close: mockCloseDialog,
}));

jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    show: (config: IDialogConfig) => mockShowDialog(config),
  },
}));

jest.mock('../TradingViewChartControls/chartSettings', () => ({
  TRADING_VIEW_SETTINGS_SCHEMA_VERSION: 1,
  TradingViewIndicatorSettings: () => null,
  createTradingViewIndicatorSettingsValue: () => ({ indicators: [] }),
}));

describe('showTradingViewNativeIndicatorSettingsDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('closes only after the child has committed a successful confirmation', async () => {
    const value: ITradingViewIndicatorSettingsValue = {
      indicators: [],
      schemaVersion: 1,
    };
    const onConfirm = jest.fn(() => Promise.resolve());
    const intl: IIndicatorSettingsIntl = {
      formatMessage: ({ id }) => id,
    };

    showTradingViewNativeIndicatorSettingsDialog({ intl, onConfirm, value });
    const props = mockShowDialog.mock.calls[0][0].renderContent.props;
    expect(props.maxActiveSubIndicatorCount).toBeNull();

    await props.onConfirm?.(value);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(mockCloseDialog).not.toHaveBeenCalled();

    await props.onConfirmSuccess?.();
    expect(mockCloseDialog).toHaveBeenCalledTimes(1);
  });
});
