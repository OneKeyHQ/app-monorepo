import { useKeepAwake } from 'expo-keep-awake';

import { FIRMWARE_UPDATE_PREVENT_EXIT } from '@onekeyhq/kit-bg/src/services/ServiceFirmwareUpdate/firmwareUpdateConsts';

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
  const title = FIRMWARE_UPDATE_PREVENT_EXIT.title;
  const message = FIRMWARE_UPDATE_PREVENT_EXIT.message;

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
