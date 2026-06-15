import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { getHwHiddenWalletPassphraseState } from './hardwarePassphraseState';

describe('getHwHiddenWalletPassphraseState', () => {
  it('routes Trezor hidden wallet passphraseState through third-party hardware service', async () => {
    const serviceHardware = {
      getPassphraseState: jest.fn(),
    };
    const serviceThirdPartyHardware = {
      getTrezorPassphraseState: jest.fn(async () => 'TREZOR_PASSPHRASE_STATE'),
    };

    await expect(
      getHwHiddenWalletPassphraseState({
        vendor: EHardwareVendor.trezor,
        connectId: 'TREZOR-USB',
        serviceHardware,
        serviceThirdPartyHardware,
      }),
    ).resolves.toBe('TREZOR_PASSPHRASE_STATE');

    expect(
      serviceThirdPartyHardware.getTrezorPassphraseState,
    ).toHaveBeenCalledWith({
      connectId: 'TREZOR-USB',
    });
    expect(serviceHardware.getPassphraseState).not.toHaveBeenCalled();
  });

  it('keeps OneKey hidden wallet passphraseState on the core hardware service', async () => {
    const serviceHardware = {
      getPassphraseState: jest.fn(async () => 'ONEKEY_PASSPHRASE_STATE'),
    };
    const serviceThirdPartyHardware = {
      getTrezorPassphraseState: jest.fn(),
    };

    await expect(
      getHwHiddenWalletPassphraseState({
        vendor: EHardwareVendor.onekey,
        connectId: 'ONEKEY-USB',
        serviceHardware,
        serviceThirdPartyHardware,
      }),
    ).resolves.toBe('ONEKEY_PASSPHRASE_STATE');

    expect(serviceHardware.getPassphraseState).toHaveBeenCalledWith({
      connectId: 'ONEKEY-USB',
      forceInputPassphrase: true,
    });
    expect(
      serviceThirdPartyHardware.getTrezorPassphraseState,
    ).not.toHaveBeenCalled();
  });
});
