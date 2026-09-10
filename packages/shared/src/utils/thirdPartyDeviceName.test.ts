import { getThirdPartyDeviceDisplayName } from './thirdPartyDeviceName';

describe('getThirdPartyDeviceDisplayName', () => {
  it.each([
    {
      modelName: 'Keystone 3 Pro',
      name: 'Keystone 3 Pro (12345678-1234-1234-1234-123456789abc)',
    },
    { modelName: '3 Pro', name: 'Keystone' },
    { model: 'Keystone 3 Pro', name: '12345678-1234-1234-1234-123456789abc' },
    { name: 'Keystone 3 Pro (12345678-1234-1234-1234-123456789abc)' },
    { modelName: 'Keystone Keystone 3 Pro' },
    { modelName: 'unknown', model: '3 Pro' },
  ])('shows only one Keystone brand and model: %j', (fields) => {
    expect(
      getThirdPartyDeviceDisplayName({ brand: 'Keystone', ...fields }),
    ).toBe('Keystone 3 Pro');
  });

  it.each([
    '',
    'unknown',
    '12345678-1234-1234-1234-123456789abc',
    'a'.repeat(64),
  ])('never uses an identity as the fallback name: %s', (name) => {
    expect(getThirdPartyDeviceDisplayName({ brand: 'Keystone', name })).toBe(
      'Keystone',
    );
  });

  it.each([
    ['Ledger', 'Nano X', 'Ledger Nano X'],
    ['Ledger', 'Ledger Nano X', 'Ledger Nano X'],
    ['Trezor', 'Safe 7', 'Trezor Safe 7'],
    ['Trezor', 'Trezor Safe 7', 'Trezor Safe 7'],
    ['Keystone', 'Keystone3 Pro', 'Keystone3 Pro'],
    ['Keystone', 'Keystone-3-Pro', 'Keystone-3-Pro'],
  ])('deduplicates %s product names', (brand, modelName, expected) => {
    expect(
      getThirdPartyDeviceDisplayName({ brand, modelName, name: expected }),
    ).toBe(expected);
  });
});
