import fs from 'fs';
import path from 'path';

import { readPro2CoprocessorPackageVersion } from '@onekeyhq/kit-bg/src/services/ServiceHardware/pro2BundledBleFirmware';

import { PRO2_BLE_FIRMWARE_VERSIONS } from './pro2BleFirmwareCatalog';

describe('Pro 2 bundled Bluetooth firmware catalog', () => {
  test('ships two debug and two production packages', () => {
    expect(
      PRO2_BLE_FIRMWARE_VERSIONS.filter((item) => item.variant === 'debug'),
    ).toHaveLength(2);
    expect(
      PRO2_BLE_FIRMWARE_VERSIONS.filter(
        (item) => item.variant === 'production',
      ),
    ).toHaveLength(2);
  });

  test.each(PRO2_BLE_FIRMWARE_VERSIONS.map((item) => [item.id, item]))(
    '%s is a signed coprocessor package that matches the catalog',
    (_id, firmware) => {
      const bytes = fs.readFileSync(
        path.join(__dirname, `assets/pro2-ble-${firmware.id}.bin`),
      );

      expect(firmware.byteLength).toBe(bytes.byteLength);
      expect(bytes.subarray(0, 4).toString('utf8')).toBe('OKPP');
      expect(bytes.subarray(8, 12).toString('utf8')).toBe('COPR');
      expect(readPro2CoprocessorPackageVersion(bytes)).toBe(firmware.version);
    },
  );
});
