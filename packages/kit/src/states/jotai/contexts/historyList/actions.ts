import { useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import type { IAddressInfo } from '@onekeyhq/shared/types/address';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import {
  addressesInfoAtom,
  addressesInfoDataReadyAtom,
  contextAtomMethod,
  hasMoreOnChainHistoryAtom,
  searchKeyAtom,
} from './atoms';

class ContextJotaiActionsHistoryList extends ContextJotaiActionsBase {
  updateSearchKey = contextAtomMethod((get, set, value: string) => {
    set(searchKeyAtom(), value);
  });

  updateAddressesInfo = contextAtomMethod(
    (
      get,
      set,
      value: { data: Record<string, IAddressInfo>; merge?: boolean },
    ) => {
      const addressMap = get(addressesInfoAtom());
      set(addressesInfoAtom(), { ...addressMap, ...value.data });

      const isReady = get(addressesInfoDataReadyAtom());

      if (!isReady) {
        return;
      }

      void backgroundApiProxy.serviceHistory.updateLocalAddressesInfo({
        data: value.data,
        merge: value.merge,
      });
    },
  );

  setAddressesInfoDataReady = contextAtomMethod((_, set) => {
    set(addressesInfoDataReadyAtom(), true);
  });

  initAddressesInfoDataFromStorage = contextAtomMethod(async (get, set) => {
    const addressesInfoDataReady = get(addressesInfoDataReadyAtom());
    if (addressesInfoDataReady) {
      return;
    }
    const addressesInfoData =
      await backgroundApiProxy.serviceHistory.getLocalAddressesInfo();
    set(addressesInfoAtom(), addressesInfoData);
    set(addressesInfoDataReadyAtom(), true);
  });

  setHasMoreOnChainHistory = contextAtomMethod((_, set, value: boolean) => {
    set(hasMoreOnChainHistoryAtom(), value);
  });
}

const createActions = memoFn(() => {
  console.log('new ContextJotaiActionsHistoryList()', Date.now());
  return new ContextJotaiActionsHistoryList();
});

export function useHistoryListActions() {
  const actions = createActions();

  const updateSearchKey = actions.updateSearchKey.use();
  const updateAddressesInfo = actions.updateAddressesInfo.use();
  const setAddressesInfoDataReady = actions.setAddressesInfoDataReady.use();
  const initAddressesInfoDataFromStorage =
    actions.initAddressesInfoDataFromStorage.use();

  const setHasMoreOnChainHistory = actions.setHasMoreOnChainHistory.use();

  return useRef({
    updateSearchKey,
    updateAddressesInfo,
    setAddressesInfoDataReady,
    initAddressesInfoDataFromStorage,
    setHasMoreOnChainHistory,
  });
}
