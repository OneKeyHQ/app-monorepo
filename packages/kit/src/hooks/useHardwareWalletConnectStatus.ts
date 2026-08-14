import { useCallback, useEffect, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  buildHardwareConnectedDeviceKeys,
  isSupportedHardwareWebUsbDevice,
  isWalletConnectedByHardwareStatus,
} from './useHardwareWalletConnectStatusUtils';

const EMPTY_SET = new Set<string>();

function areSetsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

async function fetchConnectedDevices(): Promise<Set<string>> {
  if (!platformEnv.isSupportWebUSB) {
    return EMPTY_SET;
  }

  const usb = globalThis?.navigator?.usb;
  const [webUsbDevices, backgroundIdentityKeys] = await Promise.all([
    usb && typeof usb.getDevices === 'function'
      ? usb.getDevices()
      : Promise.resolve([]),
    backgroundApiProxy.serviceHardware
      .getConnectedHardwareDeviceIdentityKeys()
      .catch(() => []),
  ]);
  const deviceIds = buildHardwareConnectedDeviceKeys({
    backgroundIdentityKeys,
    webUsbDevices,
  });

  return deviceIds.size > 0 ? deviceIds : EMPTY_SET;
}

/**
 * Detect connected hardware wallets via WebUSB.
 * Returns stable Set reference - only changes when device list actually changes.
 */
export function useHardwareWalletConnectStatus() {
  const prevDeviceKeysRef = useRef<Set<string>>(EMPTY_SET);
  const [connectedDeviceKeys, setConnectedDeviceKeys] =
    useState<Set<string>>(EMPTY_SET);

  const refreshDevices = async () => {
    const newDevices = await fetchConnectedDevices();
    if (!areSetsEqual(prevDeviceKeysRef.current, newDevices)) {
      prevDeviceKeysRef.current = newDevices;
      setConnectedDeviceKeys(newDevices);
    }
  };

  const isWalletConnected = useCallback(
    (wallet: IDBWallet | undefined) =>
      isWalletConnectedByHardwareStatus({
        wallet,
        connectedDeviceKeys,
      }),
    [connectedDeviceKeys],
  );

  useEffect(() => {
    if (!platformEnv.isSupportWebUSB) {
      return;
    }

    const usb = globalThis?.navigator?.usb;
    const handleUSBEvent = (event: USBConnectionEvent) => {
      if (isSupportedHardwareWebUsbDevice(event.device)) {
        void refreshDevices();
      }
    };
    const handleHardwareConnectionStateUpdate = () => {
      void refreshDevices();
    };

    usb?.addEventListener('connect', handleUSBEvent);
    usb?.addEventListener('disconnect', handleUSBEvent);
    appEventBus.on(
      EAppEventBusNames.HardwareConnectionStateUpdate,
      handleHardwareConnectionStateUpdate,
    );
    void refreshDevices();

    return () => {
      usb?.removeEventListener('connect', handleUSBEvent);
      usb?.removeEventListener('disconnect', handleUSBEvent);
      appEventBus.off(
        EAppEventBusNames.HardwareConnectionStateUpdate,
        handleHardwareConnectionStateUpdate,
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    connectedDevices: connectedDeviceKeys,
    connectedDeviceKeys,
    isWalletConnected,
    refresh: refreshDevices,
  };
}
