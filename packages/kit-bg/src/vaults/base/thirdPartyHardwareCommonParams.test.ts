import { thirdPartyPassphraseParamsFromDeviceParams } from './thirdPartyHardwareCommonParams';

describe('thirdPartyPassphraseParamsFromDeviceParams', () => {
  it('returns passphraseState and useEmptyPassphrase from wallet-bound device params', () => {
    expect(
      thirdPartyPassphraseParamsFromDeviceParams({
        dbDevice: {} as never,
        deviceCommonParams: {
          passphraseState: 'aabbccdd',
          useEmptyPassphrase: true,
        },
      }),
    ).toEqual({
      passphraseState: 'aabbccdd',
      useEmptyPassphrase: true,
    });

    expect(
      thirdPartyPassphraseParamsFromDeviceParams({
        dbDevice: {} as never,
      }),
    ).toEqual({});
  });
});
