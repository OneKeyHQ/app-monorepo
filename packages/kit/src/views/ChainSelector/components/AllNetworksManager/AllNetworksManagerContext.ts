import { createContext } from 'react';

import type { IServerNetworkMatch } from '../../types';

export const AllNetworksManagerContext = createContext<{
  walletId: string;
  indexedAccountId: string | undefined;
  accountId: string | undefined;
  networks: {
    mainNetworks: IServerNetworkMatch[];
    frequentlyUsedNetworks: IServerNetworkMatch[];
  };
  networksState: {
    enabledNetworks: Record<string, boolean>;
    disabledNetworks: Record<string, boolean>;
  };
  setNetworksState: React.Dispatch<
    React.SetStateAction<{
      enabledNetworks: Record<string, boolean>;
      disabledNetworks: Record<string, boolean>;
    }>
  >;
  enabledNetworks: IServerNetworkMatch[];
  searchKey: string;
  setSearchKey: React.Dispatch<React.SetStateAction<string>>;
  isCreatingEnabledAddresses: boolean;
  setIsCreatingEnabledAddresses: React.Dispatch<React.SetStateAction<boolean>>;
  isCreatingMissingAddresses: boolean;
  setIsCreatingMissingAddresses: React.Dispatch<React.SetStateAction<boolean>>;
}>({
  walletId: '',
  indexedAccountId: undefined,
  accountId: undefined,
  networks: {
    mainNetworks: [],
    frequentlyUsedNetworks: [],
  },
  networksState: {
    enabledNetworks: {},
    disabledNetworks: {},
  },
  setNetworksState: () => {},
  enabledNetworks: [],
  searchKey: '',
  setSearchKey: () => {},
  isCreatingEnabledAddresses: false,
  setIsCreatingEnabledAddresses: () => {},
  isCreatingMissingAddresses: false,
  setIsCreatingMissingAddresses: () => {},
});
