import { createContext } from 'react';

import type { IServerNetworkMatch } from '../../types';

export const AllNetworksManagerContext = createContext<{
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
}>({
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
});
