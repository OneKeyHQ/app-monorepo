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
import type { ITradingViewNativeAnyIndicator } from './utils/chartIndicators';

const TRADING_VIEW_NATIVE_INDICATOR_SETTINGS_DIALOG_WIDTH = 690;

export function showTradingViewNativeIndicatorSettingsDialog({
  displayMode = 'full',
  initialIndicatorId,
  intl,
  onConfirm,
  value,
}: {
  displayMode?: 'focused' | 'full';
  initialIndicatorId?: ITradingViewNativeAnyIndicator;
  intl: IIndicatorSettingsIntl;
  onConfirm: (
    value: ITradingViewNativeIndicatorSettings,
  ) => void | Promise<void>;
  value: ITradingViewIndicatorSettingsValue;
}) {
  const isFocused = displayMode === 'focused';
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
      width: isFocused
        ? '100%'
        : TRADING_VIEW_NATIVE_INDICATOR_SETTINGS_DIALOG_WIDTH,
      maxWidth: isFocused
        ? '100%'
        : TRADING_VIEW_NATIVE_INDICATOR_SETTINGS_DIALOG_WIDTH,
      overflow: 'visible',
      borderRadius: 0,
      outlineWidth: 0,
      bg: 'transparent',
    },
    renderContent: (
      <TradingViewIndicatorSettings
        displayMode={displayMode}
        initialIndicatorId={initialIndicatorId}
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
