/** @jest-environment jsdom */

import type { ReactElement } from 'react';

import { showTradingViewNativeIndicatorSettingsDialog } from './showTradingViewNativeIndicatorSettingsDialog';

import type { IIndicatorSettingsIntl } from './indicatorSettingsLocalization';
import type {
  ITradingViewIndicatorSettingsProps,
  ITradingViewIndicatorSettingsValue,
} from '../TradingViewChartControls/chartSettings';

type IDialogConfig = {
  floatingPanelProps: {
    maxWidth: number | string;
    width: number | string;
  };
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

    showTradingViewNativeIndicatorSettingsDialog({
      displayMode: 'focused',
      initialIndicatorId: 'RSI',
      intl,
      onConfirm,
      value,
    });
    const props = mockShowDialog.mock.calls[0][0].renderContent.props;
    expect(props.maxActiveSubIndicatorCount).toBeNull();
    expect(props.displayMode).toBe('focused');
    expect(props.initialIndicatorId).toBe('RSI');
    expect(mockShowDialog.mock.calls[0][0].floatingPanelProps).toEqual(
      expect.objectContaining({ maxWidth: '100%', width: '100%' }),
    );

    await props.onConfirm?.(value);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(mockCloseDialog).not.toHaveBeenCalled();

    await props.onConfirmSuccess?.();
    expect(mockCloseDialog).toHaveBeenCalledTimes(1);
  });
});
