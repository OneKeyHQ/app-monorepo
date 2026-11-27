export type IPro2BleFirmwareVariant = 'debug' | 'production';

export type IPro2BleFirmwareVersion = {
  id: string;
  variant: IPro2BleFirmwareVariant;
  version: string;
  title: string;
  fileName: string;
  byteLength: number;
};

export const PRO2_BLE_FIRMWARE_VARIANTS: readonly {
  variant: IPro2BleFirmwareVariant;
  title: string;
  detail: string;
}[] = [
  {
    variant: 'debug',
    title: 'Debug',
    detail: 'Find My debug build.',
  },
  {
    variant: 'production',
    title: 'Production',
    detail: 'Find My production build.',
  },
];

// Signed coprocessor payload packages. firmwareUpdateV4 installs the package
// itself. A raw Bluetooth image is rejected before the chip is written.
export const PRO2_BLE_FIRMWARE_VERSIONS: readonly IPro2BleFirmwareVersion[] = [
  {
    id: 'findmy-debug-1.0.23',
    variant: 'debug',
    version: '1.0.23',
    title: 'Find My Debug 1.0.23',
    fileName: 'onekey-pro2_find-my_debug_ota_v1.0.23_signed.bin',
    byteLength: 256_528,
  },
  {
    id: 'findmy-debug-1.0.24',
    variant: 'debug',
    version: '1.0.24',
    title: 'Find My Debug 1.0.24',
    fileName: 'onekey-pro2_find-my_debug_ota_v1.0.24_signed.bin',
    byteLength: 256_528,
  },
  {
    id: 'findmy-production-1.0.23',
    variant: 'production',
    version: '1.0.23',
    title: 'Find My Production 1.0.23',
    fileName: 'onekey-pro2_find-my_production_ota_v1.0.23_signed.bin',
    byteLength: 255_064,
  },
  {
    id: 'findmy-production-1.0.24',
    variant: 'production',
    version: '1.0.24',
    title: 'Find My Production 1.0.24',
    fileName: 'onekey-pro2_find-my_production_ota_v1.0.24_signed.bin',
    byteLength: 255_064,
  },
];
