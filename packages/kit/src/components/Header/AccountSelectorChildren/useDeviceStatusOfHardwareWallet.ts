import { useCallback, useEffect, useState } from 'react';

import type { Device } from '@onekeyhq/engine/src/types/device';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useAppSelector,
  useRuntimeWallets,
  useSettings,
} from '../../../hooks/redux';

export type DeviceStatusType = {
  isConnected: boolean;
  hasUpgrade: boolean;
};

export function useDeviceStatusOfHardwareWallet() {
  const { hardwareWallets } = useRuntimeWallets();
  const { deviceUpdates } = useSettings();
  const { connected } = useAppSelector((s) => s.hardware);
  const { isOpenDelay } = useAppSelector((s) => s.accountSelector);
  const [deviceStatus, setDeviceStatus] =
    useState<Record<string, DeviceStatusType | undefined>>();

  const getStatus = useCallback(
    (connectId: string | undefined): DeviceStatusType | undefined => {
      if (!connectId) return undefined;

      return {
        isConnected: connected.includes(connectId),
        hasUpgrade:
          !!deviceUpdates?.[connectId]?.ble ||
          !!deviceUpdates?.[connectId]?.firmware,
      };
    },
    [connected, deviceUpdates],
  );

  useEffect(() => {
    debugLogger.accountSelector.info(
      'useEffect hardwareWallets changed >>> useDeviceStatusOfHardwareWallet',
    );
    if (!isOpenDelay) {
      return;
    }
    (async () => {
      const hwDeviceRec = (
        await backgroundApiProxy.engine.getHWDevices()
      ).reduce((acc, device) => {
        acc[device.id] = device;
        return acc;
      }, {} as Record<string, Device>);

      setDeviceStatus(
        hardwareWallets.reduce((acc, wallet) => {
          if (!wallet.associatedDevice) return acc;

          const device = hwDeviceRec[wallet.associatedDevice];
          if (device) {
            acc[wallet.associatedDevice] = getStatus(device.mac);
          }
          return acc;
        }, {} as Record<string, DeviceStatusType | undefined>),
      );
    })();
  }, [getStatus, hardwareWallets, isOpenDelay]);

  // for RightHeader
  // deviceStatus?.[activeSelectedWallet?.associatedDevice ?? ''] ??

  // for LeftSide
  // deviceStatus

  return {
    deviceStatus,
  };
}
