import { TREZOR_BLE_CHANNELS } from '@onekeyfe/hwk-trezor-connector-electron-ble/main';
import { dialog } from 'electron';
import logger from 'electron-log/main';

import {
  ensureDevicePaired,
  isBlePairAvailable,
  startRawAdvertisementWatch,
} from './BlePair';

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

// Grace period after a fresh bond before noble is allowed to scan for the
// device: pairing leaves the BLE link up, and a connected peripheral does not
// advertise. The helper drops the link on its side; this covers the gap until
// the device is advertising again.
const POST_PAIR_SETTLE_MS = 2000;

// Raw-advertisement instrumentation. It only ever runs when we are ALREADY in a
// failing state (the scan keeps coming back empty) or right after a bond, so it
// cannot disturb a flow that works — and it means a single app run captures the
// answer, instead of costing another hour-long rebuild.
const EMPTY_SCANS_BEFORE_RAW_WATCH = 8; // ~12s of the SDK's ~1.5s poll
const RAW_WATCH_COOLDOWN_MS = 90_000;
const RAW_WATCH_SECONDS_SCAN = 20;
const RAW_WATCH_SECONDS_POST_PAIR = 25;

export function createTrezorBlePairingIpcMain(
  base: IpcMainLike,
  browserWindow: BrowserWindow,
): IpcMainLike {
  const addressByConnectId = new Map<string, string>();
  let consecutiveEmptyScans = 0;
  let lastRawWatchAt = 0;

  const maybeRawWatch = (seconds: number, reason: string) => {
    const now = Date.now();
    if (now - lastRawWatchAt < RAW_WATCH_COOLDOWN_MS) return;
    lastRawWatchAt = now;
    startRawAdvertisementWatch(seconds, reason);
  };

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
      const paired = await ensureDevicePaired(address, showPin);
      logger.info(
        `[TrezorBLE] OS pairing OK for ${connectId} in ${Date.now() - startedAt}ms`,
      );
      // A freshly bonded device needs a moment to drop the pairing link and
      // resume advertising; noble's scan cannot see it until it does. Skipped
      // when the bond already existed (no link was opened).
      if (paired === 'paired') {
        // THE question: post-bond, does Windows report the device under a stable
        // (IRK-resolved) identity address, or still a rotating RPA? If stable,
        // the connectId must become that identity. If it keeps rotating, noble
        // cannot address this device on Windows at all and the transport needs
        // rethinking. Runs alongside the connect below, so the log shows exactly
        // what was on air while noble was failing to find the device.
        lastRawWatchAt = 0; // this one always runs, cooldown must not eat it
        maybeRawWatch(RAW_WATCH_SECONDS_POST_PAIR, 'post-pair-identity-check');
        await new Promise((resolve) => {
          setTimeout(resolve, POST_PAIR_SETTLE_MS);
        });
        logger.info(
          `[TrezorBLE] post-pair settle ${POST_PAIR_SETTLE_MS}ms done for ${connectId}`,
        );
      }
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

            // The SDK scans with a service-UUID filter. When it keeps returning
            // nothing, we cannot tell from here whether the device is silent or
            // whether the filter is dropping it — so dump the raw, unfiltered
            // advertisements once and settle it in the log.
            if (devices.length === 0) {
              consecutiveEmptyScans += 1;
              if (consecutiveEmptyScans >= EMPTY_SCANS_BEFORE_RAW_WATCH) {
                maybeRawWatch(
                  RAW_WATCH_SECONDS_SCAN,
                  `${consecutiveEmptyScans}-empty-scans`,
                );
              }
            } else {
              consecutiveEmptyScans = 0;
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
