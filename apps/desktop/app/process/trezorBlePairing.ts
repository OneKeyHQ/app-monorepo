import { TREZOR_BLE_CHANNELS } from '@onekeyfe/hwk-trezor-connector-electron-ble/main';
import { dialog } from 'electron';
import logger from 'electron-log/main';

import { ensureDevicePaired, isBlePairAvailable } from './BlePair';

import type {
  IpcMainLike,
  TrezorBleDeviceInfo,
} from '@onekeyfe/hwk-trezor-connector-electron-ble/main';
import type { BrowserWindow } from 'electron';

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
    // The helper has ALREADY called Accept() on the Windows side by the time we
    // get here, so this dialog gates nothing — it only lets the user perform the
    // numeric comparison. It must therefore not read as "click OK first": the
    // ceremony is waiting on the DEVICE confirmation, and any time spent here is
    // time spent inside the pairing window.
    const shownAt = Date.now();
    logger.info(`[TrezorBLE] pin dialog shown (pin=${pin})`);
    void dialog
      .showMessageBox(browserWindow, {
        type: 'info',
        title: 'Trezor Bluetooth',
        message: `Confirm on the Trezor NOW — check this code matches the device screen:\n\n${pin}`,
        detail:
          'Press confirm on the device first. This window is informational; closing it does not affect pairing.',
        buttons: ['OK'],
        noLink: true,
      })
      .then(() => {
        // How long the human spent on the PC before (probably) turning to the
        // device. Compare against the helper's `sinceAccept` to tell a fixed OS
        // timeout apart from "we simply outran the user".
        logger.info(
          `[TrezorBLE] pin dialog dismissed after ${Date.now() - shownAt}ms`,
        );
      })
      .catch(() => undefined);
  };

  const ensurePaired = async (connectId: string): Promise<void> => {
    if (!isBlePairAvailable()) return; // non-Windows / helper not bundled
    const address = addressByConnectId.get(connectId);
    if (!address) {
      // Reconnect by stored connectId without a fresh scan: no cached address.
      // Assume a prior OS bond and let noble try; if it fails, T0 guidance
      // (pair in Windows settings) is the fallback.
      logger.warn(
        `[TrezorBLE] no cached address for ${connectId}; skipping OS pairing. ` +
          `known=[${[...addressByConnectId.keys()].join(',') || 'none'}]`,
      );
      return;
    }
    logger.info(
      `[TrezorBLE] ensuring OS pairing for ${connectId} (${address})`,
    );
    const startedAt = Date.now();
    // ensureDevicePaired no-ops (already-paired) when the OS bond already exists.
    try {
      await ensureDevicePaired(address, showPin);
      logger.info(
        `[TrezorBLE] OS pairing OK for ${connectId} in ${Date.now() - startedAt}ms`,
      );
    } catch (error) {
      logger.warn(
        `[TrezorBLE] OS pairing FAILED for ${connectId} after ${
          Date.now() - startedAt
        }ms: ${error instanceof Error ? error.message : ''}`,
      );
      throw error;
    }
  };

  return {
    handle: (channel, listener) => {
      if (channel === TREZOR_BLE_CHANNELS.scan) {
        base.handle(channel, async (event, ...args) => {
          const result = await listener(event, ...args);
          if (Array.isArray(result)) {
            const devices = result as TrezorBleDeviceInfo[];
            for (const device of devices) {
              if (device?.id && device?.address) {
                const previous = addressByConnectId.get(device.id);
                if (previous && previous !== device.address) {
                  // connectId is derived from the BLE address, so this should be
                  // impossible — if it fires, the id is NOT address-derived after
                  // all. Either way it is worth knowing.
                  logger.warn(
                    `[TrezorBLE] address changed for ${device.id}: ${previous} -> ${device.address}`,
                  );
                }
                addressByConnectId.set(device.id, device.address);
              }
            }
            // The device advertises a rotating Resolvable Private Address, so the
            // id/address pair is only valid until the next rotation. Logging every
            // scan makes that rotation (and the resulting stale-cache misses)
            // visible instead of showing up only as "had to scan many times".
            logger.info(
              `[TrezorBLE] scan -> ${devices.length} device(s): ${
                devices
                  .map((d) => `${d?.id ?? '?'}@${d?.address ?? '?'}`)
                  .join(', ') || 'none'
              }`,
            );
          }
          return result;
        });
        return;
      }

      if (channel === TREZOR_BLE_CHANNELS.connect) {
        base.handle(channel, async (event, ...args) => {
          const connectId = String(args[0]);
          await ensurePaired(connectId);
          const startedAt = Date.now();
          try {
            const result = await listener(event, ...args);
            logger.info(
              `[TrezorBLE] noble connect OK for ${connectId} in ${
                Date.now() - startedAt
              }ms`,
            );
            return result;
          } catch (error) {
            // Distinguishes "pairing failed" from "paired fine, but noble still
            // cannot reach GATT" — the two have completely different root causes.
            logger.warn(
              `[TrezorBLE] noble connect FAILED for ${connectId} after ${
                Date.now() - startedAt
              }ms: ${error instanceof Error ? error.message : ''}`,
            );
            throw error;
          }
        });
        return;
      }

      base.handle(channel, listener);
    },
    removeHandler: (channel) => base.removeHandler(channel),
  };
}
