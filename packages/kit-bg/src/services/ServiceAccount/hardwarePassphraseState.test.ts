import { EDeviceType } from '@onekeyfe/hd-shared';

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
    });
    expect(
      serviceThirdPartyHardware.getTrezorPassphraseState,
    ).not.toHaveBeenCalled();
  });

  it('allows Pro2 hidden wallet creation through the core hardware service', async () => {
    const serviceHardware = {
      getPassphraseState: jest.fn(async () => 'PRO2_PASSPHRASE_STATE'),
    };
    const serviceThirdPartyHardware = {
      getTrezorPassphraseState: jest.fn(),
    };

    await expect(
      getHwHiddenWalletPassphraseState({
        vendor: EHardwareVendor.onekey,
        connectId: 'PRO2-USB',
        dbDevice: { deviceType: EDeviceType.Pro2 } as never,
        serviceHardware,
        serviceThirdPartyHardware,
      }),
    ).resolves.toBe('PRO2_PASSPHRASE_STATE');

    expect(serviceHardware.getPassphraseState).toHaveBeenCalledWith({
      connectId: 'PRO2-USB',
    });
  });
});
