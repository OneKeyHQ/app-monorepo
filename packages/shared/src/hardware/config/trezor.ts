// Local mirror of the SDK model allowlist. Importing the Trezor adapter at
// runtime would pull hwk-trezor-core into the main bundle. The device-utils
// tests compare this behavior with the SDK to catch drift.
export const TREZOR_BLE_SUPPORTED_MODEL_NAMES = [
  't3w1',
  'safe 7',
  'trezor safe 7',
] as const;
