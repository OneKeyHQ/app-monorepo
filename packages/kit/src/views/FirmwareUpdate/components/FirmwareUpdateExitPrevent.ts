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
import { useFirmwareUpdateSession } from '../hooks/useFirmwareUpdateSession';

export function ForceExtensionUpdatingFromExpandTab() {
  useExtensionUpdatingFromExpandTab();

  return null;
}

export function FirmwareUpdateExitPrevent({
  shouldPreventRemove = true,
}: {
  shouldPreventRemove?: boolean;
}) {
  const intl = useIntl();
  const firmwareUpdateSession = useFirmwareUpdateSession();
  const projection = firmwareUpdateSession.projection;
  const title = intl.formatMessage({ id: ETranslations.update_quit_update });
  const message = intl.formatMessage({
    id: ETranslations.update_quit_update_desc,
  });
  const continueUpdateText = intl.formatMessage({
    id: ETranslations.update_continue_update,
  });
  let cancelUpdateMessageId = ETranslations.update_cancel_update;
  if (projection && ['INSTALLING', 'VERIFYING'].includes(projection.phase)) {
    cancelUpdateMessageId = ETranslations.global_later;
  } else if (
    projection &&
    ![
      'DISCOVERING',
      'PLAN_CREATED',
      'ELIGIBILITY_CHECKING',
      'ACQUIRING',
      'MATERIALIZING',
      'PREPARED',
    ].includes(projection.phase)
  ) {
    cancelUpdateMessageId = ETranslations.global_pause;
  }
  const cancelUpdateText = intl.formatMessage({
    id: cancelUpdateMessageId,
  });

  const onConfirmCallback = useCallback(() => {
    if (projection) {
      void firmwareUpdateSession.requestExit(projection.sessionId);
      return;
    }
    void backgroundApiProxy.serviceHardware.cancel({});
  }, [firmwareUpdateSession, projection]);

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
