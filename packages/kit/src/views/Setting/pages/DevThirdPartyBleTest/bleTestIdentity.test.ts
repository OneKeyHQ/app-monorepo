import { createHash } from 'crypto';

import { CHAIN_FINGERPRINT_PATHS } from '@onekeyfe/hwk-adapter-core';

import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import {
  getBleTestAddressIdentity,
  getInitialBleTestIdentity,
} from './bleTestIdentity';

it('does not use the Nano X BLE address as an expected wallet fingerprint', () => {
  expect(
    getInitialBleTestIdentity(EHardwareVendor.ledger, 'd5757d4b51e8'),
  ).toBe('');
});

it('pins the first EVM address using the SDK wallet fingerprint format', () => {
  const address = '0xAbCdEf0123456789aBcDef0123456789AbCdEf01';
  const fingerprint = createHash('sha256')
    .update(address.toLowerCase())
    .digest('hex')
    .slice(0, 16);
  expect(CHAIN_FINGERPRINT_PATHS.evm).toBe("m/44'/60'/0'/0/0");
  expect(
    getBleTestAddressIdentity(EHardwareVendor.ledger, 'd5757d4b51e8', address),
  ).toBe(fingerprint);
  expect(
    getBleTestAddressIdentity(
      EHardwareVendor.ledger,
      'd5757d4b51e8',
      address.toLowerCase(),
    ),
  ).toBe(fingerprint);
});

it('preserves the Trezor device identity across connection and address reads', () => {
  expect(getInitialBleTestIdentity(EHardwareVendor.trezor, 'trezor-id')).toBe(
    'trezor-id',
  );
  expect(
    getBleTestAddressIdentity(EHardwareVendor.trezor, 'trezor-id', '0x1234'),
  ).toBe('trezor-id');
});
