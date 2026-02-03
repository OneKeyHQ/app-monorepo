import { memo, useMemo } from 'react';

import { Stack } from '@onekeyhq/components';

import { AllNetworksManagerContext } from '../AllNetworksManager/AllNetworksManagerContext';
import NetworksSectionList from '../AllNetworksManager/NetworksSectionList';

import type { IServerNetworkMatch } from '../../types';

type IPortfolioContentProps = {
  walletId: string;
  accountId: string | undefined;
  indexedAccountId: string | undefined;
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
  networks: {
    mainNetworks: IServerNetworkMatch[];
    frequentlyUsedNetworks: IServerNetworkMatch[];
  };
};

function PortfolioContent({
  walletId,
  accountId,
  indexedAccountId,
  networksState,
  setNetworksState,
  enabledNetworks,
  searchKey,
  setSearchKey,
  isCreatingEnabledAddresses,
  setIsCreatingEnabledAddresses,
  isCreatingMissingAddresses,
  setIsCreatingMissingAddresses,
  networks,
}: IPortfolioContentProps) {
  const contextValue = useMemo(
    () => ({
      walletId,
      indexedAccountId,
      accountId,
      networks,
      networksState,
      setNetworksState,
      enabledNetworks,
      searchKey,
      setSearchKey,
      isCreatingEnabledAddresses,
      setIsCreatingEnabledAddresses,
      isCreatingMissingAddresses,
      setIsCreatingMissingAddresses,
    }),
    [
      walletId,
      indexedAccountId,
      accountId,
      networks,
      networksState,
      setNetworksState,
      enabledNetworks,
      searchKey,
      setSearchKey,
      isCreatingEnabledAddresses,
      setIsCreatingEnabledAddresses,
      isCreatingMissingAddresses,
      setIsCreatingMissingAddresses,
    ],
  );

  return (
    <AllNetworksManagerContext.Provider value={contextValue}>
      <Stack flex={1}>
        <NetworksSectionList />
      </Stack>
    </AllNetworksManagerContext.Provider>
  );
}

export default memo(PortfolioContent);
