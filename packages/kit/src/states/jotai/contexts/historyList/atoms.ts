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

export const { atom: searchKeyAtom, use: useSearchKeyAtom } =
  contextAtom<string>('');

export const { atom: addressMapAtom, use: useAddressMapAtom } = contextAtom<
  Record<string, IAddressBadge> // Record<networkId_address, badge>
>({});
