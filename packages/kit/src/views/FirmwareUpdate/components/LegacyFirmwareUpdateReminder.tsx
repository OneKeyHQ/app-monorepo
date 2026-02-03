import { useEffect } from 'react';

import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { useFirmwareUpdateActions } from '../hooks/useFirmwareUpdateActions';

/**
 * Listen for ShowLegacyFirmwareUpdate event and open the legacy firmware update modal.
 * This is triggered when a device with firmware version below minimum limit is detected
 * and requires the legacy firmware update flow (via firmware.onekey.so).
 */
export function LegacyFirmwareUpdateReminder() {
  const actions = useFirmwareUpdateActions();

  useEffect(() => {
    const fn = ({
      connectId,
      deviceType,
      firmwareVersion,
      bootloaderVersion,
      isBootloaderMode,
    }: IAppEventBusPayload[EAppEventBusNames.ShowLegacyFirmwareUpdate]) => {
      actions.openLegacyUpdateModal({
        connectId,
        deviceType,
        currentFirmwareVersion: firmwareVersion,
        currentBootloaderVersion: bootloaderVersion,
        isBootloaderMode,
      });
    };
    appEventBus.on(EAppEventBusNames.ShowLegacyFirmwareUpdate, fn);

    return () => {
      appEventBus.off(EAppEventBusNames.ShowLegacyFirmwareUpdate, fn);
    };
  }, [actions]);

  return null;
}
