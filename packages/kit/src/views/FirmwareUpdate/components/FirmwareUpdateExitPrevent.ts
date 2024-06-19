import { useKeepAwake } from 'expo-keep-awake';
import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  useAppExitPrevent,
  useExtensionUpdatingFromExpandTab,
  useModalExitPrevent,
} from '../hooks/useFirmwareUpdateHooks';

export function ForceExtensionUpdatingFromExpandTab() {
  useExtensionUpdatingFromExpandTab();

  return null;
}

export function FirmwareUpdateExitPrevent() {
  const intl = useIntl();
  const title = intl.formatMessage({ id: ETranslations.update_quit_update });
  const message = intl.formatMessage({
    id: ETranslations.update_quit_update_desc,
  });

  // Prevents screen locking
  useKeepAwake();

  // Prevent Modal exit/back
  useModalExitPrevent({
    title,
    message,
  });

  // Prevent App exit
  useAppExitPrevent({
    title,
    message,
  });

  // Prevent lockApp:       check servicePassword.lockApp()
  return null;
}
