import type { ProtocolV2DeviceInfo } from '@onekeyfe/hd-transport';

export function getPro2DeviceInfoDisplayFields(info?: ProtocolV2DeviceInfo) {
  return {
    serialNumber: info?.hw?.serial_no,
    firmwareVersion: info?.fw?.application?.version,
    bootloaderVersion: info?.fw?.bootloader?.version,
    bleVersion: info?.coprocessor?.application?.version,
    bleName: info?.coprocessor?.bt_adv_name,
  };
}
