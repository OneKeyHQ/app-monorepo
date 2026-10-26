import type { RefObject } from 'react';
import { memo, useMemo } from 'react';

import { Stack } from '@onekeyhq/components';

import { AllNetworksManagerContext } from '../AllNetworksManager/AllNetworksManagerContext';

import NetworksSectionListV2 from './NetworksSectionListV2';

import type { IServerNetworkMatch } from '../../types';
import type { View } from 'react-native';

type IPortfolioContentPropsV2 = {
  webSectionIndexContainerRef: RefObject<View | null>;
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
  missingAddressCount: number;
  setMissingAddressCount: React.Dispatch<React.SetStateAction<number>>;
  networks: {
    mainNetworks: IServerNetworkMatch[];
    frequentlyUsedNetworks: IServerNetworkMatch[];
  };
  accountNetworkValues: Record<string, string>;
  accountNetworkValueCurrency?: string;
  accountDeFiOverview: Record<string, { netWorth: number }>;
};

function PortfolioContentV2({
  webSectionIndexContainerRef,
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
  missingAddressCount,
  setMissingAddressCount,
  networks,
  accountNetworkValues,
  accountNetworkValueCurrency,
  accountDeFiOverview,
}: IPortfolioContentPropsV2) {
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
      missingAddressCount,
      setMissingAddressCount,
      accountNetworkValues,
      accountNetworkValueCurrency,
      accountDeFiOverview,
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
      missingAddressCount,
      setMissingAddressCount,
      accountNetworkValues,
      accountNetworkValueCurrency,
      accountDeFiOverview,
    ],
  );

  return (
    <AllNetworksManagerContext.Provider value={contextValue}>
      <Stack flex={1}>
        <NetworksSectionListV2
          webSectionIndexContainerRef={webSectionIndexContainerRef}
        />
      </Stack>
    </AllNetworksManagerContext.Provider>
  );
}

export default memo(PortfolioContentV2);
