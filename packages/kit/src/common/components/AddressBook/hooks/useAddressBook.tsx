import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EModalAddressBookRoutes } from '@onekeyhq/kit/src/common/components/AddressBook/router/types';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import { useAddressBookPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/addressBooks';

import type { IAddressItem, ISectionItem } from '../type';

export const useAddressBookItems = (networkId?: string) => {
  const [encode] = useAddressBookPersistAtom();
  return usePromiseResult<ISectionItem[]>(
    async () => {
      let items =
        await backgroundApiProxy.serviceAddressBook.getAddressBookItems();
      if (networkId) {
        items = items.filter((item) => item.networkId === networkId);
      }
      const data = items.reduce((acc, item) => {
        const [type] = item.networkId.split('--');
        if (!acc[type]) {
          acc[type] = [];
        }
        acc[type].push(item);
        return acc;
      }, {} as Record<string, IAddressItem[]>);
      return Object.entries(data).map((o) => ({ title: o[0], data: o[1] }));
    },
    // eslint-disable-next-line
    [encode, networkId],
    { watchLoading: true },
  );
};

export const useAddressBookPick = () => {
  const navigation = useAppNavigation();
  return useCallback(
    async (onPick: (item: IAddressItem) => void) => {
      const password =
        await backgroundApiProxy.servicePassword.getCachedPassword();
      if (!password) {
        await backgroundApiProxy.servicePassword.promptPasswordVerify();
      }
      navigation.pushModal(EModalRoutes.AddressBookModal, {
        screen: EModalAddressBookRoutes.PickItemModal,
        params: { onPick },
      });
    },
    [navigation],
  );
};

export const useAddressBookList = () => {
  const navigation = useAppNavigation();
  return useCallback(async () => {
    const password =
      await backgroundApiProxy.servicePassword.getCachedPassword();
    if (!password) {
      await backgroundApiProxy.servicePassword.promptPasswordVerify();
    }
    navigation.pushModal(EModalRoutes.AddressBookModal, {
      screen: EModalAddressBookRoutes.ListItemModal,
    });
  }, [navigation]);
};
