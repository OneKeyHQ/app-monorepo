import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Toast,
  rootNavigationRef,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
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
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import { EModalRoutes, ERootRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { useFirmwareUpdateActions } from '../../../views/FirmwareUpdate/hooks/useFirmwareUpdateActions';

interface IErrorActionParams {
  errorCode?: number | string;
  connectId?: string;
  requestId?: string;
  diagnosticText?: string;
  i18nKey?: ETranslations;
}

function ContactSupportButton({ requestId }: { requestId: string }) {
  const intl = useIntl();

  const handlePress = useCallback(() => {
    void showIntercom({ requestId });
  }, [requestId]);

  return (
    <Button
      testID="provider-token-btn"
      icon="HelpSupportOutline"
      size="small"
      onPress={() => {
        handlePress();
      }}
    >
      {intl.formatMessage({ id: ETranslations.global_contact_us })}
    </Button>
  );
}

function CopyDiagnosticButton({ diagnosticText }: { diagnosticText: string }) {
  const intl = useIntl();
  const { copyText } = useClipboard();

  return (
    <Button
      testID="provider-intl-btn"
      variant="primary"
      size="small"
      onPress={() => {
        void copyText(diagnosticText);
      }}
    >
      {intl.formatMessage({ id: ETranslations.global_copy })}
    </Button>
  );
}

function NeedFirmwareUpgradeFromWebButton() {
  const intl = useIntl();

  return (
    <Button
      testID="provider-intl-btn"
      size="small"
      onPress={() => {
        openUrlExternal(FIRMWARE_UPDATE_WEB_TOOLS_URL);
      }}
    >
      {intl.formatMessage({ id: ETranslations.update_update_now })}
    </Button>
  );
}

// connectId is stamped onto the error by withHardwareProcessing when the call
// ran under it; the ChangeLog page resolves the device itself when it is absent
// (getCompatibleConnectId returns '' for UPDATE_FIRMWARE without a connectId).
function CheckFirmwareUpdateButton({ connectId }: { connectId?: string }) {
  const intl = useIntl();
  // Platform-aware entry: moves extension popup/side-panel to an expanded tab
  // and checks device reachability before pushing the change-log modal.
  const firmwareUpdateActions = useFirmwareUpdateActions();

  return (
    <Button
      testID="error-toast-check-firmware-update-btn"
      size="small"
      onPress={() => {
        void firmwareUpdateActions.openChangeLogModal({ connectId });
      }}
    >
      {intl.formatMessage({ id: ETranslations.global_check_for_updates })}
    </Button>
  );
}

function NavigateToCloudSyncSwitchButton() {
  const intl = useIntl();

  return (
    <Button
      testID="provider-intl-btn"
      variant="primary"
      size="small"
      onPress={() => {
        Toast.dismiss(CLOUD_SYNC_ID_SUNSET_REMINDER_TOAST_ID);
        rootNavigationRef.current?.navigate(ERootRoutes.Modal, {
          screen: EModalRoutes.PrimeModal,
          params: { screen: EPrimePages.PrimeCloudSync },
        });
      }}
    >
      {intl.formatMessage({ id: ETranslations.switch_now__action })}
    </Button>
  );
}

function ClearPendingTransactionsButton() {
  const intl = useIntl();

  return (
    <Button
      testID="error-toast-clear-pending-tx-btn"
      variant="primary"
      size="small"
      onPress={() => {
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
      }}
    >
      {intl.formatMessage({
        id: ETranslations.settings_clear_pending_transactions,
      })}
    </Button>
  );
}

export function getErrorAction({
  errorCode,
  connectId,
  requestId,
  diagnosticText,
  i18nKey,
}: IErrorActionParams) {
  // Special case: firmware upgrade button
  if (errorCode === ECustomOneKeyHardwareError.NeedFirmwareUpgradeFromWeb) {
    return <NeedFirmwareUpgradeFromWebButton />;
  }

  // Generic hardware fallback: advises staying up to date, so send the user to
  // the in-app firmware update flow rather than the web tool.
  if (errorCode === ECustomOneKeyHardwareError.UnknownHardwareError) {
    return <CheckFirmwareUpdateButton connectId={connectId} />;
  }

  // Cloud sync: navigate to Cloud Sync settings page
  if (errorCode === ECustomCloudSyncError.OnekeyIdSyncSunsetReminder) {
    return <NavigateToCloudSyncSwitchButton />;
  }

  // Pending queue too long: clear pending transactions button
  if (i18nKey === ETranslations.send_engine_pending_queue_too_long) {
    return <ClearPendingTransactionsButton />;
  }

  // Default: show contact support + copy diagnostic info buttons
  if (diagnosticText && requestId) {
    return [
      <ContactSupportButton key="contact" requestId={requestId} />,
      <CopyDiagnosticButton key="copy" diagnosticText={diagnosticText} />,
    ];
  }

  return undefined;
}
