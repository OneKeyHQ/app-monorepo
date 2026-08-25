import { Dialog } from '@onekeyhq/components';
import type { ITradingViewNativeIndicatorSettings } from '@onekeyhq/shared/types/tradingViewNative';

import {
  type ITradingViewIndicatorSettingsValue,
  TradingViewIndicatorSettings,
} from '../TradingViewChartControls/chartSettings';

import {
  createTradingViewNativeIndicatorSettingsValue,
  getTradingViewNativeIndicatorSettings,
} from './indicatorSettingsAdapter';
import { localizeTradingViewNativeIndicatorSettingsValue } from './indicatorSettingsLocalization';

import type { IIndicatorSettingsIntl } from './indicatorSettingsLocalization';

const TRADING_VIEW_NATIVE_INDICATOR_SETTINGS_DIALOG_WIDTH = 690;

export function showTradingViewNativeIndicatorSettingsDialog({
  intl,
  onConfirm,
  value,
}: {
  intl: IIndicatorSettingsIntl;
  onConfirm: (
    value: ITradingViewNativeIndicatorSettings,
  ) => void | Promise<void>;
  value: ITradingViewIndicatorSettingsValue;
}) {
  const dialogInstanceRef: {
    current: ReturnType<typeof Dialog.show> | undefined;
  } = {
    current: undefined,
  };
  const closeDialog = () => dialogInstanceRef.current?.close();

  const dialogInstance = Dialog.show({
    showHeader: false,
    showFooter: false,
    testID: 'trading-view-native-indicator-settings-dialog',
    contentContainerProps: {
      p: '$0',
    },
    floatingPanelProps: {
      width: TRADING_VIEW_NATIVE_INDICATOR_SETTINGS_DIALOG_WIDTH,
      maxWidth: TRADING_VIEW_NATIVE_INDICATOR_SETTINGS_DIALOG_WIDTH,
      overflow: 'visible',
      borderRadius: 0,
      outlineWidth: 0,
      bg: 'transparent',
    },
    renderContent: (
      <TradingViewIndicatorSettings
        value={value}
        createDefaultValue={() =>
          localizeTradingViewNativeIndicatorSettingsValue(
            createTradingViewNativeIndicatorSettingsValue(),
            intl,
          )
        }
        maxActiveSubIndicatorCount={null}
        onClose={() => {
          void closeDialog();
        }}
        onConfirm={async (nextValue) => {
          await onConfirm(getTradingViewNativeIndicatorSettings(nextValue));
        }}
        onConfirmSuccess={async () => {
          await closeDialog();
        }}
      />
    ),
  });
  dialogInstanceRef.current = dialogInstance;

  return dialogInstance;
}
