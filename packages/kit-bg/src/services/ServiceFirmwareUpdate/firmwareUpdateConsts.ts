import type { IDeviceType } from '@onekeyfe/hd-core';

export const FIRMWARE_UPDATE_PREVENT_EXIT = {
  title: 'Quit Update',
  message: 'Are you sure you want to cancel the firmware update?',
  confirm: 'Quit',
  cancel: 'Cancel',
};

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
    // >= 4.1.0 allowed update by App, < 4.1.0 only allowed update by web
    firmware: '4.1.0', // only 4.1.0 support bootloader update
    // ble: '0.0.0',
    // bootloader: '0.0.0',
  },
  'classic': {
    firmware: '3.0.0',
    // ble: '0.0.0',
    // bootloader: '0.0.0',
  },
  'classic1s': {
    firmware: '3.0.0',
    // ble: '0.0.0',
    // bootloader: '0.0.0',
  },
  'mini': {
    firmware: '3.0.0',
    // ble: '0.0.0',
    // bootloader: '0.0.0',
  },
};

const batteryLevelMap = {
  '25%': 1,
  '50%': 2,
  '75%': 3,
  '100%': 4,
};
export const FIRMWARE_UPDATE_MIN_BATTERY_LEVEL = batteryLevelMap['25%'];
