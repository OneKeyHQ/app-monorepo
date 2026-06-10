import { thirdPartyPassphraseParamsFromDeviceParams } from './thirdPartyHardwareCommonParams';

describe('thirdPartyPassphraseParamsFromDeviceParams', () => {
  it('returns passphraseState only when the wallet-bound device params carry it', () => {
    expect(
      thirdPartyPassphraseParamsFromDeviceParams({
        dbDevice: {} as never,
        deviceCommonParams: {
          passphraseState: 'aabbccdd',
          useEmptyPassphrase: false,
        },
      }),
    ).toEqual({
      passphraseState: 'aabbccdd',
    });

    expect(
      thirdPartyPassphraseParamsFromDeviceParams({
        dbDevice: {} as never,
      }),
    ).toEqual({});
  });
});
