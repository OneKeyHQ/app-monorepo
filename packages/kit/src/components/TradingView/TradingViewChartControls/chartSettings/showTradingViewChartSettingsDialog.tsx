import { Dialog } from '@onekeyhq/components';

import { TradingViewChartSettings } from './TradingViewChartSettings';

const TRADING_VIEW_CHART_SETTINGS_DIALOG_WIDTH = 552;

export function showTradingViewChartSettingsDialog() {
  const dialogInstanceRef: {
    current: ReturnType<typeof Dialog.show> | undefined;
  } = {
    current: undefined,
  };
  const closeDialog = () => {
    void dialogInstanceRef.current?.close();
  };

  const dialogInstance = Dialog.show({
    showHeader: false,
    showFooter: false,
    testID: 'trading-view-chart-settings-dialog',
    contentContainerProps: {
      p: '$0',
    },
    floatingPanelProps: {
      width: TRADING_VIEW_CHART_SETTINGS_DIALOG_WIDTH,
      maxWidth: TRADING_VIEW_CHART_SETTINGS_DIALOG_WIDTH,
      overflow: 'visible',
      borderRadius: 0,
      outlineWidth: 0,
      bg: 'transparent',
    },
    renderContent: (
      <TradingViewChartSettings
        onCancel={closeDialog}
        onConfirm={closeDialog}
      />
    ),
  });
  dialogInstanceRef.current = dialogInstance;

  return dialogInstance;
}
