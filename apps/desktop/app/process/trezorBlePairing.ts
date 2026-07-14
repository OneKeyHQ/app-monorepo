import {
  isTrezorBleServiceUuid,
  isTrezorSafe7BleName,
} from '@onekeyfe/hwk-trezor-adapter';
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

/**
 * Does this advertisement belong to a Trezor? Replaces the service-UUID filter
 * we just disabled in noble — matches on the ADV packet's name, or on the
 * service UUID once a scan response has merged into the peripheral.
 */
function isTrezorDevice(device: TrezorBleDeviceInfo | undefined): boolean {
  if (!device) return false;
  if (isTrezorSafe7BleName(device.name ?? device.localName)) return true;
  return (device.advertisedServiceUuids ?? []).some((uuid) =>
    isTrezorBleServiceUuid(uuid),
  );
}

// Raw-advertisement instrumentation. It only ever runs when we are ALREADY in a
// failing state (the scan keeps coming back empty) or right after a bond, so it
// cannot disturb a flow that works — and it means a single app run captures the
// answer, instead of costing another hour-long rebuild.
// Low threshold on purpose: if the unfiltered scan works, the device is found
// almost immediately and this never fires — its silence IS the confirmation. If
// it does fire, the dump says whether the device was on air while we were blind.
const EMPTY_SCANS_BEFORE_RAW_WATCH = 3; // ~4.5s of the SDK's ~1.5s poll
const RAW_WATCH_COOLDOWN_MS = 60_000;
const RAW_WATCH_SECONDS_SCAN = 20;
const RAW_WATCH_SECONDS_POST_PAIR = 25;

// The SDK clears its discovered-peripheral cache this long after the last scan
// call (TREZOR_BLE_SCAN_IDLE_STOP_MS in the SDK). Pairing runs with no scans in
// flight, so a pairing that outlasts this window destroys the peripheral that
// connect is about to need. Mirrored here only to make the log say so out loud.
const SDK_SCAN_IDLE_STOP_MS = 10_000;

export function createTrezorBlePairingIpcMain(
  base: IpcMainLike,
  browserWindow: BrowserWindow,
): IpcMainLike {
  const addressByConnectId = new Map<string, string>();
  const loggedScanDetailFor = new Set<string>();
  let consecutiveEmptyScans = 0;
  let lastRawWatchAt = 0;
  let lastScanAt = 0;

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
      const pairingMs = Date.now() - startedAt;
      // Spell out the cache verdict rather than leaving it to be re-derived from
      // timestamps later: this is the exact mechanism that fails the connect.
      const cacheVerdict =
        pairingMs >= SDK_SCAN_IDLE_STOP_MS
          ? `CACHE LIKELY CLEARED (pairing ${pairingMs}ms >= idle-stop ${SDK_SCAN_IDLE_STOP_MS}ms) -> connect will have to rediscover`
          : `cache likely intact (pairing ${pairingMs}ms < idle-stop ${SDK_SCAN_IDLE_STOP_MS}ms)`;
      logger.info(
        `[TrezorBLE] OS pairing ${paired} for ${connectId} in ${pairingMs}ms; ${cacheVerdict}`,
      );
      // NO settle delay here. An earlier version waited 2s for the device to
      // resume advertising — but it does not: after bonding it holds the link
      // and waits for the host ("wait connection" on its screen). The wait only
      // pushed a sub-10s pairing past the SDK's 10s idle-stop, which CLEARS the
      // discovered-peripheral cache and is what makes the connect below fail.
      if (paired === 'paired') {
        // Records what is actually on air while noble fails to find the device.
        lastRawWatchAt = 0; // this one always runs, cooldown must not eat it
        maybeRawWatch(RAW_WATCH_SECONDS_POST_PAIR, 'post-pair-air-check');
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
          // Scan WITHOUT the service-UUID filter, then filter here instead.
          //
          // noble's Windows backend filters per RECEIVED PACKET (ble_manager.cc
          // OnScanResult): a packet is dropped unless that packet itself carries
          // a matching service UUID. The Safe 7's ADV packet carries only its
          // name — the service UUID lives in the scan response, which arrives as
          // a separate, irregularly-timed event. So every ADV packet was being
          // thrown away and the device was only discovered if a scan response
          // happened to land: the device is on air, yet the app "cannot find it"
          // for a long time. An empty filter list disables the drop entirely.
          const options = (args[0] ?? {}) as Record<string, unknown>;
          const rest = args.slice(1);
          const result = await listener(
            event,
            { ...options, serviceUuids: [] },
            ...rest,
          );
          if (!Array.isArray(result)) {
            return result;
          }
          // The unfiltered scan sees every BLE device in range, so the Trezor
          // filter that used to happen in noble now happens here — the renderer
          // must still only ever see Trezor devices.
          const all = result as TrezorBleDeviceInfo[];
          const devices = all.filter(isTrezorDevice);

          lastScanAt = Date.now();
          for (const device of devices) {
            if (device?.id && device?.address) {
              addressByConnectId.set(device.id, device.address);
            }
          }

          // Each press of "pair new device" on the Safe 7 mints a fresh random
          // address AND name suffix, so the id is only valid for that one
          // advertising session. Log every scan so that churn is visible.
          logger.info(
            `[TrezorBLE] scan -> ${devices.length}/${all.length} trezor: ${
              devices
                .map((d) => `${d?.id ?? '?'}@${d?.address ?? '?'}`)
                .join(', ') || 'none'
            }`,
          );
          // The advertisement contents prove WHY the device is (or is not) being
          // discovered: an empty advertisedServiceUuids means we are seeing the
          // bare ADV packet, i.e. the packet the old service-UUID filter dropped.
          for (const d of devices) {
            if (!loggedScanDetailFor.has(d.id)) {
              loggedScanDetailFor.add(d.id);
              logger.info(
                `[TrezorBLE] scan detail ${d.id}: name='${
                  d.name ?? d.localName ?? ''
                }' uuids=${JSON.stringify(
                  d.advertisedServiceUuids ?? [],
                )} connectable=${String(d.isConnectable)} rssi=${String(
                  d.rssi,
                )} state=${String(d.state)}`,
              );
            }
          }

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
          return devices;
        });
        return;
      }

      if (channel === TREZOR_BLE_CHANNELS.connect) {
        base.handle(channel, async (event, ...args) => {
          const connectId = String(args[0]);
          await ensurePaired(connectId);
          const startedAt = Date.now();
          const sinceScan = lastScanAt ? startedAt - lastScanAt : -1;
          logger.info(
            `[TrezorBLE] noble connect start ${connectId}; ${sinceScan}ms since last scan (SDK clears its peripheral cache ${SDK_SCAN_IDLE_STOP_MS}ms after the last scan)`,
          );
          try {
            const result = await listener(event, ...args);
            logger.info(
              `[TrezorBLE] noble connect OK for ${connectId} in ${
                Date.now() - startedAt
              }ms`,
            );
            return result;
          } catch (error) {
            // Three very different diseases share one symptom here, so name the
            // one we actually hit: the peripheral was gone from noble's cache and
            // could not be rediscovered ("not found"), vs the link itself refused
            // or timed out. They have different root causes and different fixes.
            const message = error instanceof Error ? error.message : '';
            const isPeripheralGone = /not found/i.test(message);
            const isConnectTimeout = /timed out/i.test(message);
            let kind = 'OTHER';
            if (isPeripheralGone) {
              kind =
                'PERIPHERAL-GONE (evicted from cache AND not re-advertising)';
            } else if (isConnectTimeout) {
              kind = 'CONNECT-TIMEOUT (peripheral known, link did not come up)';
            }
            logger.warn(
              `[TrezorBLE] noble connect FAILED for ${connectId} after ${
                Date.now() - startedAt
              }ms [${kind}]: ${message}`,
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
