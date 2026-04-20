import { EFirmwareType } from '@onekeyfe/hd-shared';
import { uniqBy } from 'lodash';

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { IMPL_BTC } from '@onekeyhq/shared/src/engine/engineConsts';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IAccountDeriveTypes } from '../../vaults/types';

type IBuildDefaultAddAccountNetworksParams = {
  backgroundApi: IBackgroundApi;
  walletId: string;
  includingNetworkWithGlobalDeriveType?: boolean;
  firmwareType: EFirmwareType | undefined;
  /** true when called from wallet-creation flow; undefined/false means add-account flow */
  isCreateWallet?: boolean;
  /** custom networks selected by user (current network), used for third-party HW add-account to expand BTC derive types */
  customNetworks?: { networkId: string; deriveType: IAccountDeriveTypes }[];
};

type INetworkWithDeriveType = {
  networkId: string;
  deriveType: IAccountDeriveTypes;
};

function uniqueNetworks(networks: INetworkWithDeriveType[]) {
  return uniqBy(networks, (item) => item.deriveType + item.networkId);
}

async function buildWithNetworks({
  backgroundApi,
  includingNetworkWithGlobalDeriveType,
  networkId,
  networks,
}: {
  backgroundApi: IBackgroundApi;
  includingNetworkWithGlobalDeriveType?: boolean;
  networkId: string;
  networks: INetworkWithDeriveType[];
}): Promise<INetworkWithDeriveType[]> {
  const finalNetworks = [...networks];
  if (includingNetworkWithGlobalDeriveType) {
    const deriveType =
      await backgroundApi.serviceNetwork.getGlobalDeriveTypeOfNetwork({
        networkId,
      });
    if (deriveType) {
      finalNetworks.push({
        networkId,
        deriveType,
      });
    }
  }
  return finalNetworks;
}

async function buildAddAccountsNetworks({
  backgroundApi,
  includingNetworkWithGlobalDeriveType,
  btc,
  evm,
  tron,
  sol,
  ltc,
}: IBuildDefaultAddAccountNetworksParams & {
  btc?: boolean;
  evm?: boolean;
  tron?: boolean;
  sol?: boolean;
  ltc?: boolean;
}) {
  const networkIdsMap = getNetworkIdsMap();
  let networks: INetworkWithDeriveType[] = [];
  if (btc) {
    const btcNetworks: INetworkWithDeriveType[] = await buildWithNetworks({
      backgroundApi,
      includingNetworkWithGlobalDeriveType,
      networkId: networkIdsMap.btc,
      networks: [
        {
          networkId: networkIdsMap.btc,
          deriveType: 'default',
        },
        {
          networkId: networkIdsMap.btc,
          deriveType: 'BIP86',
        },
        {
          networkId: networkIdsMap.btc,
          deriveType: 'BIP84',
        },
        {
          networkId: networkIdsMap.btc,
          deriveType: 'BIP44',
        },
      ],
    });
    networks = [...networks, ...btcNetworks];
  }

  if (ltc) {
    const ltcNetworks: INetworkWithDeriveType[] = await buildWithNetworks({
      backgroundApi,
      includingNetworkWithGlobalDeriveType,
      networkId: networkIdsMap.ltc,
      networks: [
        {
          networkId: networkIdsMap.ltc,
          deriveType: 'default',
        },
        {
          networkId: networkIdsMap.ltc,
          deriveType: 'BIP84',
        },
        {
          networkId: networkIdsMap.ltc,
          deriveType: 'BIP44',
        },
      ],
    });
    networks = [...networks, ...ltcNetworks];
  }

  if (evm) {
    const evmNetworks: INetworkWithDeriveType[] = await buildWithNetworks({
      backgroundApi,
      includingNetworkWithGlobalDeriveType,
      networkId: networkIdsMap.eth,
      networks: [
        {
          networkId: networkIdsMap.eth,
          deriveType: 'default',
        },
      ],
    });
    networks = [...networks, ...evmNetworks];
  }

  if (tron) {
    const tronNetworks: INetworkWithDeriveType[] = await buildWithNetworks({
      backgroundApi,
      includingNetworkWithGlobalDeriveType,
      networkId: networkIdsMap.trx,
      networks: [
        {
          networkId: networkIdsMap.trx,
          deriveType: 'default',
        },
      ],
    });
    networks = [...networks, ...tronNetworks];
  }

  if (sol) {
    const solanaNetworks: INetworkWithDeriveType[] = await buildWithNetworks({
      backgroundApi,
      includingNetworkWithGlobalDeriveType,
      networkId: networkIdsMap.sol,
      networks: [
        {
          networkId: networkIdsMap.sol,
          deriveType: 'default',
        },
      ],
    });
    networks = [...networks, ...solanaNetworks];
  }

  return uniqueNetworks(networks);
}

export async function buildDefaultAddAccountNetworks(
  params: IBuildDefaultAddAccountNetworksParams,
) {
  const { backgroundApi, walletId } = params;

  // BTC-only firmware → only BTC (regardless of create/add scenario)
  const isBtcOnlyFirmware =
    await backgroundApi.serviceAccount.isBtcOnlyFirmwareByWalletId({
      walletId,
    });
  if (isBtcOnlyFirmware) {
    return buildAddAccountsNetworks({
      ...params,
      btc: true,
    });
  }

  // Third-party HW (Ledger, Trezor) + add-account → only current network,
  // but BTC need all derive types expanded
  if (!params.isCreateWallet) {
    const isThirdPartyHw =
      await backgroundApi.serviceAccount.isThirdPartyHwByWalletId({
        walletId,
      });
    if (isThirdPartyHw) {
      const hasBtc = params.customNetworks?.some(
        (n) =>
          networkUtils.getNetworkImpl({ networkId: n.networkId }) === IMPL_BTC,
      );
      if (hasBtc) {
        return buildAddAccountsNetworks({
          ...params,
          btc: hasBtc,
        });
      }
      return [];
    }
  }

  const networks: INetworkWithDeriveType[] = await buildAddAccountsNetworks({
    ...params,
    btc: true,
    evm: true,
    tron: true,
    sol: true,
  });
  return networks;
}

export async function buildDefaultAddAccountNetworksForQrWallet(
  params: IBuildDefaultAddAccountNetworksParams,
) {
  const { firmwareType } = params;
  if (firmwareType === EFirmwareType.BitcoinOnly) {
    return buildAddAccountsNetworks({
      ...params,
      btc: true,
    });
  }

  // TODO filter by vault settings
  const networks = await buildAddAccountsNetworks({
    ...params,
    btc: true,
    evm: true,
    sol: true,
  });
  return networks;
}
