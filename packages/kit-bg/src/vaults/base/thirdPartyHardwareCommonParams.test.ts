import { thirdPartyPassphraseParamsFromDeviceParams } from './thirdPartyHardwareCommonParams';

describe('thirdPartyPassphraseParamsFromDeviceParams', () => {
  it('returns hidden-wallet passphraseState without empty-passphrase', () => {
    expect(
      thirdPartyPassphraseParamsFromDeviceParams({
        dbDevice: {} as never,
        deviceCommonParams: {
          passphraseState: 'aabbccdd',
        },
      }),
    ).toEqual({
      passphraseState: 'aabbccdd',
    });
  });

  it('returns standard-wallet empty-passphrase without passphraseState', () => {
    expect(
      thirdPartyPassphraseParamsFromDeviceParams({
        dbDevice: {} as never,
        deviceCommonParams: {
          useEmptyPassphrase: true,
        },
      }),
    ).toEqual({
      useEmptyPassphrase: true,
    });
  });

  it('keeps a hidden wallet exclusive when empty-passphrase is also present', () => {
    expect(
      thirdPartyPassphraseParamsFromDeviceParams({
        dbDevice: {} as never,
        deviceCommonParams: {
          passphraseState: 'aabbccdd',
          useEmptyPassphrase: true,
        } as never,
      }),
    ).toEqual({
      passphraseState: 'aabbccdd',
    });
  });

  it('returns empty params when the wallet binding is missing', () => {
    expect(
      thirdPartyPassphraseParamsFromDeviceParams({
        dbDevice: {} as never,
      }),
    ).toEqual({});
  });
});
