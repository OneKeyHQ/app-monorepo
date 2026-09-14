import {
  isTrezorBleServiceUuid,
  isTrezorSafe7BleName,
} from '@onekeyfe/hwk-trezor-adapter';
import { TREZOR_BLE_CHANNELS } from '@onekeyfe/hwk-trezor-connector-electron-ble/main';
import { dialog } from 'electron';
import logger from 'electron-log/main';

import { ElectronTranslations, i18nText } from '../i18n';

import {
  decideActivePairing,
  ensureDevicePaired,
  isBlePairAvailable,
  startRawAdvertisementWatch,
} from './BlePair';
import { trezorBleFlags } from './trezorBleFlags';

import type { IPairCeremonyToken } from './BlePair';
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

// Top-two-bits address classification (BLE core spec, mirrors the Rust
// helper). A Safe 7 mints a fresh RPA on every advertising (re)start.
function classifyBleAddress(id: string): string {
  const firstByte = Number.parseInt(id.slice(0, 2), 16);
  if (Number.isNaN(firstByte)) return 'unparseable';
  const top2 = (firstByte >> 6) & 0b11;
  if (top2 === 0b01) return 'RPA(rotating)';
  if (top2 === 0b11) return 'static-random';
  if (top2 === 0b00) return 'non-resolvable-private';
  return 'reserved';
}

export function createTrezorBlePairingIpcMain(
  base: IpcMainLike,
  browserWindow: BrowserWindow,
): IpcMainLike {
  const addressByConnectId = new Map<string, string>();
  const loggedScanDetailFor = new Set<string>();
  // Session-long address history; never pruned so verdicts can cite it.
  const seenTrezorAddresses = new Map<
    string,
    { firstSeenAt: number; lastSeenAt: number; scans: number }
  >();
  let consecutiveEmptyScans = 0;
  let lastRawWatchAt = 0;
  let lastScanAt = 0;

  const seenHistoryForLog = () =>
    [...seenTrezorAddresses.entries()]
      .map(
        ([id, s]) =>
          `${id}(${classifyBleAddress(id)}, last seen ${Math.round(
            (Date.now() - s.lastSeenAt) / 1000,
          )}s ago, ${s.scans} scans)`,
      )
      .join('; ') || 'none';

  const maybeRawWatch = (seconds: number, reason: string) => {
    if (!trezorBleFlags.rawWatch) return;
    const now = Date.now();
    if (now - lastRawWatchAt < RAW_WATCH_COOLDOWN_MS) return;
    lastRawWatchAt = now;
    startRawAdvertisementWatch(seconds, reason);
  };

  // Set when a ceremony registers, so a dialog left open by an earlier attempt
  // answers nothing instead of answering the attempt that replaced it.
  let ceremonyToken: IPairCeremonyToken | undefined;

  const showPin = (pin: string) => {
    const dialogToken = ceremonyToken;
    // The host's half of the numeric comparison: the helper holds the pairing
    // request open until we answer. Declining is what tells the device over SMP.
    const shownAt = Date.now();
    // Never log the code itself — it authorizes the bond while it is on screen.
    logger.info('[TrezorBLE] pin dialog shown');
    void dialog
      .showMessageBox(browserWindow, {
        type: 'info',
        title: i18nText(ElectronTranslations.transfer_pair_code),
        message: pin,
        detail: i18nText(ElectronTranslations.global_confirm_on_device),
        buttons: [
          i18nText(ElectronTranslations.global_confirm),
          i18nText(ElectronTranslations.global_cancel),
        ],
        defaultId: 0,
        // X routes here too, so closing the dialog now actually cancels.
        cancelId: 1,
        noLink: true,
      })
      .then(({ response }) => {
        const decision = response === 1 ? 'cancel' : 'confirm';
        // Compare against the helper's `sinceAccept` to tell an OS timeout apart
        // from "we outran the user".
        logger.info(
          `[TrezorBLE] pin dialog answered '${decision}' after ${
            Date.now() - shownAt
          }ms`,
        );
        const delivered = decideActivePairing(decision, dialogToken);
        if (!delivered) {
          logger.warn(
            `[TrezorBLE] pin dialog '${decision}' had no ceremony to answer (already settled)`,
          );
        }
      })
      .catch(() => undefined);
  };

  // A FRESH bond leaves the device holding the pairing link (not advertising),
  // so the connect handler retries once only in the 'paired' case.
  type IEnsurePairedOutcome = 'paired' | 'already-paired' | 'skipped';

  // Serialize pairing: an attempt fired while another is still active gets
  // DevicePairingResultStatus(15) OperationAlreadyInProgress from Windows.
  let pairingInFlight: Promise<unknown> | null = null;

  const ensurePaired = async (
    connectId: string,
  ): Promise<IEnsurePairedOutcome> => {
    if (!isBlePairAvailable()) return 'skipped'; // non-Windows / helper not bundled
    // Loop, not a single check: several waiters resume together when the
    // holder settles, and each must re-check before claiming the slot.
    for (;;) {
      const holder = pairingInFlight;
      if (!holder) break;
      logger.warn(
        `[TrezorBLE] pairing already in flight; waiting before pairing ${connectId}`,
      );
      await holder.catch(() => undefined);
    }
    const address = addressByConnectId.get(connectId);
    if (!address) {
      // No cached address means it was never scanned this session — the
      // stale-RPA signature for a persisted bleConnectId. Assume a prior OS
      // bond and let noble try anyway.
      logger.warn(
        `[TrezorBLE] no cached address for ${connectId} (${classifyBleAddress(
          connectId,
        )}); skipping OS pairing, expect connect to fail. seenThisSession=[${seenHistoryForLog()}]`,
      );
      return 'skipped';
    }
    logger.info(
      `[TrezorBLE] ensuring OS pairing for ${connectId} (${address})`,
    );
    const startedAt = Date.now();
    // ensureDevicePaired no-ops (already-paired) when the OS bond already exists.
    // No await between the while-check above and this claim, or the
    // serialization silently breaks.
    const pairing = ensureDevicePaired(
      address,
      showPin,
      trezorBleFlags.pairKeepLink,
      (token) => {
        ceremonyToken = token;
      },
    );
    const claimed = pairing.catch(() => undefined);
    pairingInFlight = claimed;
    try {
      const paired = await pairing;
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
      return paired;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      logger.warn(
        `[TrezorBLE] OS pairing FAILED for ${connectId} after ${
          Date.now() - startedAt
        }ms: ${message}`,
      );
      // Status 19 + instant link drop = the device still holds its half of a
      // deleted bond. Appended (not replaced) to keep substring matching alive.
      if (
        error instanceof Error &&
        message.includes('DevicePairingResultStatus(19)') &&
        !message.includes('refused the pairing immediately')
      ) {
        error.message =
          `${message} — the device refused the pairing immediately. It likely ` +
          `still holds an old pairing for this computer: delete this ` +
          `computer in the device's Bluetooth settings (or it was declined ` +
          `on the device), then retry.`;
      }
      throw error;
    } finally {
      // Ownership-checked: another call may have claimed the slot already.
      if (pairingInFlight === claimed) {
        pairingInFlight = null;
      }
    }
  };

  return {
    handle: (channel, listener) => {
      if (channel === TREZOR_BLE_CHANNELS.scan) {
        base.handle(channel, async (event, ...args) => {
          // The SDK now scans unfiltered by default and filters for Trezor itself
          // (NobleBleHandler, 1.1.32-alpha.1), so nothing is rewritten here. We
          // only observe: cache the id->address mapping the pairing helper needs,
          // and log what was seen.
          const result = await listener(event, ...args);
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
            if (device?.id) {
              const known = seenTrezorAddresses.get(device.id);
              if (known) {
                known.lastSeenAt = lastScanAt;
                known.scans += 1;
              } else {
                // New address while older ones exist = RPA rotation.
                if (seenTrezorAddresses.size > 0) {
                  logger.info(
                    `[TrezorBLE][RPA] NEW address ${device.id} (${classifyBleAddress(
                      device.id,
                    )}); previously seen this session: ${seenHistoryForLog()}`,
                  );
                }
                seenTrezorAddresses.set(device.id, {
                  firstSeenAt: lastScanAt,
                  lastSeenAt: lastScanAt,
                  scans: 1,
                });
              }
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
          const pairOutcome = await ensurePaired(connectId);

          const attemptConnect = async (attempt: number) => {
            const startedAt = Date.now();
            const sinceScan = lastScanAt ? startedAt - lastScanAt : -1;
            const targetSeen = seenTrezorAddresses.get(connectId);
            logger.info(
              `[TrezorBLE] connect start ${connectId} (${classifyBleAddress(
                connectId,
              )}, attempt ${attempt}); ${sinceScan}ms since last scan (SDK cache idle-stop ${SDK_SCAN_IDLE_STOP_MS}ms); ${
                targetSeen
                  ? `last advertised ${Math.round(
                      (startedAt - targetSeen.lastSeenAt) / 1000,
                    )}s ago`
                  : 'NEVER advertised this session'
              }`,
            );
            // Reaching a bonded, silent device is the SDK's job
            // (NobleBleHandler._directConnect); the app-side attempt at it
            // needed a noble proxy that blinded the scan outright.
            try {
              const result = await listener(event, ...args);
              logger.info(
                `[TrezorBLE] connect OK ${connectId} in ${
                  Date.now() - startedAt
                }ms (attempt ${attempt})`,
              );
              return result;
            } catch (error) {
              // Name the disease: gone from noble's cache and not
              // re-advertising, vs a link that refused or timed out.
              const message = error instanceof Error ? error.message : '';
              let kind = 'OTHER';
              if (/not found/i.test(message)) {
                kind = 'PERIPHERAL-GONE';
              } else if (/timed out/i.test(message)) {
                kind = 'CONNECT-TIMEOUT';
              }
              // A stale address is the prime suspect when the target never
              // advertised this session, or last did so long ago — the device
              // mints a fresh RPA on every advertising restart.
              const seen = seenTrezorAddresses.get(connectId);
              const staleness = seen
                ? Math.round((Date.now() - seen.lastSeenAt) / 1000)
                : undefined;
              const verdict =
                staleness === undefined
                  ? '; STALE-ADDRESS suspected (never advertised this session)'
                  : `; last advertised ${staleness}s ago${
                      staleness > 30 ? ' (may have rotated since)' : ''
                    }`;
              logger.warn(
                `[TrezorBLE] connect FAILED ${connectId} after ${
                  Date.now() - startedAt
                }ms (attempt ${attempt}) [${kind}]: ${message}${verdict}`,
              );
              throw error;
            }
          };

          // NO app-side disconnect cleanup here: the SDK's connect() already
          // _safeDisconnects the peripheral on any failure, and its
          // disconnect(id) early-returns for a never-connected id anyway.
          try {
            return await attemptConnect(1);
          } catch (firstError) {
            const firstMessage =
              firstError instanceof Error ? firstError.message : '';
            // First connect after a fresh bond routinely fails (device still
            // holds the pairing link); one delayed retry, fresh-pair case only.
            // NOT after a race timeout: the SDK's _connectInner may still be
            // running (Promise.race rejects without cancelling it), and a
            // second connect on top would corrupt its connected-map state.
            if (pairOutcome === 'paired' && !/timed out/i.test(firstMessage)) {
              logger.info(
                `[TrezorBLE] first connect after a FRESH pairing failed; retrying once in 3000ms (device usually still holds the pairing link)`,
              );
              await new Promise((resolve) => {
                setTimeout(resolve, 3000);
              });
              return await attemptConnect(2);
            }
            // Bonded but unreachable: waking the device is the cure, not
            // re-pairing. Appended so trezorTransportUtils substring match survives.
            if (
              pairOutcome === 'already-paired' &&
              firstError instanceof Error &&
              firstMessage.includes('unreachable while discovering services') &&
              !firstMessage.includes('wake the device')
            ) {
              firstError.message =
                `${firstMessage} — the device is already paired with ` +
                `this computer but is not responding; wake the device and ` +
                `retry instead of re-pairing.`;
            }
            throw firstError;
          }
        });
        return;
      }

      if (channel === TREZOR_BLE_CHANNELS.cancelPairing) {
        base.handle(channel, async (event, ...args) => {
          // The SDK abandons its noble connect; the OS-pairing ceremony is ours.
          const declined = decideActivePairing('cancel');
          if (declined) {
            logger.info(
              '[TrezorBLE] cancelPairing: declined the in-flight OS pairing ceremony',
            );
          }
          return listener(event, ...args);
        });
        return;
      }

      if (channel === TREZOR_BLE_CHANNELS.disconnect) {
        base.handle(channel, async (event, ...args) => {
          // Disconnect is the RPA-rotation trigger; timestamp it.
          const connectId = String(args[0]);
          logger.info(`[TrezorBLE] noble disconnect start ${connectId}`);
          try {
            const result = await listener(event, ...args);
            logger.info(
              `[TrezorBLE] noble disconnect OK ${connectId}; the next advertising session will likely use a NEW address`,
            );
            return result;
          } catch (error) {
            logger.warn(
              `[TrezorBLE] noble disconnect FAILED ${connectId}: ${
                error instanceof Error ? error.message : ''
              }`,
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
