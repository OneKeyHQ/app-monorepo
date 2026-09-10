import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { matchesVerifiedDeviceIdentity } from './verifiedDeviceIdentity';

import type { IVerifiedDeviceIdentity } from './verifiedDeviceIdentity';

describe('verified device identity strategies', () => {
  it.each([EHardwareVendor.ledger, EHardwareVendor.trezor])(
    'supports both identity strategies independently of vendor (%s)',
    (vendor) => {
      const record = {
        vendor,
        deviceId: 'device-id',
        chainFingerprints: { evm: 'chain-fingerprint' },
      };
      expect(
        matchesVerifiedDeviceIdentity(record, {
          vendor,
          identity: { type: 'deviceId', value: 'device-id' },
        }),
      ).toBe(true);
      expect(
        matchesVerifiedDeviceIdentity(record, {
          vendor,
          identity: {
            type: 'chainFingerprint',
            chain: 'evm',
            value: 'chain-fingerprint',
          },
        }),
      ).toBe(true);
    },
  );

  it('checks wallet identities without requiring a chain', () => {
    expect(
      matchesVerifiedDeviceIdentity(
        {
          vendor: EHardwareVendor.keystone,
          connectId: 'wallet-identity',
        },
        {
          vendor: EHardwareVendor.keystone,
          identity: { type: 'walletId', value: 'wallet-identity' },
        },
      ),
    ).toBe(true);
  });

  it.each([
    {
      vendor: EHardwareVendor.trezor,
      identity: { type: 'deviceId', value: 'device-id' },
    },
    {
      vendor: EHardwareVendor.ledger,
      identity: { type: 'deviceId', value: '' },
    },
    {
      vendor: EHardwareVendor.ledger,
      identity: { type: 'deviceId', value: 'wrong-id' },
    },
    {
      vendor: EHardwareVendor.ledger,
      identity: { type: 'future-proof', value: 'device-id' },
    },
    { vendor: EHardwareVendor.ledger, identity: { type: 'chainFingerprint' } },
  ])(
    'rejects mismatched, incomplete or unknown proofs (%j)',
    (verification) => {
      expect(
        matchesVerifiedDeviceIdentity(
          {
            vendor: EHardwareVendor.ledger,
            deviceId: 'device-id',
          },
          verification as IVerifiedDeviceIdentity,
        ),
      ).toBe(false);
    },
  );
});
