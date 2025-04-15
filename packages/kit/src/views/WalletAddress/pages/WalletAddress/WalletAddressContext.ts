import { createContext } from 'react';

import type { IAllNetworksDBStruct } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAllNetworks';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';

export type IWalletAddressContext = {
  networkAccountMap: Record<string, IAllNetworkAccountInfo[]>;
  networkDeriveTypeMap: Record<string, IAccountDeriveTypes[]>;
  accountId?: string;
  walletId?: string;
  indexedAccountId?: string;
  refreshLocalData: () => void;
  accountsCreated: boolean;
  setAccountsCreated: (accountsCreated: boolean) => void;
  originalAllNetworksState: IAllNetworksDBStruct;
  isAllNetworksEnabled: Record<string, boolean>;
  setIsAllNetworksEnabled: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  allNetworksStateInit: React.MutableRefObject<boolean>;
  originalAllNetworksStateInit: React.MutableRefObject<boolean>;
};
export const WalletAddressContext = createContext<IWalletAddressContext>({
  networkAccountMap: {},
  networkDeriveTypeMap: {},
  accountId: '',
  walletId: '',
  indexedAccountId: '',
  refreshLocalData: () => {},
  originalAllNetworksState: {
    enabledNetworks: {},
    disabledNetworks: {},
  },
  accountsCreated: false,
  setAccountsCreated: () => {},
  isAllNetworksEnabled: {},
  setIsAllNetworksEnabled: () => {},
  allNetworksStateInit: { current: false },
  originalAllNetworksStateInit: { current: false },
});
