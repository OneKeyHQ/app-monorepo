import type { ReactNode } from 'react';

import { Dialog } from '@onekeyhq/components';

import {
  type ITradingViewChartSettingsProps,
  TradingViewChartSettings,
} from './TradingViewChartSettings';

import type { ITradingViewSettingsDialogRef } from './TradingViewSettingsDialog';
const TRADING_VIEW_WEBVIEW_HIDDEN_OPTION_IDS = [
  'previousClose',
] as const satisfies NonNullable<
  ITradingViewChartSettingsProps['hiddenOptionIds']
>;

export function showTradingViewChartSettingsDialog({
  renderContent,
}: {
  renderContent?: (
    closeDialog: () => void,
    dialogRef: ITradingViewSettingsDialogRef,
  ) => ReactNode;
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
    dialogContainer: ({ ref }) =>
      renderContent ? (
        <>{renderContent(closeDialog, ref)}</>
      ) : (
        <TradingViewChartSettings
          dialogRef={ref}
          hiddenOptionIds={TRADING_VIEW_WEBVIEW_HIDDEN_OPTION_IDS}
          onCancel={closeDialog}
          onConfirmSuccess={closeDialog}
        />
      ),
  });
  dialogInstanceRef.current = dialogInstance;

  return dialogInstance;
}
