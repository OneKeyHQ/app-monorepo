import { HARDWARE_CONNECT_PROTOCOL } from '@onekeyfe/hd-shared';

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';

import { buildDefaultAddAccountNetworks } from './defaultNetworkAccountsConfig';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

function buildBackgroundApiMock(): IBackgroundApi {
  return {
    serviceAccount: {
      getWalletDeviceSafe: jest.fn().mockResolvedValue({
        protocolType: HARDWARE_CONNECT_PROTOCOL.V2,
      }),
      isBtcOnlyFirmwareByWalletId: jest.fn().mockResolvedValue(false),
      isThirdPartyHwByWalletId: jest.fn().mockResolvedValue(false),
    },
  } as unknown as IBackgroundApi;
}

function buildDefaultOneKeyNetworkParams() {
  const networkIdsMap = getNetworkIdsMap();
  return [
    { networkId: networkIdsMap.btc, deriveType: 'default' },
    { networkId: networkIdsMap.btc, deriveType: 'BIP86' },
    { networkId: networkIdsMap.btc, deriveType: 'BIP84' },
    { networkId: networkIdsMap.btc, deriveType: 'BIP44' },
    { networkId: networkIdsMap.eth, deriveType: 'default' },
    { networkId: networkIdsMap.trx, deriveType: 'default' },
    { networkId: networkIdsMap.sol, deriveType: 'default' },
  ];
}

describe('buildDefaultAddAccountNetworks', () => {
  it('uses the x-branch default network set for Protocol V2 wallets', async () => {
    const result = await buildDefaultAddAccountNetworks({
      backgroundApi: buildBackgroundApiMock(),
      walletId: 'hw-pro2',
      firmwareType: undefined,
    });

    expect(result).toEqual(buildDefaultOneKeyNetworkParams());
  });

  it('does not special-case Protocol V2 explicit custom networks', async () => {
    const networkIdsMap = getNetworkIdsMap();
    const result = await buildDefaultAddAccountNetworks({
      backgroundApi: buildBackgroundApiMock(),
      walletId: 'hw-pro2',
      firmwareType: undefined,
      customNetworks: [{ networkId: networkIdsMap.sol, deriveType: 'default' }],
    });

    expect(result).toEqual(buildDefaultOneKeyNetworkParams());
  });

  it('keeps the x-branch default network set for the All Networks sentinel', async () => {
    const networkIdsMap = getNetworkIdsMap();
    const result = await buildDefaultAddAccountNetworks({
      backgroundApi: buildBackgroundApiMock(),
      walletId: 'hw-pro2',
      firmwareType: undefined,
      customNetworks: [
        { networkId: networkIdsMap.onekeyall, deriveType: 'default' },
      ],
    });

    expect(result).toEqual(buildDefaultOneKeyNetworkParams());
  });
});
