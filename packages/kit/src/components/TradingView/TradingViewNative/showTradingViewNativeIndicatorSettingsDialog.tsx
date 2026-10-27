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
import type { ITradingViewSettingsDialogRef } from '../TradingViewChartControls/chartSettings/TradingViewSettingsDialog';

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

  const renderContent = (dialogRef?: ITradingViewSettingsDialogRef) => (
    <TradingViewIndicatorSettings
      dialogRef={dialogRef}
      displayMode={displayMode}
      mobileLayout={isFocused}
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
  );
  const dialogInstance = Dialog.show(
    isFocused
      ? {
          title: value.indicators.find(
            (indicator) => indicator.id === initialIndicatorId,
          )?.title,
          showFooter: false,
          testID: 'trading-view-native-indicator-settings-dialog',
          floatingPanelProps: { width: '100%', maxWidth: '100%' },
          onOpenAutoFocus: (event) => {
            const container = event.currentTarget;
            if (
              typeof HTMLElement !== 'undefined' &&
              container instanceof HTMLElement
            ) {
              event.preventDefault();
              container.tabIndex = -1;
              container.focus({ preventScroll: true });
            }
          },
          renderContent: renderContent(),
        }
      : { dialogContainer: ({ ref }) => renderContent(ref) },
  );
  dialogInstanceRef.current = dialogInstance;

  return dialogInstance;
}
