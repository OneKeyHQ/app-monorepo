import type { IDeviceType } from '@onekeyfe/hd-core';

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
