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
  const title = intl.formatMessage({ id: ETranslations.update_quit_update });
  const message = intl.formatMessage({
    id: ETranslations.update_quit_update_desc,
  });

  const onConfirmCallback = useCallback(() => {
    void backgroundApiProxy.serviceHardware.cancel({});
  }, []);

  // Prevents screen locking
  useKeepAwake();

  // Prevent Modal exit/back
  useModalExitPrevent({
    shouldPreventRemove,
    title,
    message,
    onConfirm: onConfirmCallback,
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
