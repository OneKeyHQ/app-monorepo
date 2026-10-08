import { useCallback } from 'react';

import { useKeepAwake } from 'expo-keep-awake';
import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useAppExitPrevent,
  useExtensionUpdatingFromExpandTab,
  useModalExitPrevent,
} from '../hooks/useFirmwareUpdateHooks';

export async function cancelFirmwareUpdateWorkflow() {
  await Promise.allSettled([
    backgroundApiProxy.serviceFirmwareUpdate.exitUpdateWorkflow(),
    backgroundApiProxy.serviceHardware.cancel({ immediate: true }),
  ]);
}

export async function cancelFirmwareUpdateAttempt() {
  await Promise.allSettled([
    backgroundApiProxy.serviceHardware.cancel({ immediate: true }),
  ]);
}

export function ForceExtensionUpdatingFromExpandTab() {
  useExtensionUpdatingFromExpandTab();

  return null;
}

export function FirmwareUpdateExitPrevent({
  shouldPreventRemove = true,
  preserveWorkflowOnCancel = false,
  onCancelAttempt,
}: {
  shouldPreventRemove?: boolean;
  preserveWorkflowOnCancel?: boolean;
  onCancelAttempt?: () => void;
}) {
  const intl = useIntl();
  const title = intl.formatMessage({ id: ETranslations.update_quit_update });
  const message = intl.formatMessage({
    id: ETranslations.update_quit_update_desc,
  });
  const continueUpdateText = intl.formatMessage({
    id: ETranslations.update_continue_update,
  });
  const cancelUpdateText = intl.formatMessage({
    id: ETranslations.update_cancel_update,
  });

  const onConfirmCallback = useCallback(() => {
    if (preserveWorkflowOnCancel) {
      onCancelAttempt?.();
      void cancelFirmwareUpdateAttempt();
      return;
    }
    void cancelFirmwareUpdateWorkflow();
  }, [onCancelAttempt, preserveWorkflowOnCancel]);

  // Prevents screen locking
  useKeepAwake();

  // Prevent Modal exit/back
  useModalExitPrevent({
    shouldPreventRemove,
    title,
    message,
    onConfirm: onConfirmCallback,
    onConfirmText: cancelUpdateText,
    onCancelText: continueUpdateText,
    shouldRemoveOnConfirm: !preserveWorkflowOnCancel,
  });

  // Prevent App exit
  useAppExitPrevent({
    title,
    message,
    shouldPreventExitOnAndroid: false,
  });

  // Prevent lockApp:       check servicePassword.lockApp()
  return null;
}
