import { useMemo } from 'react';

import { ESwapReceiveAddressType } from '@onekeyhq/shared/types/swap/types';

import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useSwapReceiverAddressBookValueAtom,
  useSwapReceiverAddressInputValueAtom,
  useSwapReceiverAddressTypeAtom,
} from '../../../states/jotai/contexts/swap';

export function useSwapReceiverAddress() {
  const { activeAccount } = useActiveAccount({ num: 1 });
  const [addressType] = useSwapReceiverAddressTypeAtom();
  const [inputValue] = useSwapReceiverAddressInputValueAtom();
  const [bookValue] = useSwapReceiverAddressBookValueAtom();

  return useMemo(() => {
    if (addressType === ESwapReceiveAddressType.USER_ACCOUNT) {
      return activeAccount.account?.address;
    }
    if (addressType === ESwapReceiveAddressType.INPUT) {
      return inputValue;
    }
    if (addressType === ESwapReceiveAddressType.ADDRESS_BOOK) {
      return bookValue;
    }
    return undefined;
  }, [activeAccount.account?.address, addressType, bookValue, inputValue]);
}
