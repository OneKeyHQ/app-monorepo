import { createContext, useContext } from 'react';

import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import type { ITokenFiat } from '@onekeyhq/shared/types/token';

const AddressTypeSelectorStableContext = createContext<{
  tokenMap: Record<string, ITokenFiat> | undefined;
  networkId: string;
  networkLogoURI: string | undefined;
  isFetchingTokenMap: boolean;
}>({
  tokenMap: undefined,
  networkId: '',
  networkLogoURI: undefined,
  isFetchingTokenMap: false,
});

const AddressTypeSelectorDynamicContext = createContext<{
  activeDeriveType: IAccountDeriveTypes | undefined;
  creatingDeriveType: IAccountDeriveTypes | undefined;
  isCreatingAddress: boolean;
  setIsCreatingAddress: (value: boolean) => void;
  setActiveDeriveType: (value: IAccountDeriveTypes | undefined) => void;
  setCreatingDeriveType: (value: IAccountDeriveTypes | undefined) => void;
}>({
  activeDeriveType: undefined,
  creatingDeriveType: undefined,
  isCreatingAddress: false,
  setIsCreatingAddress: () => {},
  setActiveDeriveType: () => {},
  setCreatingDeriveType: () => {},
});

const useAddressTypeSelectorStableContext = () =>
  useContext(AddressTypeSelectorStableContext);

const useAddressTypeSelectorDynamicContext = () =>
  useContext(AddressTypeSelectorDynamicContext);

export {
  AddressTypeSelectorStableContext,
  AddressTypeSelectorDynamicContext,
  useAddressTypeSelectorStableContext,
  useAddressTypeSelectorDynamicContext,
};
