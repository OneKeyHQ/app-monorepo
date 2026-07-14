import logger from 'electron-log/main';

// Runtime switches for the Windows Trezor BLE work.
//
// Every one of these is read from the environment at startup, NOT baked in at
// build time, because rebuilding the desktop app costs about an hour. One build
// therefore has to be able to test the whole matrix: set the vars, restart the
// app, try again.
//
// AS OF SDK 1.1.32-alpha.1 THE WORKAROUNDS DEFAULT TO OFF. The SDK's own
// NobleBleHandler now scans unfiltered and falls back to connect-by-id, so these
// are duplicates — and worse than duplicates: `replayDiscover` refills the SDK's
// cache before connect runs, which makes the SDK take its cache path and never
// exercise `_directConnect`. That would mask the one thing we still need to
// prove (that a bonded, silent device is reachable at all) behind a
// `connect.route: cache` log line. Flip one back on with its env var if the SDK
// fix turns out not to have shipped — no rebuild needed.

const isOn = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value === '') return fallback;
  return value !== '0' && value.toLowerCase() !== 'false';
};

export const trezorBleFlags = {
  /**
   * Scan with NO service-UUID filter and filter for Trezor ourselves.
   *
   * noble's Windows backend filters per received packet, and the Safe 7's ADV
   * packet carries no service UUIDs (only its name) — so every ADV packet was
   * being dropped and the device was only found on the rare scan response that
   * happened to carry the UUID. Set to 0 to restore the old filtered scan and
   * A/B this against the previous behavior.
   */
  unfilteredScan: isOn(process.env.ONEKEY_BLE_UNFILTERED_SCAN, false),

  /**
   * After OS pairing, replay the cached `discover` event so the peripheral is
   * back in the SDK's cache before connect runs. Set to 0 to see the raw
   * failure ("device not found") again.
   */
  replayDiscover: isOn(process.env.ONEKEY_BLE_REPLAY_DISCOVER, false),

  /**
   * Connect straight by address, with no scan and no reliance on the SDK's
   * peripheral cache.
   *
   * This is what Trezor Suite does. Its `discover_services` calls
   * `manager.get_peripheral_or_die(id)`, which asks the ADAPTER for its
   * peripheral list (`adapter.peripherals()`) every time — Suite keeps no cache
   * of its own, so a bonded device that has stopped advertising is still
   * addressable. Our SDK instead keeps a `_discovered` map with a 5s
   * advertisement TTL and a 10s idle wipe, which the 8-22s pairing outlives; by
   * the time connect runs the peripheral is gone and the silent, bonded device
   * cannot be rediscovered. noble's Windows backend supports connect-by-address
   * for a never-scanned device (ble_manager.cc `Connect` synthesizes the
   * peripheral), which is the equivalent escape hatch.
   */
  directConnect: isOn(process.env.ONEKEY_BLE_DIRECT_CONNECT, false),

  /**
   * Let the pairing helper keep the BLE link open after bonding instead of
   * closing it. The device holds the link and waits for the host anyway, so
   * closing may be pointless — or may be what lets it advertise again. This
   * flips the experiment.
   */
  pairKeepLink: isOn(process.env.ONEKEY_BLE_PAIR_KEEP_LINK, false),

  /** Raw unfiltered advertisement dumps into the log. */
  rawWatch: isOn(process.env.ONEKEY_BLE_RAW_WATCH, true),
};

export function logTrezorBleFlags(): void {
  logger.info(
    `[TrezorBLE] flags ${JSON.stringify(trezorBleFlags)} ` +
      `(override with ONEKEY_BLE_UNFILTERED_SCAN / ONEKEY_BLE_REPLAY_DISCOVER / ` +
      `ONEKEY_BLE_DIRECT_CONNECT / ONEKEY_BLE_PAIR_KEEP_LINK / ONEKEY_BLE_RAW_WATCH = 0|1)`,
  );
}
