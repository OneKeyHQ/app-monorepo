import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EModalAddressBookRoutes } from '@onekeyhq/kit/src/common/components/AddressBook/router/types';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import { useAddressBookPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/addressBooks';

import type { IAddressItem, ISectionItem } from '../type';

export const useAddressBookItems = (networkId?: string) => {
  const [{ updateTimestamp }] = useAddressBookPersistAtom();
  return usePromiseResult<ISectionItem[]>(
    async () => backgroundApiProxy.serviceAddressBook.groupItems({ networkId }),
    // eslint-disable-next-line
    [updateTimestamp, networkId],
    { watchLoading: true },
  );
};

export const useAddressBookPick = () => {
  const navigation = useAppNavigation();
  return useCallback(
    async (params: {
      onPick?: (item: IAddressItem) => void;
      networkId?: string;
    }) => {
      navigation.pushModal(EModalRoutes.AddressBookModal, {
        screen: EModalAddressBookRoutes.PickItemModal,
        params,
      });
    },
    [navigation],
  );
};

export const useAddressBookList = () => {
  const navigation = useAppNavigation();
  return useCallback(async () => {
    navigation.pushModal(EModalRoutes.AddressBookModal, {
      screen: EModalAddressBookRoutes.ListItemModal,
    });
  }, [navigation]);
};
