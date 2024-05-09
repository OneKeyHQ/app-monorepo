import type { IDeviceType } from '@onekeyfe/hd-core';

export const MOCK_LOW_BATTERY_LEVEL = false;
export const MOCK_ALWAYS_UPDATE_BRIDGE = false;
export const MOCK_ALL_IS_UP_TO_DATE = false;
// TODO settings.devmode:  const isPreRelease = preReleaseUpdate && enable;
export const MOCK_PRE_RELEASE_CONFIG = true;
export const MOCK_FORCE_UPDATE_RES_EVEN_SAME_VERSION = true;
export const MOCK_SHOULD_UPDATE_FULL_RES = false;
export const FIRMWARE_UPDATE_MIN_VERSION_ALLOWED: Partial<
  Record<
    IDeviceType,
    {
      ble?: string;
      firmware?: string;
      bootloader?: string;
    }
  >
> = {
  'touch': {
    // >= 4.1.0 allowed
    firmware: '4.1.0', // only 4.1.0 support bootloader update
  },
  'classic': {
    firmware: '2.11.0',
  },
  'classic1s': {
    firmware: '2.11.0',
  },
  'mini': {
    firmware: '2.11.0',
  },
};

const batteryLevelMap = {
  '25%': 1,
  '50%': 2,
  '75%': 3,
  '100%': 4,
};
export const FIRMWARE_UPDATE_MIN_BATTERY_LEVEL = batteryLevelMap['25%'];
