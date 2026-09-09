import { EDeviceType } from '@onekeyfe/hd-shared';

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import {
  buildDefaultAddAccountNetworks,
  buildDefaultAddAccountNetworksForQrWallet,
} from './defaultNetworkAccountsConfig';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

function expectDefaultFourNetworkIds(
  networks: Awaited<ReturnType<typeof buildDefaultAddAccountNetworks>>,
) {
  const networkIdsMap = getNetworkIdsMap();
  expect(new Set(networks.map((network) => network.networkId))).toEqual(
    new Set([
      networkIdsMap.btc,
      networkIdsMap.eth,
      networkIdsMap.trx,
      networkIdsMap.sol,
    ]),
  );
}

describe('buildDefaultAddAccountNetworks', () => {
  it('uses the OneKey default four networks for Trezor third-party add-account', async () => {
    const networkIdsMap = getNetworkIdsMap();
    const backgroundApi = {
      serviceAccount: {
        isBtcOnlyFirmwareByWalletId: jest.fn(async () => false),
        isThirdPartyHwByWalletId: jest.fn(async () => true),
        getWalletDevice: jest.fn(async () => ({
          vendor: EHardwareVendor.trezor,
        })),
      },
      serviceNetwork: {
        getGlobalDeriveTypeOfNetwork: jest.fn(async () => undefined),
      },
    } as unknown as IBackgroundApi;

    const networks = await buildDefaultAddAccountNetworks({
      backgroundApi,
      walletId: 'hw-trezor-wallet',
      firmwareType: undefined,
      isCreateWallet: false,
      includingNetworkWithGlobalDeriveType: true,
      customNetworks: [
        {
          networkId: networkIdsMap.eth,
          deriveType: 'default',
        },
      ],
    });

    expectDefaultFourNetworkIds(networks);
  });

  it('keeps Ledger third-party explicit-network add-account out of the default four networks', async () => {
    const networkIdsMap = getNetworkIdsMap();
    const backgroundApi = {
      serviceAccount: {
        isBtcOnlyFirmwareByWalletId: jest.fn(async () => false),
        isThirdPartyHwByWalletId: jest.fn(async () => true),
        getWalletDevice: jest.fn(async () => ({
          vendor: EHardwareVendor.ledger,
        })),
      },
      serviceNetwork: {
        getGlobalDeriveTypeOfNetwork: jest.fn(async () => undefined),
      },
    } as unknown as IBackgroundApi;

    const networks = await buildDefaultAddAccountNetworks({
      backgroundApi,
      walletId: 'hw-ledger-wallet',
      firmwareType: undefined,
      isCreateWallet: false,
      includingNetworkWithGlobalDeriveType: true,
      customNetworks: [
        {
          networkId: networkIdsMap.eth,
          deriveType: 'default',
        },
      ],
    });

    expect(networks).toEqual([]);
  });
});

describe('buildDefaultAddAccountNetworksForQrWallet', () => {
  const backgroundApi = {
    serviceNetwork: {
      getGlobalDeriveTypeOfNetwork: jest.fn(async () => undefined),
    },
  } as unknown as IBackgroundApi;

  it('excludes Solana from Pro2 QR wallet defaults', async () => {
    const networkIdsMap = getNetworkIdsMap();
    const networks = await buildDefaultAddAccountNetworksForQrWallet({
      backgroundApi,
      walletId: 'qr-pro2-wallet',
      deviceType: EDeviceType.Pro2,
      firmwareType: undefined,
      includingNetworkWithGlobalDeriveType: true,
    });

    expect(new Set(networks.map((network) => network.networkId))).toEqual(
      new Set([networkIdsMap.btc, networkIdsMap.eth]),
    );
  });

  it('keeps Solana in legacy Pro QR wallet defaults', async () => {
    const networkIdsMap = getNetworkIdsMap();
    const networks = await buildDefaultAddAccountNetworksForQrWallet({
      backgroundApi,
      walletId: 'qr-pro-wallet',
      deviceType: EDeviceType.Pro,
      firmwareType: undefined,
      includingNetworkWithGlobalDeriveType: true,
    });

    expect(new Set(networks.map((network) => network.networkId))).toEqual(
      new Set([networkIdsMap.btc, networkIdsMap.eth, networkIdsMap.sol]),
    );
  });
});
