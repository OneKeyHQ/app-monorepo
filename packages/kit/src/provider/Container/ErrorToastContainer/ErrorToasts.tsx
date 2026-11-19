import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import { Dialog, Toast, rootNavigationRef } from '@onekeyhq/components';
import type { IToastAction } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { showIntercom } from '@onekeyhq/kit/src/views/Intercom/client';
import { FIRMWARE_UPDATE_WEB_TOOLS_URL } from '@onekeyhq/shared/src/config/appConfig';
import { CLOUD_SYNC_ID_SUNSET_REMINDER_TOAST_ID } from '@onekeyhq/shared/src/consts/primeConsts';
import {
  ECustomCloudSyncError,
  ECustomOneKeyHardwareError,
} from '@onekeyhq/shared/src/errors/types/errorTypes';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, ERootRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import type { IntlShape } from 'react-intl';

interface IErrorActionParams {
  errorCode?: number | string;
  connectId?: string;
  requestId?: string;
  diagnosticText?: string;
  i18nKey?: ETranslations;
}

/**
 * What the actions need from the React tree. A toast is drawn by the platform
 * from data, so its buttons cannot call hooks themselves: the container that
 * shows the toast supplies these.
 */
export interface IErrorActionDeps {
  intl: IntlShape;
  copyText: (text: string) => void;
  // Platform-aware entry: moves extension popup/side-panel to an expanded tab
  // and checks device reachability before pushing the change-log modal.
  openChangeLogModal: (params: { connectId: string | undefined }) => unknown;
}

function clearPendingTransactionsAction(intl: IntlShape): IToastAction {
  return {
    testID: 'error-toast-clear-pending-tx-btn',
    variant: 'primary',
    label: intl.formatMessage({
      id: ETranslations.settings_clear_pending_transactions,
    }),
    onPress: () => {
      Dialog.show({
        title: intl.formatMessage({
          id: ETranslations.settings_clear_pending_transactions,
        }),
        description: intl.formatMessage({
          id: ETranslations.settings_clear_pending_transactions_desc,
        }),
        tone: 'destructive',
        onConfirmText: intl.formatMessage({
          id: ETranslations.global_clear,
        }),
        onConfirm: async () => {
          await backgroundApiProxy.serviceSetting.clearPendingTransaction();
          appEventBus.emit(
            EAppEventBusNames.ClearLocalHistoryPendingTxs,
            undefined,
          );
          Toast.success({
            title: intl.formatMessage({
              id: ETranslations.global_success,
            }),
          });
        },
      });
    },
  };
}

export function getErrorAction(
  {
    errorCode,
    connectId,
    requestId,
    diagnosticText,
    i18nKey,
  }: IErrorActionParams,
  { intl, copyText, openChangeLogModal }: IErrorActionDeps,
): IToastAction | IToastAction[] | undefined {
  // Special case: firmware upgrade button
  if (errorCode === ECustomOneKeyHardwareError.NeedFirmwareUpgradeFromWeb) {
    return {
      testID: 'provider-intl-btn',
      label: intl.formatMessage({ id: ETranslations.update_update_now }),
      onPress: () => {
        openUrlExternal(FIRMWARE_UPDATE_WEB_TOOLS_URL);
      },
    };
  }

  // Firmware compatibility errors and the generic hardware fallback both offer
  // the existing in-app firmware update flow.
  // connectId is stamped onto the error by withHardwareProcessing when the
  // call ran under it; the ChangeLog page resolves the device itself when it
  // is absent (getCompatibleConnectId returns '' for UPDATE_FIRMWARE without
  // a connectId).
  if (
    errorCode === HardwareErrorCode.CallMethodNeedUpgradeFirmware ||
    errorCode === ECustomOneKeyHardwareError.UnknownHardwareError
  ) {
    return {
      testID: 'error-toast-check-firmware-update-btn',
      label: intl.formatMessage({ id: ETranslations.global_check_for_updates }),
      onPress: () => {
        void openChangeLogModal({ connectId });
      },
    };
  }

  // Cloud sync: navigate to Cloud Sync settings page
  if (errorCode === ECustomCloudSyncError.OnekeyIdSyncSunsetReminder) {
    return {
      testID: 'provider-intl-btn',
      variant: 'primary',
      label: intl.formatMessage({ id: ETranslations.switch_now__action }),
      onPress: () => {
        Toast.dismiss(CLOUD_SYNC_ID_SUNSET_REMINDER_TOAST_ID);
        rootNavigationRef.current?.navigate(ERootRoutes.Modal, {
          screen: EModalRoutes.PrimeModal,
          params: { screen: EPrimePages.PrimeCloudSync },
        });
      },
    };
  }

  // Pending queue too long: clear pending transactions button
  if (i18nKey === ETranslations.send_engine_pending_queue_too_long) {
    return clearPendingTransactionsAction(intl);
  }

  // Default: show contact support + copy diagnostic info buttons
  if (diagnosticText && requestId) {
    return [
      {
        testID: 'provider-token-btn',
        icon: 'HelpSupportOutline',
        label: intl.formatMessage({ id: ETranslations.global_contact_us }),
        onPress: () => {
          void showIntercom({ requestId });
        },
      },
      {
        testID: 'provider-intl-btn',
        variant: 'primary',
        label: intl.formatMessage({ id: ETranslations.global_copy }),
        onPress: () => {
          copyText(diagnosticText);
        },
      },
    ];
  }

  return undefined;
}
