import { Dialog } from '@onekeyhq/components';

import {
  type ITradingViewChartSettingsProps,
  TradingViewChartSettings,
} from './TradingViewChartSettings';

const TRADING_VIEW_CHART_SETTINGS_DIALOG_WIDTH = 552;
const TRADING_VIEW_WEBVIEW_HIDDEN_OPTION_IDS = [
  'previousClose',
] as const satisfies NonNullable<
  ITradingViewChartSettingsProps['hiddenOptionIds']
>;

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
        hiddenOptionIds={TRADING_VIEW_WEBVIEW_HIDDEN_OPTION_IDS}
        onCancel={closeDialog}
        onConfirmSuccess={closeDialog}
      />
    ),
  });
  dialogInstanceRef.current = dialogInstance;

  return dialogInstance;
}
