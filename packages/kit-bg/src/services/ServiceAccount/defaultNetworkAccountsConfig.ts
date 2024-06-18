import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';

import type { IAccountDeriveTypesBtc } from '../../vaults/impls/btc/settings';
import type { IAccountDeriveTypesEvm } from '../../vaults/impls/evm/settings';
import type { IAccountDeriveTypes } from '../../vaults/types';

export function buildDefaultAddAccountNetworks() {
  const networkIdsMap = getNetworkIdsMap();

  const btcNetworks: {
    networkId: string;
    deriveType: IAccountDeriveTypesBtc;
  }[] = [
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
  ];
  const evmNetworks: {
    networkId: string;
    deriveType: IAccountDeriveTypesEvm;
  }[] = [
    {
      networkId: networkIdsMap.eth,
      deriveType: 'default',
    },
    // {
    //   networkId: networkIdsMap.eth,
    //   deriveType: 'ledgerLive',
    // },
  ];
  const networks: { networkId: string; deriveType: IAccountDeriveTypes }[] = [
    ...btcNetworks,
    ...evmNetworks,
  ];
  return networks;
}
