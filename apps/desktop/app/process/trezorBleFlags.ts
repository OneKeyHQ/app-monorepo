import logger from 'electron-log/main';

// Runtime switches for the Windows Trezor BLE work. Read from the environment at
// startup, NOT baked in at build time, because rebuilding the desktop app costs
// about an hour — one build has to be able to test more than one configuration.
//
// The scan/connect workarounds that used to live here are GONE. They needed a
// proxy around noble, and that proxy blinded the scan completely: the SDK saw
// zero peripherals while a WinRT watcher in another process saw 29 at the same
// moment, and it silently disabled the SDK's connect-by-id fallback by not
// forwarding `connectAsync`. The SDK owns both behaviors as of 1.1.32-alpha.1
// (NobleBleHandler: unfiltered scan + `_directConnect`). Do not reintroduce a
// noble proxy here.

const isOn = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value === '') return fallback;
  return value !== '0' && value.toLowerCase() !== 'false';
};

export const trezorBleFlags = {
  /**
   * Let the pairing helper keep the BLE link open after bonding instead of
   * closing it. The device holds the link and waits for the host anyway, so
   * closing may be pointless — or may be the only thing that lets it advertise
   * again. This flips that experiment without a rebuild.
   */
  pairKeepLink: isOn(process.env.ONEKEY_BLE_PAIR_KEEP_LINK, false),

  /**
   * Dump raw, unfiltered BLE advertisements into the log (via the pairing
   * helper's `watch` command, in its own process). This is the only view of the
   * radio that does not go through noble — which is exactly what caught the
   * proxy blinding the scan.
   */
  rawWatch: isOn(process.env.ONEKEY_BLE_RAW_WATCH, true),
};

export function logTrezorBleFlags(): void {
  logger.info(
    `[TrezorBLE] flags ${JSON.stringify(trezorBleFlags)} ` +
      `(override with ONEKEY_BLE_PAIR_KEEP_LINK / ONEKEY_BLE_RAW_WATCH = 0|1)`,
  );
}
