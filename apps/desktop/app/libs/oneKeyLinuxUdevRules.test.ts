import fs from 'node:fs';
import path from 'node:path';

import { ONEKEY_WEBUSB_FILTER } from '@onekeyfe/hd-shared';

const UDEV_RULES_PATH = path.join(
  __dirname,
  '../../public/static/udev/99-onekey.rules',
);

function toUsbHex(id: number) {
  return id.toString(16).padStart(4, '0');
}

describe('Linux udev rules', () => {
  it('grants WebUSB access for every OneKey USB product id', () => {
    const rules = fs.readFileSync(UDEV_RULES_PATH, 'utf8');

    expect(ONEKEY_WEBUSB_FILTER.length).toBeGreaterThan(0);

    for (const filter of ONEKEY_WEBUSB_FILTER) {
      expect(filter.vendorId).toEqual(expect.any(Number));
      expect(filter.productId).toEqual(expect.any(Number));

      const vendorId = toUsbHex(filter.vendorId as number);
      const productId = toUsbHex(filter.productId as number);
      const usbRule = rules
        .split('\n')
        .find(
          (line) =>
            line.includes('SUBSYSTEM=="usb"') &&
            line.includes(`idVendor}=="${vendorId}"`) &&
            line.includes(`idProduct}=="${productId}"`) &&
            line.includes('TAG+="uaccess"'),
        );

      expect(usbRule).toBeDefined();
    }
  });
});
