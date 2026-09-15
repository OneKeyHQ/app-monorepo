import { getThirdPartyDeviceDisplayName } from './thirdPartyDeviceName';

describe('getThirdPartyDeviceDisplayName', () => {
  it.each([
    // Keystone's connector already returns a product name.
    [{ name: 'Keystone 3 Pro' }, 'Keystone 3 Pro'],
    // Trezor reports the label the user wrote onto the device.
    [{ name: 'Leo', model: 'T3W1' }, 'Leo'],
    // Ledger BLE reports the advertised name.
    [{ name: 'Nano X 1456', model: 'nanoX' }, 'Nano X 1456'],
  ])('keeps the name the vendor SDK reported: %j', (fields, expected) => {
    expect(getThirdPartyDeviceDisplayName({ brand: 'Vendor', ...fields })).toBe(
      expected,
    );
  });

  it('falls back through modelName and model before the brand', () => {
    expect(
      getThirdPartyDeviceDisplayName({ brand: 'Ledger', modelName: 'Nano X' }),
    ).toBe('Nano X');
    expect(
      getThirdPartyDeviceDisplayName({ brand: 'Ledger', model: 'nanoX' }),
    ).toBe('nanoX');
    expect(getThirdPartyDeviceDisplayName({ brand: 'Keystone' })).toBe(
      'Keystone',
    );
  });

  it.each([
    '',
    'unknown',
    '12345678-1234-1234-1234-123456789abc',
    // A Trezor BLE connectId is exactly this shape.
    '81a6048ecf0d10bcf684e8a0b0b700b8',
    'a'.repeat(64),
  ])(
    'never shows a placeholder or a transport address as the name: %s',
    (name) => {
      expect(getThirdPartyDeviceDisplayName({ brand: 'Keystone', name })).toBe(
        'Keystone',
      );
    },
  );
});
