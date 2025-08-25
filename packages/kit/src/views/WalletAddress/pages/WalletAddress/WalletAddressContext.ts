import { createContext } from 'react';

import type { IAllNetworksDBStruct } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAllNetworks';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import type { EWalletAddressActionType } from '@onekeyhq/shared/types/address';

export type IWalletAddressContext = {
  title?: string;
  networkAccountMap: Record<string, IAllNetworkAccountInfo[]>;
  accountId?: string;
  walletId?: string;
  indexedAccountId?: string;
  refreshLocalData: (config?: { alwaysSetState?: boolean }) => void;
  accountsCreated: boolean;
  setAccountsCreated: (accountsCreated: boolean) => void;
  originalAllNetworksState: IAllNetworksDBStruct;
  isAllNetworksEnabled: Record<string, boolean>;
  setIsAllNetworksEnabled: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  allNetworksStateInit: React.MutableRefObject<boolean>;
  originalAllNetworksStateInit: React.MutableRefObject<boolean>;
  actionType?: EWalletAddressActionType;
};
export const WalletAddressContext = createContext<IWalletAddressContext>({
  title: '',
  networkAccountMap: {},
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
  actionType: undefined,
});
