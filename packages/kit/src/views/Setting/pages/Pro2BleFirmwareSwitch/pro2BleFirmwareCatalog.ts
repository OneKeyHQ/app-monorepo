export type IPro2BleFirmwareVersion = {
  id: string;
  title: string;
  detail: string;
  byteLength: number;
};

// Signed coprocessor payload packages. firmwareUpdateV4 installs the package
// itself. A raw Bluetooth image is rejected before the chip is written.
export const PRO2_BLE_FIRMWARE_VERSIONS: readonly IPro2BleFirmwareVersion[] = [
  {
    id: 'release-1.0.20',
    title: 'Release 1.0.20',
    detail: 'Normal Pro 2 Bluetooth firmware. Package 998b670.',
    byteLength: 206_480,
  },
];
