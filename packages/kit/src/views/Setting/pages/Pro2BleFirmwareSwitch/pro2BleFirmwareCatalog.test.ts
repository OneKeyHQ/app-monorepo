import fs from 'fs';
import path from 'path';

import { PRO2_BLE_FIRMWARE_VERSIONS } from './pro2BleFirmwareCatalog';

describe('Pro 2 bundled Bluetooth firmware catalog', () => {
  test('release 1.0.20 is the signed coprocessor package', () => {
    const release = PRO2_BLE_FIRMWARE_VERSIONS.find(
      (item) => item.id === 'release-1.0.20',
    );
    const bytes = fs.readFileSync(
      path.join(__dirname, 'assets/pro2-ble-release-1.0.20.bin'),
    );

    expect(release?.byteLength).toBe(bytes.byteLength);
    expect(bytes.subarray(0, 4).toString('utf8')).toBe('OKPP');
    expect(bytes.subarray(8, 12).toString('utf8')).toBe('COPR');
    expect(bytes.subarray(24, 35).toString('utf8')).toBe('copr-1.0.20');
  });
});
