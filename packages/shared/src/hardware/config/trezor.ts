// Local mirror of the SDK model allowlist. Importing the Trezor adapter at
// runtime would pull hwk-trezor-core into the main bundle. The device-utils
// tests compare this behavior with the SDK to catch drift.
export const TREZOR_BLE_SUPPORTED_MODEL_NAMES = [
  't3w1',
  'safe 7',
  'trezor safe 7',
] as const;

// Models known to have no Bluetooth. Only these constrain discovery to USB;
// an unrecognized (e.g. newer) model is left unconstrained.
export const TREZOR_USB_ONLY_MODEL_NAMES = [
  '1',
  't1b1',
  'model one',
  'trezor model one',
  't2t1',
  'model t',
  'trezor model t',
  't2b1',
  't3b1',
  'safe 3',
  'trezor safe 3',
  't3t1',
  'safe 5',
  'trezor safe 5',
] as const;

// Models whose firmware provides the SetBrightness device-management command.
export const TREZOR_BRIGHTNESS_SUPPORTED_MODEL_NAMES = [
  't2t1',
  'model t',
  'trezor model t',
  't3t1',
  'safe 5',
  'trezor safe 5',
  't3w1',
  'safe 7',
  'trezor safe 7',
] as const;
