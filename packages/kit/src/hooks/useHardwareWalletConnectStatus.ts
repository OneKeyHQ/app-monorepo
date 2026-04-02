import { useEffect, useRef, useState } from 'react';

import { ONEKEY_WEBUSB_FILTER } from '@onekeyfe/hd-shared';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

const EMPTY_SET = new Set<string>();

function isOneKeyDevice(device: USBDevice): boolean {
  return (
    ONEKEY_WEBUSB_FILTER?.some(
      (filter) =>
        device.vendorId === filter.vendorId &&
        device.productId === filter.productId,
    ) ?? false
  );
}

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
  if (!usb || typeof usb.getDevices !== 'function') {
    return EMPTY_SET;
  }

  const devices = await usb.getDevices();
  const deviceIds = new Set<string>();

  for (const device of devices) {
    if (isOneKeyDevice(device) && device.serialNumber) {
      deviceIds.add(device.serialNumber);
    }
  }

  return deviceIds.size > 0 ? deviceIds : EMPTY_SET;
}

/**
 * Detect connected hardware wallets via WebUSB.
 * Returns stable Set reference - only changes when device list actually changes.
 */
export function useHardwareWalletConnectStatus() {
  const prevDevicesRef = useRef<Set<string>>(EMPTY_SET);
  const [connectedDevices, setConnectedDevices] =
    useState<Set<string>>(EMPTY_SET);

  const refreshDevices = async () => {
    const newDevices = await fetchConnectedDevices();
    if (!areSetsEqual(prevDevicesRef.current, newDevices)) {
      prevDevicesRef.current = newDevices;
      setConnectedDevices(newDevices);
    }
  };

  useEffect(() => {
    void refreshDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!platformEnv.isSupportWebUSB) {
      return;
    }

    const usb = globalThis?.navigator?.usb;
    if (!usb) {
      return;
    }

    const handleUSBEvent = (event: USBConnectionEvent) => {
      if (isOneKeyDevice(event.device)) {
        void refreshDevices();
      }
    };

    usb.addEventListener('connect', handleUSBEvent);
    usb.addEventListener('disconnect', handleUSBEvent);

    return () => {
      usb.removeEventListener('connect', handleUSBEvent);
      usb.removeEventListener('disconnect', handleUSBEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { connectedDevices, refresh: refreshDevices };
}
