import type { ReactNode } from 'react';

import { Dialog } from '@onekeyhq/components';

import {
  type ITradingViewChartSettingsProps,
  TradingViewChartSettings,
} from './TradingViewChartSettings';

// Matches desktop modal pages (see createWebModalNavigator: 90% of the window,
// capped at `$160`). Dialog only renders this floating panel above the `md`
// breakpoint (768px and wider), where 90% of the window already exceeds
// `$160`, so the modal rule always resolves to `$160`. A fixed token keeps that
// result without relying on how a percentage resolves inside the dialog's
// portal and scroll-lock wrappers.
const TRADING_VIEW_CHART_SETTINGS_DIALOG_WIDTH = '$160';
const TRADING_VIEW_WEBVIEW_HIDDEN_OPTION_IDS = [
  'previousClose',
] as const satisfies NonNullable<
  ITradingViewChartSettingsProps['hiddenOptionIds']
>;

export function showTradingViewChartSettingsDialog({
  renderContent,
}: {
  renderContent?: (closeDialog: () => void) => ReactNode;
} = {}) {
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
    renderContent: renderContent ? (
      renderContent(closeDialog)
    ) : (
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
