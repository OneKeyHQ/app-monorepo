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
      forceInputPassphrase: true,
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
      forceInputPassphrase: true,
    });
  });

  it('forwards deriveCardano only when true and omits the key otherwise', async () => {
    const getPassphraseState = jest.fn<
      Promise<string | undefined>,
      [
        {
          connectId: string;
          forceInputPassphrase: boolean;
          deriveCardano?: boolean;
        },
      ]
    >(async () => 'PRO2_PASSPHRASE_STATE');
    const serviceHardware = {
      getPassphraseState,
    };
    const serviceThirdPartyHardware = {
      getTrezorPassphraseState: jest.fn(),
    };

    await getHwHiddenWalletPassphraseState({
      vendor: EHardwareVendor.onekey,
      connectId: 'PRO2-USB',
      deriveCardano: true,
      serviceHardware,
      serviceThirdPartyHardware,
    });

    expect(getPassphraseState).toHaveBeenNthCalledWith(1, {
      connectId: 'PRO2-USB',
      forceInputPassphrase: true,
      deriveCardano: true,
    });

    await getHwHiddenWalletPassphraseState({
      vendor: EHardwareVendor.onekey,
      connectId: 'PRO2-USB',
      deriveCardano: false,
      serviceHardware,
      serviceThirdPartyHardware,
    });

    const secondCallParams = getPassphraseState.mock.calls[1][0];
    expect(secondCallParams).toEqual({
      connectId: 'PRO2-USB',
      forceInputPassphrase: true,
    });
    expect('deriveCardano' in secondCallParams).toBe(false);
  });
});
