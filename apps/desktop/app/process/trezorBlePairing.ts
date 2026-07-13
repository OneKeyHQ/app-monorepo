import { dialog } from 'electron';
import logger from 'electron-log/main';

import { TREZOR_BLE_CHANNELS } from '@onekeyfe/hwk-trezor-connector-electron-ble/main';

import { ensureDevicePaired, isBlePairAvailable } from './BlePair';

import type { BrowserWindow } from 'electron';
import type {
  IpcMainLike,
  TrezorBleDeviceInfo,
} from '@onekeyfe/hwk-trezor-connector-electron-ble/main';

// App-side Trezor BLE pairing, inserted at the IPC seam the app already owns —
// WITHOUT touching the SDK. noble cannot initiate OS bonding on Windows (it
// fails GATT service discovery with "Unreachable" because Trezor's GATT is
// encryption-gated), so before delegating `connect` to the SDK we run the WinRT
// pairing helper (BlePair.ts -> the onekey-ble-pair CLI). `scan` results are
// cached to resolve connectId -> BLE address. Non-Windows, or a build without
// the bundled helper, passes straight through with unchanged behavior.

export function createTrezorBlePairingIpcMain(
  base: IpcMainLike,
  browserWindow: BrowserWindow,
): IpcMainLike {
  const addressByConnectId = new Map<string, string>();

  const showPin = (pin: string) => {
    // Placeholder pin surface for the first Windows test: shows the numeric-
    // comparison code so it can be verified against the Trezor screen. To be
    // replaced with the in-app ThirdPartyHardwareUi dialog once confirmed.
    void dialog.showMessageBox(browserWindow, {
      type: 'info',
      title: 'Trezor Bluetooth',
      message: `Confirm this pairing code matches the Trezor screen:\n\n${pin}`,
      buttons: ['OK'],
      noLink: true,
    });
  };

  const ensurePaired = async (connectId: string): Promise<void> => {
    if (!isBlePairAvailable()) return; // non-Windows / helper not bundled
    const address = addressByConnectId.get(connectId);
    if (!address) {
      // Reconnect by stored connectId without a fresh scan: no cached address.
      // Assume a prior OS bond and let noble try; if it fails, T0 guidance
      // (pair in Windows settings) is the fallback.
      logger.warn(
        `[TrezorBLE] no cached address for ${connectId}; skipping OS pairing`,
      );
      return;
    }
    logger.info(
      `[TrezorBLE] ensuring OS pairing for ${connectId} (${address})`,
    );
    // ensureDevicePaired no-ops (already-paired) when the OS bond already exists.
    await ensureDevicePaired(address, showPin);
  };

  return {
    handle: (channel, listener) => {
      if (channel === TREZOR_BLE_CHANNELS.scan) {
        base.handle(channel, async (event, ...args) => {
          const result = await listener(event, ...args);
          if (Array.isArray(result)) {
            for (const device of result as TrezorBleDeviceInfo[]) {
              if (device?.id && device?.address) {
                addressByConnectId.set(device.id, device.address);
              }
            }
          }
          return result;
        });
        return;
      }

      if (channel === TREZOR_BLE_CHANNELS.connect) {
        base.handle(channel, async (event, ...args) => {
          const connectId = String(args[0]);
          await ensurePaired(connectId);
          return listener(event, ...args);
        });
        return;
      }

      base.handle(channel, listener);
    },
    removeHandler: (channel) => base.removeHandler(channel),
  };
}
