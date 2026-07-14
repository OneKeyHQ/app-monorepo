import logger from 'electron-log/main';

// Runtime switches for the Windows Trezor BLE work.
//
// Every one of these is read from the environment at startup, NOT baked in at
// build time, because rebuilding the desktop app costs about an hour. One build
// therefore has to be able to test the whole matrix: set the vars, restart the
// app, try again. Defaults are the behavior we currently believe is correct, so
// a plain launch needs no environment at all.

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
  unfilteredScan: isOn(process.env.ONEKEY_BLE_UNFILTERED_SCAN, true),

  /**
   * After OS pairing, replay the cached `discover` event so the peripheral is
   * back in the SDK's cache before connect runs. Set to 0 to see the raw
   * failure ("device not found") again.
   */
  replayDiscover: isOn(process.env.ONEKEY_BLE_REPLAY_DISCOVER, true),

  /**
   * Instead of (or as well as) replaying discover, have noble connect straight
   * by address with no scan. Off by default — it also opens the link itself,
   * which overlaps with what the SDK's connect is about to do.
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
