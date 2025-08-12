import { createContext, useContext } from 'react';

import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import type { ITokenFiat } from '@onekeyhq/shared/types/token';

const AddressTypeSelectorContext = createContext<{
  activeDeriveType: IAccountDeriveTypes | undefined;
  creatingDeriveType: IAccountDeriveTypes | undefined;
  tokenMap: Record<string, ITokenFiat> | undefined;
  networkId: string;
  isFetchingTokenMap: boolean;
  isCreatingAddress: boolean;
  setIsCreatingAddress: (value: boolean) => void;
  setActiveDeriveType: (value: IAccountDeriveTypes | undefined) => void;
  setCreatingDeriveType: (value: IAccountDeriveTypes | undefined) => void;
}>({
  activeDeriveType: undefined,
  creatingDeriveType: undefined,
  tokenMap: undefined,
  networkId: '',
  isFetchingTokenMap: false,
  isCreatingAddress: false,
  setIsCreatingAddress: () => {},
  setActiveDeriveType: () => {},
  setCreatingDeriveType: () => {},
});

const useAddressTypeSelectorContext = () =>
  useContext(AddressTypeSelectorContext);

export { AddressTypeSelectorContext, useAddressTypeSelectorContext };
