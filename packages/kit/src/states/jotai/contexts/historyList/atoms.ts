import type { IAddressBadge } from '@onekeyhq/shared/types/address';

import { createJotaiContext } from '../../utils/createJotaiContext';

const {
  Provider: ProviderJotaiContextHistoryList,
  withProvider: withHistoryListProvider,
  contextAtom,
  contextAtomMethod,
} = createJotaiContext();
export {
  ProviderJotaiContextHistoryList,
  contextAtomMethod,
  withHistoryListProvider,
};

export const {
  atom: addressesInfoDataReadyAtom,
  use: useAddressesInfoDataReadyAtom,
} = contextAtom<boolean>(false);

export const { atom: searchKeyAtom, use: useSearchKeyAtom } =
  contextAtom<string>('');

export const { atom: addressesInfoAtom, use: useAddressesInfoAtom } =
  contextAtom<Record<string, IAddressBadge>>({});

export const {
  atom: hasMoreOnChainHistoryAtom,
  use: useHasMoreOnChainHistoryAtom,
} = contextAtom<boolean>(false);
